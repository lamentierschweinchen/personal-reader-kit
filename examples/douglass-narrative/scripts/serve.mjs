import {createServer} from 'node:http';
import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build,outputFiles} from './build.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
export async function startServer({port=0}={}){
  // An immutable in-memory snapshot of the exact build outputs. Neither source,
  // arbitrary dist files, private preparation nor Git metadata can be requested.
  const files=new Map();
  for(const name of outputFiles){const p=path.join(root,'dist',name);if(!(await lstat(p)).isFile())throw Error('Expected regular build output: '+name);files.set('/'+name,await readFile(p));}
  const config=JSON.parse(await readFile(path.join(root,'vercel.json'))),general=Object.fromEntries(config.headers.find(r=>r.source==='/(.*)').headers.map(h=>[h.key,h.value]));
  const workerHeaders=Object.fromEntries(config.headers.find(r=>r.source==='/sw.js').headers.map(h=>[h.key,h.value]));
  const server=createServer((request,response)=>{
    let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400,general);response.end();return;}
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...general,Allow:'GET, HEAD'});response.end();return;}
    const key=pathname==='/'?'/index.html':pathname,bytes=files.get(key);
    if(!bytes){response.writeHead(404,general);response.end('Not found');return;}
    response.writeHead(200,{...general,...(key==='/sw.js'?workerHeaders:{}),'Content-Type':types[path.extname(key)]||'application/octet-stream','Content-Length':bytes.length});
    response.end(request.method==='HEAD'?undefined:bytes);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  await build();const server=await startServer({port:Number(process.env.PORT||4483)});console.log(`Douglass preview: ${server.url}`);
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
}
