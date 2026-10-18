import {mkdir,copyFile,rm,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildLibrary} from './library/render.mjs';

const root=fileURLToPath(new URL('./',import.meta.url));
// Exact public inputs only. Never recursively copy a working directory.
export const files=['library/index.html','library/style.css','library/app.mjs','index.html','learn/index.html','style.css','home.mjs','learn.mjs','handoff.mjs','covers.mjs','start.txt','favicon.svg','personal/index.html','personal/style.css','personal/favicon.svg','personal/app.mjs','assets/book.webp','assets/fraunces-normal.woff2','assets/fraunces-italic.woff2','assets/OFL.txt','assets/austen-cover.jpg','assets/alice-rabbit.png','assets/walden-survey.jpg','assets/two-halls-portraits.webp','assets/read-share.jpg','assets/personal-share.jpg','assets/personal-canetti-map.png','assets/personal-opening-share.jpg','assets/play-homeward.jpg','assets/reader-keep.jpg','assets/favicon-32.png','assets/apple-touch-icon.png','assets/im-fell-normal.woff2','assets/im-fell-italic.woff2','assets/reenie-beanie.woff2','assets/martian-mono-normal.woff2','assets/piazzolla-normal.woff2','assets/piazzolla-italic.woff2','assets/OFL-IMFell.txt','assets/OFL-ReenieBeanie.txt','assets/OFL-MartianMono.txt','assets/OFL-Piazzolla.txt'];
export async function buildShowcase({readers=true,output=path.join(root,'dist')}={}) {
  await buildLibrary();
  await rm(output,{recursive:true,force:true});
  for(const file of files){
    const input=path.join(root,file);
    if(!(await lstat(input)).isFile())throw Error('Showcase inputs must be regular files: '+file);
    await mkdir(path.dirname(path.join(output,file)),{recursive:true});await copyFile(input,path.join(output,file));
  }
  const editions=readers?await (await import('./readers.mjs')).buildReaders(output):[];
  const result={catalogueFiles:files.length,readers:editions,personalBooksIncluded:false};
  console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildShowcase();
