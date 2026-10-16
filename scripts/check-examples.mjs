import {readFile,readdir,lstat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const publication=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=path.join(root,'.reader/examples-review.json');
await mkdir(path.dirname(receipt),{recursive:true});
await writeFile(receipt,JSON.stringify({passed:false,reason:'Example verification has not completed.'})+'\n');
let catalogue;
try {catalogue=JSON.parse(await readFile(path.join(root,'examples/catalog.json'),'utf8'));}
catch(error) {
  if(error.code!=='ENOENT'||publication.files.includes('examples/catalog.json'))throw error;
  await writeFile(receipt,JSON.stringify({passed:null,skipped:true,reason:'Optional examples are excluded from this starter.'})+'\n');
  console.log('This starter does not include the optional example collection.');
  process.exit(0);
}
if(catalogue.schema!==1||!Array.isArray(catalogue.examples)||!catalogue.examples.length)throw Error('Invalid example catalogue.');
const run=(command,args,cwd)=>{
  const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error([command,...args].join(' ')+' failed:\n'+result.stdout+'\n'+result.stderr);
  return result.stdout;
};
const list=async(directory,prefix='')=>{
  const files=[];
  for(const entry of await readdir(path.join(directory,prefix),{withFileTypes:true})){
    const name=path.posix.join(prefix,entry.name);
    if(entry.isDirectory())files.push(...await list(directory,name));
    else if(entry.isFile())files.push(name);
    else throw Error('Non-regular build output: '+name);
  }
  return files.sort();
};
const reports=[];
for(const example of catalogue.examples){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(example.id)||example.directory!=='examples/'+example.id||!(/^[a-f0-9]{40}$/).test(example.sourceCommit))throw Error('Unsafe example entry.');
  const cwd=path.join(root,example.directory);
  if(!(await lstat(cwd)).isDirectory()||!publication.files.includes(example.directory+'/package.json'))throw Error('Example is not in the publication inventory.');
  const pkg=JSON.parse(await readFile(path.join(cwd,'package.json'),'utf8'));
  for(const command of example.browserCommands){
    const entry=pkg.scripts[command]?.match(/^node (tests\/[a-zA-Z0-9.-]+\.mjs)$/)?.[1];
    if(!entry||!(await lstat(path.join(cwd,entry))).isFile())throw Error(example.id+': missing browser entry point '+command);
  }
  const tests=run('npm',['test'],cwd),matches=tests.match(/(?:#|ℹ) tests (\d+)/g);
  if(!matches)throw Error(example.id+': successful test command did not report its test count.');
  run('npm',['run','build'],cwd);
  const actual=await list(path.join(cwd,'dist'));
  if(JSON.stringify(actual)!==JSON.stringify(example.reviewedBuild.map(f=>f.path).sort()))throw Error(example.id+': build output inventory changed.');
  for(const file of example.reviewedBuild){
    if(!actual.includes(file.path)||file.path.split('/').includes('..'))throw Error('Unsafe reviewed output.');
    const bytes=await readFile(path.join(cwd,'dist',file.path));
    if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error(example.id+': output differs from reviewed reader: '+file.path);
  }
  const report={id:example.id,nodeTests:Number(matches?.at(-1)?.split(' ').at(-1)),outputs:actual.length,sourceCommit:example.sourceCommit,exactReviewedBuild:true};
  reports.push(report);console.log(JSON.stringify(report));
}
await writeFile(receipt,JSON.stringify({checkedAt:new Date().toISOString(),passed:true,examples:reports,limits:'Node checks and byte-identical builds. Browser, physical-device, editorial and rights evidence are separate; no live deployment is implied.'},null,2)+'\n');
