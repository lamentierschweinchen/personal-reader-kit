import {readFile,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectFile} from './audit.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function safeName(name) {
  if(typeof name!=='string'||name.length>240||!name||name.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-zA-Z0-9_.\/-]+$/.test(name)||name.split('/').includes('.git')||inspectFile(name,Buffer.alloc(0),[name]).length)throw new Error('Unsafe publication path; no files compared.');
}
async function readRegular(root,name,optional=false) {
  safeName(name);let current=root;
  for(const part of name.split('/')) {
    current=path.join(current,part);
    try {const stat=await lstat(current);if(stat.isSymbolicLink())throw new Error(`Symlink at reviewed path ${name}; compare manually.`);}
    catch(error){if(optional&&error.code==='ENOENT')return null;throw error;}
  }
  const stat=await lstat(current);if(!stat.isFile()||stat.size>16*1024*1024)throw new Error(`Non-regular or oversized reviewed file: ${name}`);
  return readFile(current);
}
async function inventory(root) {
  const value=JSON.parse(await readRegular(root,'publication.json')),files=value.files;
  if(!Array.isArray(files)||!files.length||files.length>2000||new Set(files).size!==files.length)throw new Error('Invalid publication inventory.');
  files.forEach(safeName);return files;
}
// Only named public kit files are read. No enumeration of a personal reader's
// directories, content output, copying, Git mutation or deployment occurs.
export async function compareUpgrade({base,current,target}) {
  [base,current,target]=await Promise.all([base,current,target].map(p=>realpath(p)));
  if(new Set([base,current,target]).size!==3)throw new Error('Base, personalized reader and target must be three different directories.');
  const before=await inventory(base),after=await inventory(target),rows=[];
  for(const name of [...new Set([...before,...after])].sort()) {
    const [old,local,next]=await Promise.all([before.includes(name)?readRegular(base,name):null,readRegular(current,name,true),after.includes(name)?readRegular(target,name):null]);
    const hashes={base:old===null?null:digest(old),current:local===null?null:digest(local),target:next===null?null:digest(next)};
    const status=hashes.current===hashes.target?'already-current':hashes.target===hashes.base?'keep-local':hashes.current===hashes.base?'upstream-only':'review-conflict';
    const operation=next===null?'remove':old===null?'add':'change';
    rows.push({path:name,status,operation,...hashes});
  }
  return {mode:'read-only',scope:'Union of the two reviewed public inventories only; private and extra local files are not inspected.',summary:Object.fromEntries(['already-current','keep-local','upstream-only','review-conflict'].map(status=>[status,rows.filter(r=>r.status===status).length])),files:rows};
}
async function cleanRevision(directory) {
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  if(await realpath(git('rev-parse','--show-toplevel'))!==await realpath(directory))throw new Error('Base and target must be repository roots.');
  if(git('status','--porcelain','--untracked-files=all'))throw new Error('Base and target must be clean, reviewed kit checkouts.');
  return git('rev-parse','HEAD');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i+=2) {
      if(!['--base','--target','--current'].includes(args[i])||!args[i+1]||Object.hasOwn(options,args[i]))throw new Error('Use --base PATH --target PATH and optional --current PATH.');
      options[args[i]]=path.resolve(args[i+1]);
    }
    if(!options['--base']||!options['--target'])throw new Error('Usage: npm run upgrade:check -- --base /path/to/original-kit --target /path/to/reviewed-new-kit');
    const base=options['--base'],target=options['--target'],current=options['--current']||fileURLToPath(new URL('../',import.meta.url));
    const revisions={base:await cleanRevision(base),target:await cleanRevision(target)},report=await compareUpgrade({base,current,target});
    console.log(JSON.stringify({...report,revisions},null,2));
    if(report.summary['review-conflict'])process.exitCode=2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
