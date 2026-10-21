import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from './build.mjs';
if(!process.argv.includes('--no-build'))await build();
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const port=Number(process.env.PORT||4572);
http.createServer(async(req,res)=>{try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const name=new URL(req.url,'http://localhost').pathname;const file=name==='/'?'index.html':decodeURIComponent(name).slice(1);
  if(!/^[a-zA-Z0-9_.-]+$/.test(file)||file.startsWith('.'))throw Error('Not found');
  const bytes=await readFile(path.join(root,file));for(const h of config.headers[0].headers)res.setHeader(h.key,h.value);
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.writeHead(200);res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Illustrated reader: http://127.0.0.1:${port}/ · process ${process.pid}`));
