import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {validateBook,anchorStatus} from '../site/core.mjs';
import {sessions,sessionPassage,readingCues,cuePassages} from '../site/lectures.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const editionInputs=['editions/inventory.json','editions/hegel.json','editions/schopenhauer.json'];
export async function verifiedEditions(root){
 const inventory=JSON.parse(await readFile(path.join(root,editionInputs[0]),'utf8'));
 const entries=inventory.assets.filter(a=>!a.path.startsWith('embedded:'));
 if(JSON.stringify(entries.map(a=>a.path).sort())!==JSON.stringify(editionInputs.slice(1).sort()))throw Error('The edition inventory must name exactly the two reviewed editions.');
 const books=[],embedded=[];
 for(const entry of entries){
   const file=path.join(root,entry.path);if(!(await lstat(file)).isFile())throw Error('Edition must be a regular file.');
   const bytes=await readFile(file);if(digest(bytes)!==entry.sha256||bytes.length!==entry.bytes)throw Error('Edition bytes differ from their reviewed inventory: '+entry.path);
   const book=validateBook(JSON.parse(bytes));if(book.source.format!=='text/html'||book.source.sha256!==entry.sourceSha256)throw Error('Source identity mismatch.');
   for(const section of book.sections)for(const block of section.blocks)if(block.illustration){
     const bytes=Buffer.from(block.illustration.data.split(',')[1],'base64'),sha=digest(bytes),match=inventory.assets.find(a=>a.path.startsWith(`embedded:${book.id}:`)&&a.sha256===sha);
     if(!match||sha!==block.illustration.sha256||bytes.length!==match.bytes)throw Error('Unreviewed embedded source image.');
     if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Unexpected image format.');
     embedded.push(match.path);
   }
   books.push(book);
 }
 if(new Set(embedded).size!==5||embedded.length!==5||inventory.assets.filter(a=>a.path.startsWith('embedded:')).length!==5)throw Error('Source image inventory is not exact.');
 for(const session of sessions)for(const side of session.sides){const p=sessionPassage(side,books);if(!p||!anchorStatus(p,books.find(b=>b.id===side.book)).valid)throw Error('A paired reading does not match its source.');}
 for(const session of sessions)for(const [index] of readingCues[session.id].entries())cuePassages(session,index,books);
 return books;
}
