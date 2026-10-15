import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
export function inspectFile(name,bytes,allowed) {
  const problems=[];
  if(!allowed.includes(name))problems.push('not in the reviewed file inventory');
  if(/(^|\/)(?:\.reader|\.env(?:\..*)?|\.vercel|node_modules|test-results|source|books|annotations|private)(\/|$)/i.test(name) || /\.(?:epub|pdf|mobi|azw3?|docx|pem|key|reader\.json|reader-backup\.json)$/i.test(name))problems.push('private/book path or disallowed format');
  return [...problems,...inspectContent(bytes)];
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
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
  const manifest=JSON.parse(await readFile(path.join(directory,'publication.json'),'utf8'));
  const allowed=manifest.files;
  if(!Array.isArray(allowed)||new Set(allowed).size!==allowed.length)throw new Error('Publication inventory is invalid.');
  const tracked=git('ls-files','-z').split('\0').filter(Boolean), failures=[], inventory=[];
  if(!tracked.length)throw new Error('Stage the exact reviewed file set before running the public audit.');
  const extra=git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean);
  for(const name of extra)failures.push(`${name}: untracked file has not been reviewed/staged`);
  for(const name of tracked) {
    const file=path.join(directory,name);
    let bytes;
    try{if(!(await lstat(file)).isFile())throw new Error('Not regular');bytes=await readFile(file);}catch{failures.push(`${name}: missing or non-regular working file`);continue;}
    for(const reason of inspectFile(name,bytes,allowed))failures.push(`${name} (working): ${reason}`);
    const staged=Buffer.from(git('show',`:${name}`));
    for(const reason of inspectFile(name,staged,allowed))failures.push(`${name} (index): ${reason}`);
    if(!bytes.equals(staged))failures.push(`${name}: index and working file differ; stage the reviewed final bytes`);
    inventory.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  for(const name of allowed)if(!tracked.includes(name))failures.push(`${name}: approved inventory path is not staged/tracked`);
  const commits=git('rev-list','--all').trim().split('\n').filter(Boolean);
  const seen=new Set();
  for(const commit of commits) {
    for(const reason of inspectContent(Buffer.from(git('cat-file','commit',commit))))failures.push(`commit metadata ${commit.slice(0,8)}: ${reason}`);
    const entries=git('ls-tree','-r','-z',commit).split('\0').filter(Boolean);
    for(const entry of entries) {
      const [meta,name]=entry.split('\t'),[mode,type,hash]=meta.split(' '),key=`${name}:${hash}`;
      if(seen.has(key))continue;seen.add(key);
      if(type!=='blob'||mode!=='100644') {failures.push(`${name} (history): unexpected file mode/type`);continue;}
      const data=execFileSync('git',['-C',directory,'cat-file','blob',hash],{maxBuffer:32*1024*1024});
      for(const reason of inspectFile(name,data,allowed))failures.push(`${name} (history ${commit.slice(0,8)}): ${reason}`);
    }
  }
  const tags=git('for-each-ref','--format=%(objecttype) %(objectname)','refs/tags').trim().split('\n').filter(Boolean);
  for(const tag of tags) {
    const [type,hash]=tag.split(' ');
    if(type==='tag')for(const reason of inspectContent(Buffer.from(git('cat-file','tag',hash))))failures.push(`tag metadata ${hash.slice(0,8)}: ${reason}`);
  }
  const sample=await readFile(path.join(directory,'samples/library.json'));
  if(createHash('sha256').update(sample).digest('hex')!==manifest.originalSampleSha256)failures.push('Original sample bytes differ from their reviewed hash.');
  const result={checkedAt:new Date().toISOString(),passed:failures.length===0,reachableCommits:commits.length,historicalPathVersions:seen.size,files:inventory,failures,limits:'Heuristic scan plus exact inventory. Human provenance and file/history review are required; no automatic tool can prove the absence of copyrighted text or every secret.'};
  await mkdir(path.join(directory,'.reader'),{recursive:true});
  await writeFile(path.join(directory,'.reader/publication-review.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const report=await audit();console.log(JSON.stringify({passed:report.passed,files:report.files.map(f=>f.path),reachableCommits:report.reachableCommits,failures:report.failures},null,2));
  if(!report.passed)process.exitCode=1;
}
