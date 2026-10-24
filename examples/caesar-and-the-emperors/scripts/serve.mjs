import{createServer}from'node:http';import{readFile,lstat}from'node:fs/promises';import{fileURLToPath}from'node:url';import path from'node:path';import{build,outputFiles}from'./build.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain; charset=utf-8'};
export async function startServer({port=0}={}){
 const files=new Map();for(const name of outputFiles){let current=path.join(root,'dist');const directory=await lstat(current);if(directory.isSymbolicLink()||!directory.isDirectory())throw Error('Build output must be a real directory');for(const part of name.split('/')){current=path.join(current,part);const s=await lstat(current);if(s.isSymbolicLink())throw Error('Build output must not traverse symlinks');}if(!(await lstat(current)).isFile())throw Error('Expected regular build output: '+name);files.set('/'+name,await readFile(current));}
 const config=JSON.parse(await readFile(path.join(root,'vercel.json'))),general=Object.fromEntries(config.headers.find(r=>r.source==='/(.*)').headers.map(h=>[h.key,h.value])),worker=Object.fromEntries(config.headers.find(r=>r.source==='/sw.js').headers.map(h=>[h.key,h.value]));let origin;
 const server=createServer((req,res)=>{
  if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403,general);res.end('Loopback preview only');return;}
  let name;try{name=decodeURIComponent(new URL(req.url,origin).pathname);}catch{res.writeHead(400,general);res.end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...general,Allow:'GET, HEAD'});res.end();return;}
  const key=name==='/'?'/index.html':['/sources','/sources/'].includes(name)?'/sources/index.html':name,bytes=files.get(key);if(!bytes){res.writeHead(404,general);res.end('Not found');return;}
  res.writeHead(200,{...general,...(key==='/sw.js'?worker:{}),'Content-Type':types[path.extname(key)]||'application/octet-stream','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});origin='http://127.0.0.1:'+server.address().port;
 return{url:origin,close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await build();const server=await startServer({port:Number(process.env.PORT||4495)});console.log('Roman preview: '+server.url);for(const signal of['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});}
