import {mkdir,copyFile,rm,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('./',import.meta.url));
// Exact public inputs only. Never recursively copy a working directory.
export const files=['index.html','learn/index.html','style.css','start.mjs','start.txt','favicon.svg','personal/index.html','personal/style.css','personal/favicon.svg','personal/app.mjs','assets/personal-alice-reader.jpg','assets/personal-canetti-map.jpg','assets/personal-walden-reader.jpg','assets/book.webp','assets/bricolage-grotesque.woff2','assets/OFL-Bricolage.txt','assets/fraunces-normal.woff2','assets/fraunces-italic.woff2','assets/OFL.txt','assets/austen-cover.jpg','assets/alice-rabbit.png','assets/walden-survey.jpg','assets/two-halls-portraits.webp','assets/read-share.jpg','assets/personal-share.jpg','assets/personal-opening-share.jpg'];
export async function buildShowcase({readers=true,output=path.join(root,'dist')}={}) {
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
