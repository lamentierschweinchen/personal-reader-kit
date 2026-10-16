import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepareEpub,savePreparation} from '../scripts/import-epub.mjs';
import {bookText} from '../site/core.mjs';

const xhtml=body=>`<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Original chapter</title></head><body>${body}</body></html>`;
function entries() {
  return {
    mimetype:'application/epub+zip',
    'META-INF/container.xml':'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'EPUB/package.opf':'<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">original-fixture</dc:identifier><dc:title>Original preparation fixture</dc:title><dc:creator>Test author</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="later" href="later.xhtml" media-type="application/xhtml+xml"/><item id="first" href="first.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="first"/><itemref idref="later"/></spine></package>',
    'EPUB/first.xhtml':xhtml('<h1>First heading</h1><p>🕯 <em>ὁδός <strong>café</strong></em> stays.<br/>Next line.</p><pre>First verse\n    indented\n\n\nLast line  </pre>'),
    'EPUB/later.xhtml':xhtml('<h1>Later heading</h1><p>An original final sentence.</p>')
  };
}
async function archive(directory,files,options={}) {
  const file=path.join(directory,'fixture.epub');
  const script=`import json,sys,zipfile\nv=json.load(sys.stdin)\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n for name,text in v['files'].items():\n  i=zipfile.ZipInfo(name)\n  if v.get('compressed'): i.compress_type=zipfile.ZIP_DEFLATED\n  if name==v.get('symlink'): i.create_system=3; i.external_attr=(0o120777 << 16)\n  z.writestr(i,text)\n if v.get('duplicate'): z.writestr('EPUB/first.xhtml','duplicate')\n`;
  const run=spawnSync('python3',['-c',script,file],{input:JSON.stringify({files,...options}),encoding:'utf8'});assert.equal(run.status,0,run.stderr);return file;
}
test('bounded EPUB candidate preserves spine order, source identity, Unicode emphasis, explicit lines and fixed verse',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'reader-epub-'));let output;
  try {
    const file=await archive(dir,entries()),bytes=await readFile(file),value=await prepareEpub(file),book=value.book;
    assert.ok(book,JSON.stringify(value.report));assert.equal(value.report.status,'candidate-needs-proofreading');assert.equal(value.report.fidelity.proofread,false);
    assert.equal(book.source.sha256,createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(await readFile(file),bytes);
    assert.deepEqual(book.sections.map(s=>s.title),['First heading','Later heading']);assert.equal(book.sections[0].blocks[1].text,'🕯 ὁδός café stays.\nNext line.');
    const prose=book.sections[0].blocks[1];assert.equal(prose.text.slice(prose.marks.find(m=>m.kind==='em').start,prose.marks.find(m=>m.kind==='em').end),'ὁδός café');assert.equal(prose.marks.find(m=>m.kind==='em').start,3);
    assert.equal(book.sections[0].blocks[2].text,'First verse\n    indented\n\n\nLast line  ');assert.equal(book.sections[0].blocks[2].layout,'fixed');assert.match(bookText(book),/First heading[\s\S]*Later heading/);
    output=await savePreparation(value);const root=new URL('../',import.meta.url),prepared=new URL(`${output}/edition.reader.json`,root);assert.deepEqual(JSON.parse(await readFile(prepared,'utf8')),book);assert.equal((await stat(prepared)).mode&0o777,0o600);
    assert.equal(JSON.parse(await readFile(new URL(`${output}/receipt.json`,root),'utf8')).candidate,true);
    const again=await savePreparation(value);assert.notEqual(output,again);await rm(new URL(again,root),{recursive:true});
  }finally{await rm(dir,{recursive:true,force:true});if(output)await rm(new URL('../'+output,import.meta.url),{recursive:true,force:true});}
});
test('EPUB inspection rejects unsupported meaning, encryption and unsafe archives instead of producing partial books',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'reader-epub-fail-'));
  try {
    const cases=[
      ['encryption',e=>{e['META-INF/encryption.xml']='<encryption/>';}],
      ['unsafe-path',e=>{e['../outside.txt']='Original sentinel';}],
      ['block-structure',e=>{e['EPUB/first.xhtml']=xhtml('<p>Before.</p><img src="cover.png"/>');}],
      ['block-structure',e=>{e['EPUB/first.xhtml']=xhtml('<table><tr><td>Original table cell</td></tr></table>');}],
      ['content-attributes',e=>{e['EPUB/first.xhtml']=xhtml('<p style="font-style:italic">Must keep emphasis.</p>');}],
      ['block-structure',e=>{e['EPUB/first.xhtml']=xhtml('<p>Text <a href="#note">1</a></p>');}],
      ['ambiguous-whitespace',e=>{e['EPUB/first.xhtml']=xhtml('<p>Wrapped\nsource text.</p>');}],
      ['unsupported-resource',e=>{e['EPUB/package.opf']=e['EPUB/package.opf'].replace('</manifest>','<item id="css" href="layout.css" media-type="text/css"/></manifest>');e['EPUB/layout.css']='p { font-style: italic }';}],
      ['nonlinear-spine',e=>{e['EPUB/package.opf']=e['EPUB/package.opf'].replace('idref="later"','idref="later" linear="no"');}],
      ['external-reference',e=>{e['EPUB/package.opf']=e['EPUB/package.opf'].replace('href="first.xhtml"','href="https://example.invalid/book.xhtml"');}],
      ['xml-declaration',e=>{e['EPUB/first.xhtml']='<!DOCTYPE html [<!ENTITY x SYSTEM "file:///etc/hostname">]>'+xhtml('<p>&x;</p>');}],
      ['xhtml',e=>{e['EPUB/first.xhtml']=xhtml('<p>Original text.</p>').replace('</html>','<script>doSomething()</script></html>');}],
      ['head-content',e=>{e['EPUB/first.xhtml']=xhtml('<p>Original text.</p>').replace('</head>','<style>p {display:none}</style></head>');}],
      ['unlisted-resource',e=>{e['unlisted.txt']='Original unlisted fixture';}],
      ['member-limit',e=>{e['EPUB/first.xhtml']='A'.repeat(60000);}, {compressed:true}],
      ['archive-symlink',()=>{}, {symlink:'EPUB/first.xhtml'}],
      ['duplicate-member',()=>{}, {duplicate:true}]
    ];
    for(const [code,edit,options] of cases) {
      const files=entries();edit(files);const file=await archive(dir,files,options),result=await prepareEpub(file);
      assert.equal(result.book,null,code);assert.equal(result.report.candidate,false,code);assert.equal(result.report.issues[0].code,code,JSON.stringify(result.report.issues));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('an early unsupported cover still produces a complete safe resource and feature inventory',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'reader-epub-inventory-'));
  try {
    const files=entries();
    files['EPUB/package.opf']=files['EPUB/package.opf'].replace('<manifest>','<manifest><item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/><item id="css" href="layout.css" media-type="text/css"/>').replace('idref="later"','idref="later" linear="no"');
    files['EPUB/cover.svg']='<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    files['EPUB/layout.css']='.original { margin-left: 2em }';
    files['EPUB/first.xhtml']=xhtml('<p class="original">An original styled sentence.</p><img src="cover.svg" alt="Original square"/><table><tr><td>Original cell</td></tr></table><p><a href="later.xhtml#note">Original note link</a></p>');
    files['EPUB/later.xhtml']=xhtml('<h1>Later heading</h1><aside xmlns:epub="http://www.idpf.org/2007/ops" epub:type="footnote" id="note"><p>Original source note.</p></aside>');
    const result=await prepareEpub(await archive(dir,files)),report=result.report;
    assert.equal(result.book,null);assert.equal(report.candidate,false);assert.equal(report.issues[0].code,'manifest-feature');assert.match(report.issues[0].detail,/cover-image/);
    assert.equal(report.resources.length,4);assert.equal(report.spine.length,2);assert.equal(report.spine[1].linear,'no');
    assert.equal(report.inspection.packageInventoried,true);assert.equal(report.inspection.safeXmlScanComplete,true);assert.equal(report.inspection.xmlDocuments.length,3);
    for(const code of ['manifest-feature','image-resource','stylesheet-resource','svg','images','tables','links','styled-elements','source-note-semantics','nonlinear-spine'])assert.ok(report.features.some(f=>f.code===code),code);
    assert.equal(report.fidelity.proofread,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('diagnostic XML inspection never resolves entities or approves unreadable navigation',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'reader-epub-unsafe-nav-'));
  try {
    const files=entries();files['EPUB/package.opf']=files['EPUB/package.opf'].replace('</manifest>','<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest>');
    files['EPUB/nav.xhtml']='<!DOCTYPE html [<!ENTITY original "Do not expand">]>'+xhtml('<p>&original;</p>');
    const result=await prepareEpub(await archive(dir,files));
    assert.equal(result.book,null);assert.equal(result.report.inspection.safeXmlScanComplete,false);
    assert.equal(result.report.inspection.errors[0].code,'xml-declaration');assert.equal(result.report.issues[0].code,'xml-declaration');
  }finally{await rm(dir,{recursive:true,force:true});}
});
