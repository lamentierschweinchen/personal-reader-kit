import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
if(!process.env.TEST_BASE&&!process.argv.includes('--skip-build'))await buildShowcase();
const server=process.env.TEST_BASE?null:await serve();
const base=(process.env.TEST_BASE||'http://127.0.0.1:'+server.address().port).replace(/\/$/,'');
try{
 for(const slug of ['alice','odyssey','dracula']){
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[fileURLToPath(new URL('check-'+slug+'-game.mjs',import.meta.url))],{stdio:'inherit',env:{...process.env,TEST_URL:base+'/'+slug+'/play/'}});
   child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(slug+' gameplay check failed: '+code)));
  });
 }
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
