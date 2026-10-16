// Local public-domain adaptation. The upstream original-samples-only auditor
// remains unchanged and still refuses binaries. This adds a separate, exact-byte
// provenance review for the 164 source images; no other finding is waived.
import {audit,inspectContent} from './audit.mjs';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',root,...args],{env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'},maxBuffer:40*1024*1024});
await mkdir(path.join(root,'.reader'),{recursive:true});
await writeFile(path.join(root,'.reader/example-publication-review.json'),JSON.stringify({checkedAt:new Date().toISOString(),passed:false,failures:['Example audit has not completed. A failed inspection must not leave a stale successful receipt.']},null,2)+'\n');
const baseline=await audit(root),manifest=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
const inventoryBytes=await readFile(path.join(root,'edition/inventory.json')),inventory=JSON.parse(inventoryBytes),failures=[];
if(sha(inventoryBytes)!==manifest.editionInventorySha256)failures.push('The edition inventory is not pinned by publication.json.');
const images=inventory.assets.filter(a=>/\.(png|jpg)$/.test(a.path));
if(images.length!==164||new Set(images.map(a=>a.path)).size!==164)failures.push('Expected exactly 164 reviewed source images.');
for(const asset of inventory.assets){
 if(!/^edition\/(?:library\.json|austen-[a-zA-Z0-9_.-]+\.(?:png|jpg))$/.test(asset.path))failures.push('Unexpected edition path: '+asset.path);
 const data=await readFile(path.join(root,asset.path));
 if(!(await lstat(path.join(root,asset.path))).isFile()||sha(data)!==asset.sha256||data.length!==asset.bytes)failures.push('Unreviewed current asset bytes: '+asset.path);
 if(sha(git('show',':'+asset.path))!==asset.sha256)failures.push('Unreviewed staged asset: '+asset.path);
 if(!asset.rights||!asset.attribution||!asset.sourceMember)failures.push('Incomplete provenance: '+asset.path);
}
// Check every version, including tree snapshot refs. A path-specific image
// exception cannot hide an older image, credential or private file at that path.
const trees=new Set(git('rev-list','--all','HEAD').toString().trim().split('\n').filter(Boolean));
for(const line of git('for-each-ref','--format=%(objectname)').toString().trim().split('\n').filter(Boolean)){
 if(git('cat-file','-t',`${line}^{}`).toString().trim()==='tree')trees.add(line+'^{}');
}
let reviewedVersions=0;const seen=new Set();
for(const tree of trees)for(const entry of git('ls-tree','-r','-z',tree).toString().split('\0').filter(Boolean)){
 const tab=entry.indexOf('\t'),name=entry.slice(tab+1),[mode,type,hash]=entry.slice(0,tab).split(' '),asset=images.find(a=>a.path===name);
 if(!asset||seen.has(name+':'+hash))continue;seen.add(name+':'+hash);
 const data=git('cat-file','blob',hash);
 if(mode!=='100644'||type!=='blob'||sha(data)!==asset.sha256)failures.push('Unreviewed historical image version: '+name+' at '+tree);
 for(const reason of inspectContent(data).filter(x=>x!=='binary data requires a separate provenance review'))failures.push(name+': '+reason);
 reviewedVersions++;
}
const binaryFindings=baseline.failures.filter(f=>images.some(a=>f.startsWith(a.path+' ('))&&f.endsWith(': binary data requires a separate provenance review'));
failures.push(...baseline.failures.filter(f=>!binaryFindings.includes(f)));
const report={checkedAt:new Date().toISOString(),passed:failures.length===0,scope:baseline.scope,reachableCommits:baseline.reachableCommits,historicalPathVersions:baseline.historicalPathVersions,reviewedImages:images.length,reviewedHistoricalImageVersions:reviewedVersions,baselineRefusalCount:binaryFindings.length,files:baseline.files,failures,limits:'Complete local reachable history, index and working tree, plus a pinned source-edition asset review. No remote exists. Unreachable objects are outside scope. This is not worldwide rights clearance, human proofreading, or publication authorization.'};
await writeFile(path.join(root,'.reader/example-publication-review.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:report.files.length},null,2));
if(!report.passed)process.exitCode=1;
