// Loopback development/check server for the exact static output.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
export async function serve(port=0){
  const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url),'utf8')).routes.find(r=>r.headers?.['Content-Security-Policy']).headers;
  return new Promise(resolve=>{
    const server=createServer(async(req,res)=>{
      try{
        const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
        let file=path.resolve(root,'.'+pathname);
        if(file!==root&&!file.startsWith(root+path.sep))throw Error('Outside build');
        if((await stat(file)).isDirectory()){
          if(!pathname.endsWith('/')){res.writeHead(308,{Location:pathname+'/'+url.search});res.end();return;}
          file=path.join(file,'index.html');
        }
        const data=await readFile(file);
        res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store',...security});res.end(data);
      }catch{res.writeHead(404);res.end('Not found');}
    });server.listen(port,'127.0.0.1',()=>resolve(server));
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await serve(Number(process.env.PORT||4311));console.log('New reading: http://127.0.0.1:'+server.address().port);}
