import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {exportStarter} from '../scripts/export-starter.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const file = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), file + '/'));
    else result.push(file);
  }
  return result.sort();
}
async function temporary(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'reader-starter-export-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}
async function fixture(t) {
  const directory = await temporary(t), source = path.join(directory, 'source'), destination = path.join(directory, 'reader');
  const sample = Buffer.from('{"original":"Original test writing."}\n');
  const font = Buffer.from([119, 79, 70, 50, 0, 1]);
  const notice = Buffer.from('Original test license fixture.');
  const content = {'README.md': 'Fixture reader', 'samples/library.json': sample, 'docs/FONTS.md': 'Original binary fixture, not a real font.', 'site/fixture.woff2': font, 'site/fixture-OFL.txt': notice};
  const manifest = {
    intendedVisibility: 'public', sampleProvenance: 'Original test writing.', originalSampleSha256: sha(sample),
    files: ['publication.json', ...Object.keys(content), 'examples/catalog.json', 'showcase/assets/optional.png'],
    starterFiles: ['publication.json', ...Object.keys(content)],
    reviewedEditionFiles: [{path: 'examples/edition.json', provenance: 'examples/RIGHTS.md'}],
    reviewedSiteAssets: [{path: 'showcase/assets/optional.png', provenance: 'showcase/ASSETS.md'}],
    reviewedHistoricalFiles: [{path: 'showcase/retired.png', sha256: 'a'.repeat(64), reason: 'Retired fixture.'}],
    reviewedIconFiles: [{path: 'examples/sample/site/icon-192.png', provenance: 'docs/HOME-SCREEN.md'}],
    reviewedFontFiles: [{path: 'site/fixture.woff2', sha256: sha(font), provenance: 'docs/FONTS.md', license: 'site/fixture-OFL.txt', licenseSha256: sha(notice), reason: 'Original binary fixture.'}, {path: 'examples/optional/site/font.woff2'}]
  };
  for (const [file, bytes] of Object.entries(content)) {
    await mkdir(path.dirname(path.join(source, file)), {recursive: true});
    await writeFile(path.join(source, file), bytes);
  }
  const save = () => writeFile(path.join(source, 'publication.json'), JSON.stringify(manifest));
  await save();
  return {source, destination, directory, manifest, save};
}

test('real starter export is exact, sample-identical, and recursively usable without Git', async t => {
  const directory = await temporary(t), destination = path.join(directory, 'reader'), second = path.join(directory, 'second');
  const original = JSON.parse(await readFile(path.join(root, 'publication.json'), 'utf8'));
  const originalManifestBytes = await readFile(path.join(root, 'publication.json'));
  const result = await exportStarter({source: root, destination});
  assert.deepEqual(await listFiles(destination), [...original.starterFiles].sort());
  assert.deepEqual(result.files, original.starterFiles);
  const projected = JSON.parse(await readFile(path.join(destination, 'publication.json'), 'utf8'));
  assert.deepEqual(projected.files, original.starterFiles);
  assert.deepEqual(projected.starterFiles, original.starterFiles);
  assert.equal(projected.originalSampleSha256, original.originalSampleSha256);
  assert.equal(projected.sampleProvenance, original.sampleProvenance);
  const currentIcons=[];
  for(const entry of original.reviewedIconFiles)if(original.starterFiles.includes(entry.path)&&sha(await readFile(path.join(root,entry.path)))===entry.sha256)currentIcons.push(entry);
  assert.deepEqual(projected.reviewedIconFiles, currentIcons);
  for (const file of original.starterFiles.filter(file => file !== 'publication.json')) {
    assert.deepEqual(await readFile(path.join(destination, file)), await readFile(path.join(root, file)), file);
  }
  assert.deepEqual(await readFile(path.join(root, 'publication.json')), originalManifestBytes);
  execFileSync(process.execPath, [path.join(destination, 'scripts/export-starter.mjs'), second], {stdio: 'pipe'});
  assert.deepEqual(await listFiles(second), [...original.starterFiles].sort());
  for (const file of original.starterFiles) assert.deepEqual(await readFile(path.join(second, file)), await readFile(path.join(destination, file)), file);
});

test('projection retains included asset pins and full notices, excludes optional and private content', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, '.reader'), {recursive: true});
  await writeFile(path.join(f.source, '.reader/private.txt'), 'Private fixture must not travel.');
  await exportStarter(f);
  const projected = JSON.parse(await readFile(path.join(f.destination, 'publication.json'), 'utf8'));
  assert.deepEqual(projected.reviewedFontFiles, [f.manifest.reviewedFontFiles[0]]);
  for (const key of ['reviewedEditionFiles', 'reviewedSiteAssets', 'reviewedHistoricalFiles', 'reviewedIconFiles']) assert.deepEqual(projected[key], []);
  assert.deepEqual(await listFiles(f.destination), [...f.manifest.starterFiles].sort());
  assert.equal(await readFile(path.join(f.destination, 'site/fixture-OFL.txt'), 'utf8'), 'Original test license fixture.');
});

