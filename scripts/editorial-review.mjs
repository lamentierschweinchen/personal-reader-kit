import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function relative(value){
  if(!nonempty(value)||path.isAbsolute(value)||value.includes('\\')||value.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Use a relative file path within this project.');
  return value;
}
async function hashFile(root,name,jsonPointer){
  relative(name);
  const base=await realpath(root),target=path.join(base,name),resolved=await realpath(target);
  if(!resolved.startsWith(base+path.sep)||!(await lstat(target)).isFile())throw Error('Review inputs must be regular files within this project: '+name);
  const bytes=await readFile(target);
  if(jsonPointer===undefined)return digest(bytes);
  if(typeof jsonPointer!=='string'||!jsonPointer.startsWith('/')||/~(?![01])/u.test(jsonPointer))throw Error('Use an explicit JSON pointer for a mixed source file.');
  let value=JSON.parse(bytes.toString('utf8'));
  for(const encoded of jsonPointer.slice(1).split('/')){
    const key=encoded.replace(/~1/g,'/').replace(/~0/g,'~');
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('Protected JSON pointer is absent: '+name+'#'+jsonPointer);
    value=value[key];
  }
  return digest(JSON.stringify(value));
}
function entries(receipt){
  if(receipt?.schema!==1||!Array.isArray(receipt.authored)||!receipt.authored.length||!Array.isArray(receipt.protected)||!receipt.protected.length)throw Error('A receipt needs authored and protected file inventories.');
  const files=[...receipt.authored,...receipt.protected],seen=new Set();
  for(const file of files){
    relative(file.path);
    const identity=file.path+'#'+(file.jsonPointer??'');
    if(seen.has(identity)||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Duplicate path or invalid file hash: '+file.path);
    if(receipt.authored.includes(file)&&file.jsonPointer!==undefined)throw Error('Authored files are reviewed as complete files.');
    seen.add(identity);
  }
  return files;
}
export async function snapshot(root,{authored,protected:protectedFiles=[],protectedJson=[],surfaces=[]}){
  if(!authored?.length||!protectedFiles.length&&!protectedJson.length)throw Error('Name at least one authored and one protected source file.');
  const inventory=async files=>Promise.all(files.map(async name=>({path:relative(name),sha256:await hashFile(root,name)})));
  const selected=await Promise.all(protectedJson.map(async ref=>{const separator=ref.indexOf('#'),name=ref.slice(0,separator),jsonPointer=ref.slice(separator+1);if(separator<1)throw Error('Use file.json#/explicit/pointer for --protected-json.');return {path:relative(name),jsonPointer,sha256:await hashFile(root,name,jsonPointer)};}));
  const result={schema:1,authored:await inventory(authored),protected:[...await inventory(protectedFiles),...selected],voice:[],surfaces:surfaces.map(name=>({name,files:[],status:'pending',evidence:''})),findings:[],review:{by:'',at:'',summary:'',limits:[]}};
  entries(result);return result;
}
export async function refresh(root,receipt){
  entries(receipt);
  for(const file of receipt.protected)if(await hashFile(root,file.path,file.jsonPointer)!==file.sha256)throw Error('Protected source changed: '+file.path+(file.jsonPointer?'#'+file.jsonPointer:''));
  const result=structuredClone(receipt);
  for(const file of result.authored)file.sha256=await hashFile(root,file.path);
  result.surfaces=result.surfaces.map(s=>({...s,status:'pending',evidence:''}));
  result.review={by:'',at:'',summary:'',limits:receipt.review?.limits||[]};
  // Findings survive as working notes, but the surfaces and final review must be revisited.
  return result;
}
export async function check(root,receipt){
  const files=entries(receipt),failures=[];
  for(const file of files){
    try{if(await hashFile(root,file.path,file.jsonPointer)!==file.sha256)failures.push((receipt.protected.includes(file)?'Protected source changed: ':'Reviewed file changed: ')+file.path+(file.jsonPointer?'#'+file.jsonPointer:''));}
    catch(error){failures.push(error.message);}
  }
  if(!Array.isArray(receipt.voice)||!receipt.voice.length||receipt.voice.some(x=>!nonempty(x)))failures.push('Record the voice or functional register being preserved.');
  const authored=new Set(receipt.authored.map(x=>x.path)),covered=new Set(),names=new Set();
  if(!Array.isArray(receipt.surfaces)||!receipt.surfaces.length)failures.push('No rendered review scope was recorded.');
  for(const surface of receipt.surfaces||[]){
    if(!nonempty(surface.name)||names.has(surface.name))failures.push('Surface names must be unique and nonempty.');
    names.add(surface.name);
    if(!['reviewed','not-rendered'].includes(surface.status)||!nonempty(surface.evidence))failures.push('Unreviewed or unexplained surface: '+surface.name);
    if(!Array.isArray(surface.files)||!surface.files.length)failures.push('Surface has no authored source paths: '+surface.name);
    for(const name of surface.files||[]){if(!authored.has(name))failures.push('Surface references an undeclared authored file: '+name);else covered.add(name);}
  }
  for(const name of authored)if(!covered.has(name))failures.push('Authored file has no declared surface or exclusion: '+name);
  if(!(receipt.surfaces||[]).some(s=>s.status==='reviewed'))failures.push('At least one rendered surface must be reviewed; exclusions alone are not a reader review.');
  if(!Array.isArray(receipt.findings))failures.push('Findings must be an array; an empty list is valid.');
  for(const finding of receipt.findings||[]){
    if(!names.has(finding.surface)||!['cut','revise','relocate','retain'].includes(finding.disposition)||!['location','problem','reason'].every(k=>nonempty(finding[k])))failures.push('A finding lacks its location, surface, disposition or reason.');
  }
  const review=receipt.review;
  if(!review||!nonempty(review.by)||!nonempty(review.summary)||!nonempty(review.at)||!Number.isFinite(Date.parse(review.at))||!Array.isArray(review.limits)||review.limits.some(x=>!nonempty(x)))failures.push('Record who reviewed, when, the result and its limits.');
  return {complete:!failures.length,authored:receipt.authored.length,protected:receipt.protected.length,renderedSurfaces:(receipt.surfaces||[]).filter(s=>s.status==='reviewed').length,notRendered:(receipt.surfaces||[]).filter(s=>s.status==='not-rendered').map(s=>s.name),failures,limits:review?.limits||[],meaning:'Receipt coverage and file integrity only. Editorial judgment, factual accuracy, route reachability and reader benefit are not established by this check.'};
}

const help=`Editorial review receipts (run from the project root)

node scripts/editorial-review.mjs snapshot .reader/editorial/review.json \\
  --authored site/app.mjs --protected samples/library.json \\
  --surface Shelf --surface Companion
node scripts/editorial-review.mjs refresh .reader/editorial/review.json
node scripts/editorial-review.mjs check .reader/editorial/review.json

Snapshot before editing; repeat --authored, --protected and --surface as needed.
Mixed JSON may use --protected-json 'library.json#/0/sections'; explicitly name
every source/identity field to protect. Only those named fields are checked.
Keep the complete JSON file in --authored and review the diff for other changes.
After edits, refresh updates authored hashes and resets review attestations.
It refuses changed protected sources. Then inspect the final rendered surfaces
and fill the private JSON receipt: voice, surface files/status/evidence, findings,
review by/at/summary/limits. Use status reviewed or not-rendered (with a reason).
Findings use cut/revise/relocate/retain. Empty findings are valid.
Check fails on stale files, changed sources or incomplete coverage.
This tool does not extract or score prose, inspect the browser or certify quality.
Receipts stay under ignored .reader/ and may contain private editorial evidence.
`;
async function main(){
  const [command,output,...args]=process.argv.slice(2);
  if(!command||command==='--help'){console.log(help);return;}
  if(!['snapshot','refresh','check'].includes(command))throw Error('Unknown command. Use --help.');
  relative(output);
  if(!output.startsWith('.reader/')||!output.endsWith('.json'))throw Error('Store private receipts under .reader/ with a .json extension.');
  const root=process.cwd(),target=path.join(root,output);
  if(command==='snapshot'){
    const options={authored:[],protected:[],protectedJson:[],surfaces:[]};
    for(let i=0;i<args.length;i+=2){const key={'--authored':'authored','--protected':'protected','--protected-json':'protectedJson','--surface':'surfaces'}[args[i]];if(!key||!nonempty(args[i+1]))throw Error('Invalid snapshot option. Use --help.');options[key].push(args[i+1]);}
    const receipt=await snapshot(root,options);
    await mkdir(path.dirname(target),{recursive:true});
    if(!(await realpath(path.dirname(target))).startsWith((await realpath(root))+path.sep))throw Error('Receipt directory is outside this project.');
    await writeFile(target,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log('Private snapshot created. The review is pending.');return;
  }
  if(args.length)throw Error('Unexpected arguments. Use --help.');
  await hashFile(root,output); // Reject an external or symlinked receipt before reading/writing it.
  const receipt=JSON.parse(await readFile(target,'utf8'));
  if(command==='refresh'){await writeFile(target,JSON.stringify(await refresh(root,receipt),null,2)+'\n');console.log('Authored hashes refreshed. Inspect the final surfaces and complete the review again.');return;}
  const result=await check(root,receipt);console.log(JSON.stringify(result,null,2));if(!result.complete)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
