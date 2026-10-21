import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,readdir,lstat,realpath,rename,rm} from 'node:fs/promises';
import {validateBook,LIMIT,READER_PROFILE} from '../site/core.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DESTINATION='.reader/local-preview',KIND='personal-reader-local-preview@1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const relative=(root,name)=>path.relative(root,name).split(path.sep).join('/');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'};

async function regularPath(root,name,{directory=false,missing=false}={}) {
  const parts=name.split('/');
  check(parts.length&&parts.every(part=>part&&part!=='.'&&part!=='..'),'Use a path inside this project.');
  let current=root;
  for(let index=0;index<parts.length;index++) {
    current=path.join(current,parts[index]);
    let info;try{info=await lstat(current);}catch(error){if(missing&&error.code==='ENOENT')return false;throw error;}
    check(!info.isSymbolicLink(),`Local preview refuses symlinks: ${name}`);
    check(index<parts.length-1||directory?info.isDirectory():info.isFile(),`Expected a regular ${directory?'directory':'file'}: ${name}`);
  }
  return true;
}

async function privateBoundary(root,inputs) {
  await regularPath(root,'.reader',{directory:true});
  const manifest=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
  const paths=[...(manifest.files||[]),...(manifest.starterFiles||[]),...Object.values(manifest).filter(Array.isArray).flatMap(items=>items.filter(item=>item&&typeof item==='object').flatMap(item=>[item.path,item.license,item.provenance].filter(Boolean)))];
  check(!paths.some(name=>name==='.reader'||name.startsWith('.reader/')),'Remove private .reader paths from publication inventories before previewing.');
  const rules=(await readFile(path.join(root,'.gitignore'),'utf8')).split(/\r?\n/).map(line=>line.trim());
  check(rules.includes('.reader/')||rules.includes('/.reader/'),'Keep .reader/ ignored in the project .gitignore.');
  let gitRoot;
  try{gitRoot=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  if(gitRoot&&await realpath(gitRoot)===root) {
    for(const name of [...inputs,DESTINATION+'/site/library.json']) {
      let ignored=false;
      try{execFileSync('git',['check-ignore','--no-index','-q','--',name],{cwd:root,stdio:'ignore'});ignored=true;}catch{}
      check(ignored,`Keep this local path ignored before previewing: ${name}`);
      const tracked=execFileSync('git',['ls-files','--',name],{cwd:root,encoding:'utf8'}).trim();
      check(!tracked,`A private preview input/output is tracked by Git: ${name}. Review its history before continuing.`);
    }
  } else {
    // ZIP starters have no Git repository. Require the stock ignore boundary;
    // Git itself checks more elaborate rules once a personal repository exists.
    check(rules.filter(line=>line.startsWith('!')).every(line=>line==='!.env.example'),'For a ZIP starter, retain the stock .gitignore rules or initialize a local Git repository to verify custom rules.');
    for(const name of ['.reader/.gitignore'])check(!await regularPath(root,name,{missing:true}),'Review nested .reader ignore rules in a local Git repository before previewing.');
  }
}

async function previousOutput(root,files) {
  if(!await regularPath(root,DESTINATION,{directory:true,missing:true}))return;
  const folder=path.join(root,DESTINATION),names=(await readdir(folder)).sort();
  check(JSON.stringify(names)===JSON.stringify(['receipt.json','site']),'The local preview folder contains unrecognized files. Preserve them and move them aside before rebuilding.');
  await regularPath(root,DESTINATION+'/receipt.json');
  const receipt=JSON.parse(await readFile(path.join(folder,'receipt.json'),'utf8'));
  check(receipt.kind===KIND&&receipt.localOnly===true&&Array.isArray(receipt.files),'This folder is not a recognized disposable local preview. Nothing was replaced.');
  await regularPath(root,DESTINATION+'/site',{directory:true});
  const actual=(await readdir(path.join(folder,'site'))).sort();
  check(JSON.stringify(actual)===JSON.stringify([...files].sort()),'The local preview contains extra or missing files. Preserve it and review before rebuilding.');
  check(receipt.files.length===files.length&&new Set(receipt.files.map(file=>file.path)).size===files.length,'Invalid local preview inventory. Nothing was replaced.');
  for(const name of files) {
    await regularPath(root,DESTINATION+'/site/'+name);
    check(receipt.files.find(file=>file.path===name)?.sha256===sha(await readFile(path.join(folder,'site',name))),'A generated preview file was changed outside the helper. Preserve it before rebuilding.');
  }
}

export async function buildLocalPreview({inputs,projectRoot=ROOT,...unknown}={}) {
  check(!Object.keys(unknown).length,'Local preview has a fixed private destination; host/output overrides are not supported.');
  check(Array.isArray(inputs)&&inputs.length>0&&inputs.length<=200,'Name 1–200 prepared book JSON files inside ignored .reader/.');
  const root=await realpath(projectRoot),names=inputs.map(input=>relative(root,path.resolve(root,input)));
  check(names.every(name=>name.startsWith('.reader/')&&name.endsWith('.json')&&!name.split('/').includes('..')&&!name.startsWith(DESTINATION+'/')&&!name.startsWith('.reader/local-preview-build-')),'Inputs must be prepared JSON files inside ignored .reader/, outside preview output and receipts.');
  await privateBoundary(root,names);
  const books=[],sources=[];let bytesRead=0;
  for(const name of names) {
    await regularPath(root,name);
    const info=await lstat(path.join(root,name));check(info.size<=LIMIT,'Each prepared JSON file must be at most 8 MB. Use the existing adapter guidance for larger works.');
    const bytes=await readFile(path.join(root,name));bytesRead+=bytes.length;
    check(bytesRead<=64*1024*1024,'The selected prepared files exceed 64 MB. Preview fewer books at once.');
    let book;
    try{
      book=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      check(book.profile===undefined||book.profile===READER_PROFILE,'Unsupported profile.');
      validateBook(book);
    }catch(error){throw new Error(`Cannot preview ${name}: ${error.message} This helper accepts the stock text contract only. Preserve the source and follow docs/ADAPTERS.md for media, linked notes or another profile.`);}
    check(!['bell','rain'].includes(book.id),'The IDs bell and rain belong to the original samples. Use the prepared work’s own stable ID.');
    check(!books.some(existing=>existing.id===book.id),`Duplicate prepared book ID: ${book.id}. Keep both files and reconcile the editions before previewing.`);
    books.push(book);sources.push({path:name,sha256:sha(bytes),bytes:bytes.length,id:book.id});
  }
  const {build,assets}=await import(pathToFileURL(path.join(root,'scripts/build.mjs')));
  const files=[...assets,'library.json','sw.js'];
  for(const name of ['package.json','publication.json','vercel.json',...assets.map(name=>'site/'+name)])await regularPath(root,name);
  await previousOutput(root,files);
  const stage=await mkdtemp(path.join(root,'.reader/local-preview-build-'));
  let moved=false;
  try {
    const output=path.join(stage,'site'),original=await build({output});
    // Keep the stock worker's complete logic/file list. Its two version tokens
    // are replaced only after hashing the actual local library and assets.
    const library=Buffer.from(JSON.stringify(books));await writeFile(path.join(output,'library.json'),library,{mode:0o600});
    const hash=createHash('sha256').update(await readFile(path.join(root,'vercel.json')));
    for(const name of [...assets,'library.json'])hash.update(name).update(await readFile(path.join(output,name)));
    const version=hash.digest('hex').slice(0,16),worker=await readFile(path.join(output,'sw.js'),'utf8');
    check(/^[a-f0-9]{16}$/.test(original.version)&&worker.split(original.version).length===3,'The public worker format changed. Review local-preview versioning before continuing.');
    await writeFile(path.join(output,'sw.js'),worker.replaceAll(original.version,version));
    const receipt={kind:KIND,localOnly:true,personalBooksIncluded:true,version,sources,files:await Promise.all(files.map(async name=>({path:name,sha256:sha(await readFile(path.join(output,name)))})))};
    await writeFile(path.join(stage,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
    // Recheck ownership immediately before replacing only our generated output.
    await previousOutput(root,files);
    if(await regularPath(root,DESTINATION,{directory:true,missing:true}))await rm(path.join(root,DESTINATION),{recursive:true});
    await rename(stage,path.join(root,DESTINATION));moved=true;
    return {...receipt,output:path.join(root,DESTINATION,'site')};
  }finally{if(!moved)await rm(stage,{recursive:true,force:true});}
}

export async function startLocalPreview({inputs,port=4183,projectRoot=ROOT,...unknown}={}) {
  check(!Object.keys(unknown).length,'Local preview accepts no host/output overrides.');
  check(Number.isInteger(port)&&port>=0&&port<=65535&&port!==4173,'Use a separate stable loopback port, such as 4183 (not the sample server’s 4173).');
  let ready,origin;
  const server=http.createServer(async(req,res)=>{
    if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end('Local preview only.');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    if(!ready){res.writeHead(503);res.end('Preparing local preview.');return;}
    try {
      const url=new URL(req.url,origin),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
      check(url.origin===origin&&ready.bytes.has(name),'Not found');
      const bytes=ready.bytes.get(name);
      for(const rule of ready.headers)if(rule.source==='/(.*)'||rule.source==='/'+name)for(const header of rule.headers)res.setHeader(header.key,header.value);
      res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.writeHead(200);res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  let stopped=false;
  const stop=async()=>{if(stopped)return;stopped=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));};
  try {
    const receipt=await buildLocalPreview({inputs,projectRoot});
    const {headers}=JSON.parse(await readFile(path.join(projectRoot,'vercel.json'),'utf8'));
    const bytes=new Map();
    for(const file of receipt.files) {
      await regularPath(receipt.output,file.path);
      const content=await readFile(path.join(receipt.output,file.path));
      check(sha(content)===file.sha256,'Local preview changed during startup. Stop the competing build and retry; no mixed edition will be served.');
      bytes.set(file.path,content);
    }
    // Another preview may rebuild the disposable folder. Each listening origin
    // keeps the exact edition, worker and assets verified for its own receipt.
    ready={...receipt,headers,bytes};
    return {origin,receipt,stop};
  }catch(error){await stop();throw error;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const inputs=process.argv.slice(2);
  if(inputs.length===1&&inputs[0]==='--help')console.log('PORT=4183 npm run preview:local -- .reader/prepared/book.reader.json [another.reader.json]\nPrepared text editions only. Output: ignored .reader/local-preview/. Loopback only; nothing is uploaded. Keep this port for this reader and export private bundles before moving.');
  else try {
    check(inputs.length&&!inputs.some(input=>input.startsWith('-')),'Name prepared JSON files inside ignored .reader/. Use --help for the local preview command.');
    check(!process.env.HOST||process.env.HOST==='127.0.0.1','Local preview cannot bind a public/LAN host.');
    const port=Number(process.env.PORT||4183);check(port>0,'Choose a stable PORT; automatic port selection is only for isolated tests.');
    const preview=await startLocalPreview({inputs,port});
    console.log(`Local reader: ${preview.origin}\n${preview.receipt.sources.length} prepared book(s). Private output: ${DESTINATION}/\nNothing was uploaded. Keep this address for saved reading; Ctrl+C stops the server, not browser storage.`);
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void preview.stop();});
  }catch(error){console.error(error.message);process.exitCode=1;}
}