test('history-free export keeps current pins while preserving the source historical icon and font reviews',async t=>{
  const f=await fixture(t),file='site/icon-192.png';
  // Synthetic binary audit fixture; actual PNG decoding is covered by home-screen tests.
  const old=Buffer.from([137,80,78,71,0,1]),current=Buffer.from([137,80,78,71,0,2]);
  await writeFile(path.join(f.source,file),current);f.manifest.files.push(file);f.manifest.starterFiles.push(file);
  const oldPin={path:file,sha256:sha(old),provenance:'README.md',reason:'Original synthetic historical icon.'};
  const currentPin={...oldPin,sha256:sha(current),reason:'Original synthetic current icon.'};
  f.manifest.reviewedIconFiles.push(oldPin,currentPin);
  const currentFont=f.manifest.reviewedFontFiles[0],oldFont={...currentFont,sha256:sha(Buffer.from('older synthetic font')),licenseSha256:sha(Buffer.from('older synthetic notice'))};
  f.manifest.reviewedFontFiles.unshift(oldFont);
  const historical={path:'README.md',sha256:sha(Buffer.from('historical original readme')),reason:'Separate historical-path behavior is unchanged.'};
  f.manifest.reviewedHistoricalFiles.push(historical);await f.save();
  const original=await readFile(path.join(f.source,'publication.json'));
  await exportStarter(f);
  const projected=JSON.parse(await readFile(path.join(f.destination,'publication.json'),'utf8'));
  assert.deepEqual(projected.reviewedIconFiles,[currentPin]);assert.deepEqual(projected.reviewedFontFiles,[currentFont]);
  assert.deepEqual(projected.reviewedHistoricalFiles,[historical]);
  assert.deepEqual(await readFile(path.join(f.destination,file)),current);
  assert.deepEqual(await readFile(path.join(f.source,'publication.json')),original,'export does not remove reachable-history pins from source');
});

test('historical pins cannot admit changed bytes, unknown binary paths or missing provenance',async t=>{
  for(const kind of ['old-only','changed','missing-provenance','invalid-old-provenance','invalid-old-hash','unknown-path','license']){
    const f=await fixture(t),file=kind==='unknown-path'?'site/arbitrary.png':'site/icon-192.png';
    const current=Buffer.from([137,80,78,71,0,2]),old=Buffer.from([137,80,78,71,0,1]);
    await writeFile(path.join(f.source,file),current);f.manifest.files.push(file);f.manifest.starterFiles.push(file);
    const oldPin={path:file,sha256:sha(old),provenance:'README.md',reason:'Synthetic old icon.'};
    const currentPin={...oldPin,sha256:sha(current),reason:'Synthetic current icon.'};
    f.manifest.reviewedIconFiles.push(oldPin,...(kind==='old-only'?[]:[currentPin]));
    if(kind==='changed')await writeFile(path.join(f.source,file),Buffer.concat([current,Buffer.from('unreviewed')]));
    if(kind==='missing-provenance')delete currentPin.provenance;
    if(kind==='invalid-old-provenance')oldPin.provenance='examples/excluded.md';
    if(kind==='invalid-old-hash')oldPin.sha256='not-a-sha';
    if(kind==='license')f.manifest.reviewedFontFiles[0].licenseSha256='a'.repeat(64);
    await f.save();
    await assert.rejects(exportStarter(f),/reviewed hash|excluded provenance|Invalid included asset pin|binary data/);
    await assert.rejects(access(f.destination),{code:'ENOENT'});
  }
});

