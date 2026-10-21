import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function serve({port=Number(process.env.PORT||4495)}={}){
  const built=await build(),config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
  const snapshot=new Map(await Promise.all(built.files.map(async name=>[name,await readFile(path.join(root,'dist',name))])));
  const server=http.createServer((req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const u=new URL(req.url,'http://localhost'),name=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1),bytes=snapshot.get(name);
      if(!bytes)throw Error('Not found');
      for(const rule of config.headers)if(rule.source==='/(.*)'||rule.source==='/'+name)for(const h of rule.headers)res.setHeader(h.key,h.value);
      res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');
      if(!res.hasHeader('Cache-Control'))res.setHeader('Cache-Control','no-cache');
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,built,base:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {base,built}=await serve();console.log(`Nietzsche in company · ${base} · ${built.version}`);}
