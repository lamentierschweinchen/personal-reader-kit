// Preserve the upstream scanner's conservative binary result. This independent
// project review resolves ONLY the two exact source JPEGs, in every local ref.
import {audit} from './audit.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['-C',root,...args],{env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'},maxBuffer:32*1024*1024});
const manifest=JSON.parse(await readFile(new URL('../publication.json',import.meta.url),'utf8'));
const result=await audit(root),review=manifest.reviewedEdition,problems=[],images=[];
if(!review)throw Error('No reviewed edition inventory.');
const raw=await readFile(new URL('../edition/library.json',import.meta.url));
if(digest(raw)!==review.librarySha256)problems.push('Prepared edition hash differs from the reviewed inventory.');
const books=JSON.parse(raw),embedded=books.flatMap(b=>b.sections.flatMap(s=>s.blocks.filter(b=>b.image).map(b=>b.image)));
if(embedded.length!==2)problems.push('Expected exactly the two source images.');
const commits=git('rev-list','--all','HEAD').toString().trim().split('\n');
const refs=git('for-each-ref','--format=%(objectname)').toString().trim().split('\n').filter(Boolean);
for(const im of review.images){
 const name='edition/'+im.file;
 if(!['edition/cover.jpg','edition/walden-pond-map.jpg'].includes(name))throw Error('Unreviewed image path.');
 for(const [label,data] of [['working',await readFile(new URL('../'+name,import.meta.url))],['index',git('show',':'+name)]])if(digest(data)!==im.sha256)problems.push(name+' '+label+' differs from reviewed original.');
 for(const tree of new Set([...commits,...refs])){const entry=git('ls-tree',tree,'--',name).toString();if(!entry)continue;const [mode,type,hash]=entry.split(/\s+/);if(mode!=='100644'||type!=='blob'||digest(git('cat-file','blob',hash))!==im.sha256)problems.push(name+' has an unreviewed historical image version.');}
 const copy=embedded.find(i=>i.sha256===im.sha256);if(!copy||digest(Buffer.from(copy.base64,'base64'))!==im.sha256)problems.push(name+' embedded bytes differ.');
 images.push({path:name,sha256:im.sha256,bytes:im.bytes,source:im.source,inspection:'Actual image inspected; exact downloaded HTML asset, no re-encoding; source-specific provenance in docs/SOURCE-RIGHTS.md.'});
}
const expectedBinary=result.failures.filter(f=>/^edition\/(cover|walden-pond-map)\.jpg \((working|index|history [a-f0-9]+)\): binary data requires a separate provenance review$/.test(f));
const failures=[...result.failures.filter(f=>!expectedBinary.includes(f)),...problems];
const report={checkedAt:new Date().toISOString(),passed:failures.length===0,kitAuditPassed:result.passed,separatelyReviewedBinaryFindings:expectedBinary,scope:result.scope,reachableCommits:result.reachableCommits,historicalPathVersions:result.historicalPathVersions,files:result.files,images,failures,publicationAuthorized:false,limits:'Exact local inventory and complete locally reachable history, plus source-pinned image review. The upstream scanner still rejects binary data. This receipt is not worldwide rights clearance, legal advice, deployment authorization or a human newcomer pilot. No other binary is exempted.'};
await writeFile(new URL('../.reader/reports/walden-publication-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,kitAuditPassed:report.kitAuditPassed,reachableCommits:report.reachableCommits,files:report.files.length,reviewedImages:images,failures},null,2));if(!report.passed)process.exitCode=1;