test('missing input, altered sample, altered assets and excluded provenance fail before destination creation', async t => {
  for (const kind of ['missing', 'sample', 'asset', 'provenance', 'license']) {
    const f = await fixture(t);
    if (kind === 'missing') await rm(path.join(f.source, 'README.md'));
    if (kind === 'sample') await writeFile(path.join(f.source, 'samples/library.json'), 'Changed sample');
    if (kind === 'asset') await writeFile(path.join(f.source, 'site/fixture.woff2'), 'Changed font');
    if (kind === 'provenance') f.manifest.reviewedFontFiles[0].provenance = 'examples/excluded.md';
    if (kind === 'license') await writeFile(path.join(f.source, 'site/fixture-OFL.txt'), 'Shortened notice');
    await f.save();
    await assert.rejects(exportStarter(f), /ENOENT|hash|excluded provenance/);
    await assert.rejects(access(f.destination), {code: 'ENOENT'});
  }
});

test('unsafe, duplicate, optional and conflicting inventories cannot create output', async t => {
  for (const name of ['../escape.txt', '/absolute.txt', 'site\\escape.txt', 'site/../escape.txt', 'site//escape.txt', '.git/config', '.reader/book.txt', 'examples/catalog.json', 'showcase/assets/optional.png', 'README.md', 'readme.md', 'site']) {
    const f = await fixture(t);
    f.manifest.starterFiles.push(name); f.manifest.files.push(name); await f.save();
    await assert.rejects(exportStarter(f), /Unsafe|Duplicate|collision/);
    await assert.rejects(access(f.destination), {code: 'ENOENT'});
  }
  const f = await fixture(t);
  f.manifest.starterFiles.push('not-reviewed.txt'); await f.save();
  await assert.rejects(exportStarter(f), /outside publication/);
  await assert.rejects(access(f.destination), {code: 'ENOENT'});
});

test('existing destinations, missing parents and source-contained targets are untouched', async t => {
  const f = await fixture(t);
  await mkdir(f.destination); await writeFile(path.join(f.destination, 'keep.txt'), 'Existing work');
  await assert.rejects(exportStarter(f), /already exists/);
  assert.equal(await readFile(path.join(f.destination, 'keep.txt'), 'utf8'), 'Existing work');
  const missing = path.join(f.directory, 'missing');
  await assert.rejects(exportStarter({...f, destination: path.join(missing, 'reader')}), {code: 'ENOENT'});
  await assert.rejects(access(missing), {code: 'ENOENT'});
  await assert.rejects(exportStarter({...f, destination: path.join(f.source, 'reader')}), /outside the source/);
  await assert.rejects(exportStarter({source: f.source}), /explicit new/);
});

test('symlink files, directories, manifests and destination parents are refused', async t => {
  for (const name of ['README.md', 'site', 'publication.json']) {
    const f = await fixture(t), original = path.join(f.source, name), moved = path.join(f.directory, 'linked-input');
    const {rename} = await import('node:fs/promises');
    await rename(original, moved); await symlink(moved, original);
    await assert.rejects(exportStarter(f), /without symlinks/);
    await assert.rejects(access(f.destination), {code: 'ENOENT'});
  }
  const f = await fixture(t), link = path.join(f.directory, 'parent-link');
  await symlink(f.source, link);
  await assert.rejects(exportStarter({...f, destination: path.join(link, 'reader')}), /must not be a symlink/);
  await assert.rejects(exportStarter({...f, source: link}), /not a symlink/);
});
