import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';
const output=await build(),allowed=new Set(output.files);
const root = fileURLToPath(new URL('../dist/',import.meta.url));
const config = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'};
const port = Number(process.env.PORT || 4173);
http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    const url = new URL(req.url,'http://localhost'), name = url.pathname === '/' ? 'index.html' : url.pathname === '/play/' ? 'play/index.html' : decodeURIComponent(url.pathname).slice(1);
    // Only exact reviewed build outputs are served, including the game directory.
    if (!allowed.has(name)) throw new Error('Not found');
    const data = await readFile(path.join(root,name));
    for (const h of config.headers[0].headers) res.setHeader(h.key,h.value);
    res.setHeader('Content-Type',types[path.extname(name)] || 'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.writeHead(200);res.end(req.method === 'HEAD' ? undefined : data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Reading: http://127.0.0.1:${port} (local only)`));
