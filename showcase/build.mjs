import {mkdir,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('./',import.meta.url));
// Exact public inputs only. Never recursively copy a working directory.
export const files=['index.html','style.css','start.mjs','start.txt','favicon.svg','assets/book.webp','assets/fraunces-normal.woff2','assets/fraunces-italic.woff2','assets/OFL.txt','assets/austen-cover.jpg','assets/alice-rabbit.png','assets/walden-survey.jpg'];
const output=path.join(root,'dist');
await rm(output,{recursive:true,force:true});
for(const file of files){await mkdir(path.dirname(path.join(output,file)),{recursive:true});await copyFile(path.join(root,file),path.join(output,file));}
console.log('Showcase built: '+files.length+' explicit public files. Clipboard helper only; no analytics or reading storage.');
