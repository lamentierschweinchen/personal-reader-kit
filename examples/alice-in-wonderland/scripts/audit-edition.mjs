import {execFileSync} from 'node:child_process';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {audit} from './audit.mjs';
import {inspectEdition} from './edition.mjs';
const root=new URL('../',import.meta.url),cwd=fileURLToPath(root);
const sha=data=>createHash('sha256').update(data).digest('hex');
const inherited=await audit(cwd),edition=await inspectEdition(root),failures=[...inherited.failures];
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'}}).trim();
const history=[...new Set(git('rev-list','--all','--reflog','HEAD').split('\n').filter(Boolean))],versions=new Set();
for(const commit of history){
  const files=git('ls-tree','-r','--name-only',commit).split('\n');
  if(files.includes('edition/library.json')){
    const bytes=execFileSync('git',['show',`${commit}:edition/library.json`],{cwd,maxBuffer:16*1024*1024});
    const hash=sha(bytes);versions.add(hash);
    if(hash!==edition.receipt.librarySha256)failures.push(`Unreviewed historical edition payload at ${commit.slice(0,8)}. Review its exact decoded assets before publication.`);
  }
}
const outputs=[];
for(const name of (await readdir(new URL('dist/',root))).sort()){
  const bytes=await readFile(new URL('dist/'+name,root));outputs.push({path:name,bytes:bytes.length,sha256:sha(bytes)});
}
const expected=['app.mjs','bundle.mjs','core.mjs','db.mjs','icon.svg','index.html','library.json','manifest.webmanifest','robots.txt','share.mjs','style.css','sw.js','text.mjs'];
if(JSON.stringify(outputs.map(x=>x.path))!==JSON.stringify(expected))failures.push('Build output does not match the exact thirteen-file deployment candidate.');
if(outputs.find(x=>x.path==='library.json')?.sha256!==edition.receipt.librarySha256)failures.push('Built edition differs from the reviewed candidate.');
const report={checkedAt:new Date().toISOString(),passed:failures.length===0,publicationAuthorized:false,destination:null,completeLocalCommitsIncludingReflogs:history.length,historicalEditionPayloads:[...versions],source:edition.receipt.source,editionSha256:edition.receipt.librarySha256,decodedImageAssets:edition.book.assets.map(a=>({id:a.id,sha256:a.sha256,mime:a.mime})),outputs,failures,limits:'Local HEAD, refs, reflogs, index and working candidate reviewed. No remote exists. The inherited audit cannot interpret binary images hidden inside JSON; this project gate separately decodes and pins each PNG/JPEG against the inspected source inventory. Exact hashes and a heuristic scan do not establish worldwide rights or human proofreading.'};
await writeFile(new URL('.reader/edition-publication-review.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,commits:history.length,decodedImageAssets:report.decodedImageAssets.length,outputs:outputs.map(x=>x.path),failures},null,2));
if(!report.passed)process.exitCode=1;
