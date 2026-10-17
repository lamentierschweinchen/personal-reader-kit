import {readFile,copyFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export async function copyGame(root,out){
 const manifest=JSON.parse(await readFile(path.join(root,'game.json'),'utf8')),seen=new Set(),files=[];
 if(!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Missing reviewed game inventory.');
 for(const file of manifest.files){
  if(!/^[a-z0-9][a-z0-9.-]*$/.test(file.path)||seen.has(file.path))throw Error('Unsafe or repeated game file.');
  seen.add(file.path);const source=path.join(root,'play',file.path);
  if(!(await lstat(source)).isFile())throw Error('Game input must be a regular file.');
  const bytes=await readFile(source);if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Game input differs from its reviewed inventory: '+file.path);
  await mkdir(path.join(out,'play'),{recursive:true});await copyFile(source,path.join(out,'play',file.path));files.push('play/'+file.path);
 }return files;
}
