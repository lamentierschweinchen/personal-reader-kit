import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
export function inspectFile(name,bytes,allowed,reviewedEditions=[],reviewedSiteAssets=[]) {
  const problems=[];
  if(!allowed.includes(name))problems.push('not in the reviewed file inventory');
  if(/(^|\/)(?:\.reader|\.env(?:\..*)?|\.vercel|node_modules|test-results|source|books|annotations|private)(\/|$)/i.test(name) || /\.(?:epub|pdf|mobi|azw3?|docx|pem|key|reader\.json|reader-backup\.json|reader-bundle\.json)$/i.test(name))problems.push('private/book path or disallowed format');
  // Public examples are an explicit, path-and-content-pinned exception. This
  // covers JSON with embedded images as well as separate source image files.
  // No directory-wide binary exemption and no suppression of credential scans.
  const editionPath=/^examples\/[a-z0-9-]+\/editions?\/[a-zA-Z0-9_.-]+\.(?:json|png|jpg|jpeg)$/.test(name);
  const reviewed=editionPath&&reviewedEditions.some(f=>f.path===name&&f.sha256===createHash('sha256').update(bytes).digest('hex')&&typeof f.provenance==='string'&&allowed.includes(f.provenance)&&typeof f.reason==='string'&&f.reason.trim());
  if(/^examples\/[^/]+\/editions?\//.test(name)&&!reviewed)problems.push('edition bytes lack an exact reviewed provenance entry');
  const siteAssetPath=/^showcase\/assets\/[a-z0-9-]+\.(?:webp|woff2)$/.test(name);
  const reviewedSite=siteAssetPath&&reviewedSiteAssets.some(f=>f.path===name&&f.sha256===createHash('sha256').update(bytes).digest('hex')&&typeof f.provenance==='string'&&allowed.includes(f.provenance)&&typeof f.reason==='string'&&f.reason.trim());
  if(siteAssetPath&&!reviewedSite)problems.push('showcase asset lacks an exact reviewed provenance entry');
  const content=inspectContent(bytes);
  return [...problems,...content.filter(reason=>!(((reviewed&&/\.(?:png|jpe?g)$/.test(name))||reviewedSite)&&reason==='binary data requires a separate provenance review'))];
}
export function inspectContent(bytes) {
  const problems=[];
  if(bytes.includes(0))problems.push('binary data requires a separate provenance review');
  const text=bytes.toString('utf8');
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) || /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})\b/.test(text))problems.push('possible credential');
  if(/\/Users\/[A-Za-z0-9._-]+\//.test(text))problems.push('personal absolute filesystem path');
  return problems;
}
export async function audit(directory=root) {
  try {return await inspectRepository(directory);}
  catch(error) {
    // Do not leave a stale green receipt behind after a failed Git inspection.
    await mkdir(path.join(directory,'.reader'),{recursive:true});
    await writeFile(path.join(directory,'.reader/publication-review.json'),JSON.stringify({checkedAt:new Date().toISOString(),passed:false,scope:null,files:[],failures:['Publication inspection did not complete. '+error.message]},null,2)+'\n');
    throw error;
  }
}
async function inspectRepository(directory) {
  const gitBytes=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'},maxBuffer:32*1024*1024});
  const git=(...args)=>gitBytes(...args).toString('utf8');
  const manifest=JSON.parse(await readFile(path.join(directory,'publication.json'),'utf8'));
  const allowed=manifest.files;
  if(!Array.isArray(allowed)||new Set(allowed).size!==allowed.length)throw new Error('Publication inventory is invalid.');
  // Retired paths are a separate, content-pinned review. They must never weaken
  // the exact current inventory or the private-path/credential checks.
  const historical=manifest.reviewedHistoricalFiles || [];
  if(!Array.isArray(historical)||historical.some(f=>!f||typeof f.path!=='string'||!f.path||!(/^[a-f0-9]{64}$/).test(f.sha256)||typeof f.reason!=='string'||!f.reason.trim()))throw new Error('Historical review entries need a path, SHA-256 and reason.');
  const editions=manifest.reviewedEditionFiles || [];
  if(!Array.isArray(editions)||editions.some(f=>!f||!/^examples\/[a-z0-9-]+\/editions?\/[a-zA-Z0-9_.-]+\.(?:json|png|jpg|jpeg)$/.test(f.path)||!(/^[a-f0-9]{64}$/).test(f.sha256)||typeof f.provenance!=='string'||!allowed.includes(f.provenance)||typeof f.reason!=='string'||!f.reason.trim()))throw new Error('Edition review entries need an exact example asset path, SHA-256, tracked provenance and reason.');
  const siteAssets=manifest.reviewedSiteAssets || [];
  if(!Array.isArray(siteAssets)||siteAssets.some(f=>!f||!/^showcase\/assets\/[a-z0-9-]+\.(?:webp|woff2)$/.test(f.path)||!(/^[a-f0-9]{64}$/).test(f.sha256)||typeof f.provenance!=='string'||!allowed.includes(f.provenance)||typeof f.reason!=='string'||!f.reason.trim()))throw new Error('Showcase asset review entries need an exact asset path, SHA-256, tracked provenance and reason.');
  const tracked=git('ls-files','-z').split('\0').filter(Boolean), failures=[], inventory=[];
  const shallow=git('rev-parse','--is-shallow-repository').trim()==='true';
  if(shallow)failures.push('Incomplete history: this is a shallow repository. Fetch the complete intended ref history before auditing.');
  if(git('for-each-ref','--format=%(refname)','refs/replace').trim())failures.push('Replacement refs conceal history; review without Git replacements.');
  const grafts=git('rev-parse','--git-path','info/grafts').trim();
  try {if((await readFile(path.resolve(directory,grafts),'utf8')).trim())failures.push('Git grafts conceal history; remove the graft view before reviewing.');}catch(e){if(e.code!=='ENOENT')throw e;}
  // A failed inspection is fatal, never a partial success receipt. Do not fetch
  // absent objects implicitly during a review (including partial clones).
  if(/(?:extensions\.partialclone=|remote\.[^\n=]+\.promisor=true)/i.test(git('config','--local','--list')))failures.push('Partial clone configuration cannot establish complete history. Use a complete clone for publication review.');
  git('fsck','--connectivity-only','--no-dangling');
  const revision=git('rev-parse','--verify','HEAD').trim();
  const refs=git('for-each-ref','--format=%(refname) %(objectname)').trim().split('\n').filter(Boolean).map(line=>{const [ref,object]=line.split(' ');return {ref,object};});
  const snapshotTrees=[];
  for(const {ref,object} of refs) {
    const type=git('cat-file','-t',`${object}^{}`).trim();
    if(type==='tree')snapshotTrees.push(object+'^{}');
    else if(type!=='commit')failures.push(`${ref}: standalone object has no reviewed file path; separate provenance review required`);
  }
  if(!tracked.length)throw new Error('Stage the exact reviewed file set before running the public audit.');
  const extra=git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  for(const name of extra)failures.push(`${name}: untracked file has not been reviewed/staged`);
  for(const name of tracked) {
    const file=path.join(directory,name);
    let bytes;
    try{if(!(await lstat(file)).isFile())throw new Error('Not regular');bytes=await readFile(file);}catch{failures.push(`${name}: missing or non-regular working file`);continue;}
    for(const reason of inspectFile(name,bytes,allowed,editions,siteAssets))failures.push(`${name} (working): ${reason}`);
    const staged=gitBytes('show',`:${name}`);
    for(const reason of inspectFile(name,staged,allowed,editions,siteAssets))failures.push(`${name} (index): ${reason}`);
    if(!bytes.equals(staged))failures.push(`${name}: index and working file differ; stage the reviewed final bytes`);
    inventory.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  for(const name of allowed)if(!tracked.includes(name))failures.push(`${name}: approved inventory path is not staged/tracked`);
  const commits=git('rev-list','--all','HEAD').trim().split('\n').filter(Boolean);
  const seen=new Set();
  for(const commit of commits)for(const reason of inspectContent(gitBytes('cat-file','commit',commit)))failures.push(`commit metadata ${commit.slice(0,8)}: ${reason}`);
  // Editors can retain tree snapshots without commits. Inspect their paths and
  // bytes too; neither ignore those refs nor reject ordinary reviewed snapshots.
  for(const tree of new Set([...commits,...snapshotTrees])) {
    const entries=git('ls-tree','-r','-z',tree).split('\0').filter(Boolean);
    for(const entry of entries) {
      const tab=entry.indexOf('\t'),meta=entry.slice(0,tab),name=entry.slice(tab+1),[mode,type,hash]=meta.split(' '),key=`${name}:${hash}`;
      if(seen.has(key))continue;seen.add(key);
      if(type!=='blob'||mode!=='100644') {failures.push(`${name} (history): unexpected file mode/type`);continue;}
      const data=gitBytes('cat-file','blob',hash),digest=createHash('sha256').update(data).digest('hex');
      const reviewed=historical.some(f=>f.path===name&&f.sha256===digest);
      for(const reason of inspectFile(name,data,reviewed?[...allowed,name]:allowed,editions,siteAssets))failures.push(`${name} (history ${tree.slice(0,8)}): ${reason}`);
    }
  }
  const objects=git('rev-list','--objects','--all','HEAD').trim().split('\n').filter(Boolean).map(line=>line.split(' ')[0]);
  const types=execFileSync('git',['-C',directory,'cat-file','--batch-check=%(objecttype) %(objectname)'],{input:objects.join('\n')+'\n',encoding:'utf8',stdio:'pipe',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1'},maxBuffer:32*1024*1024}).trim().split('\n');
  for(const entry of types) {
    const [type,hash]=entry.split(' ');
    if(!['commit','tree','blob','tag'].includes(type))throw new Error('A reachable Git object could not be inspected.');
    if(type==='tag')for(const reason of inspectContent(Buffer.from(git('cat-file','tag',hash))))failures.push(`tag metadata ${hash.slice(0,8)}: ${reason}`);
  }
  const sample=await readFile(path.join(directory,'samples/library.json'));
  if(createHash('sha256').update(sample).digest('hex')!==manifest.originalSampleSha256)failures.push('Original sample bytes differ from their reviewed hash.');
  const result={checkedAt:new Date().toISOString(),passed:failures.length===0,scope:{revision,refs,shallow,snapshotTrees:snapshotTrees.length,description:'HEAD and all locally present refs, including tree snapshots, index and working files. Unfetched remote refs and unreachable objects are outside this receipt.'},reachableCommits:commits.length,historicalPathVersions:seen.size,files:inventory,failures,limits:'Heuristic scan plus exact inventory. Human provenance and file/history review are required; no automatic tool can prove the absence of copyrighted text or every secret.'};
  await mkdir(path.join(directory,'.reader'),{recursive:true});
  await writeFile(path.join(directory,'.reader/publication-review.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const report=await audit();console.log(JSON.stringify({passed:report.passed,files:report.files.map(f=>f.path),reachableCommits:report.reachableCommits,failures:report.failures},null,2));
  if(!report.passed)process.exitCode=1;
}
