import {readFile,mkdir,rm,copyFile,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {validateEdition} from '../site/core.mjs';
const root=new URL('../',import.meta.url);
export const assets=['index.html','app.mjs','core.mjs','style.css','icon.svg','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
export async function build(){
 const source=new URL('edition/edition.json',root),lock=JSON.parse(await readFile(new URL('edition-lock.json',root),'utf8'));
 assert.ok((await lstat(source)).isFile());const bytes=await readFile(source);assert.equal(createHash('sha256').update(bytes).digest('hex'),lock.sha256,'Only the reviewed editorial edition may build');const edition=validateEdition(JSON.parse(bytes));
 const out=new URL('dist/',root);await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});const hash=createHash('sha256').update(bytes);
 for(const f of assets){const input=new URL('site/'+f,root);assert.ok((await lstat(input)).isFile());hash.update(await readFile(input));await copyFile(input,new URL(f,out));}
 const revision=hash.digest('hex').slice(0,16);await writeFile(new URL('edition.json',out),JSON.stringify({...edition,revision}));await writeFile(new URL('build.json',out),JSON.stringify({revision,authors:edition.authors.length,items:edition.authors.reduce((n,a)=>n+a.items.length,0),arguments:edition.arguments.length,moments:edition.moments.length}));
 const result={files:[...assets,'edition.json','build.json'],revision};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
