import {spawnSync} from 'node:child_process';
import {mkdir,realpath,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateBook,LIMIT} from '../site/core.mjs';

export async function prepareEpub(input,{python='python3'}={}) {
  const source=path.resolve(input),info=await stat(source);
  if(!info.isFile()||info.size>64*1024*1024)throw new Error('Use a regular EPUB file no larger than 64 MB. Nothing was written.');
  const script=fileURLToPath(new URL('./prepare-epub.py',import.meta.url));
  const run=spawnSync(python,[script,source],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:30000});
  if(run.error||run.status!==0)throw new Error('Local EPUB inspection could not finish. Python 3.10+ is required; oversized or invalid archives may need a separate adapter. No candidate was written.');
  const value=JSON.parse(run.stdout);
  if(value.book)try {
    value.book=validateBook(value.book);
    if(Buffer.byteLength(JSON.stringify(value.book))>LIMIT)throw new Error('The prepared JSON exceeds the 8 MB browser import limit. Split it with a fidelity review.');
  }catch(error){value.book=null;value.report.status='needs-adapter';value.report.candidate=false;value.report.issues.push({code:'reader-contract',detail:error.message});}
  return value;
}

export async function savePreparation(value) {
  const root=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(root,'.reader','private');
  await mkdir(parent,{recursive:true,mode:0o700});
  if(await realpath(parent)!==parent)throw new Error('Private output must remain inside the real local project directory.');
  const name=`epub-${value.report.sourceSha256.slice(0,24)}-${randomUUID()}`,directory=path.join(parent,name);
  await mkdir(directory,{mode:0o700});
  await writeFile(path.join(directory,'receipt.json'),JSON.stringify(value.report,null,2)+'\n',{flag:'wx',mode:0o600});
  if(value.book)await writeFile(path.join(directory,'edition.reader.json'),JSON.stringify(value.book),{flag:'wx',mode:0o600});
  return `.reader/private/${name}`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==3)throw new Error('Usage: npm run import:epub -- /path/to/book.epub');
    const value=await prepareEpub(process.argv[2]),output=await savePreparation(value);
    console.log(`${value.book?'Provisional edition and private receipt':'Private inspection receipt only'}: ${output}/`);
    console.log(value.book?'Compare the edition with the original EPUB before browser import. No upload, publication or proofreading occurred.':`No edition was produced. Adapter review needed: ${value.report.issues.map(i=>i.code).join(', ')}. Read the private receipt; the source is unchanged.`);
    if(!value.book)process.exitCode=2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
