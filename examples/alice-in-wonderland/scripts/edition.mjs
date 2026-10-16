// Project-only gate. The upstream original-samples gate is retained separately.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook} from '../site/core.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function inspectEdition(root){
  const bytes=await readFile(new URL('edition/library.json',root));
  const receipt=JSON.parse(await readFile(new URL('edition/assets.json',root),'utf8'));
  const publication=JSON.parse(await readFile(new URL('publication.json',root),'utf8'));
  if(sha(bytes)!==receipt.librarySha256||sha(bytes)!==publication.editionSha256)throw new Error('Edition bytes are not the explicitly reviewed public-domain candidate.');
  const books=JSON.parse(bytes).map(validateBook);
  if(books.length!==1||books[0].id!=='alice-rackham-28885'||books[0].source.sha256!==receipt.source.sha256)throw new Error('Wrong source edition.');
  const book=books[0],assets=book.assets;
  if(assets.length!==38||new Set(receipt.images.map(a=>a.id)).size!==38||receipt.images.length!==38)throw new Error('The exact reviewed image inventory changed.');
  for(const a of assets){
    const entry=receipt.images.find(i=>i.id===a.id),data=Buffer.from(a.data,'base64');
    if(!entry||sha(data)!==entry.sha256||sha(data)!==a.sha256||data.length!==entry.bytes||a.alt!==entry.alt||a.mime!==entry.mime||a.width!==entry.width||a.height!==entry.height)throw new Error(`Image provenance mismatch: ${a.id}`);
    if(a.mime==='image/png'?!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):!(data[0]===255&&data[1]===216&&data.at(-2)===255&&data.at(-1)===217))throw new Error(`Invalid binary signature: ${a.id}`);
    const uses=book.sections.flatMap(s=>s.blocks.flatMap(b=>['figure','initial'].filter(k=>b[k]?.asset===a.id).map(role=>({section:s.id,block:b.id,role}))));
    if(JSON.stringify(uses)!==JSON.stringify(entry.uses)||!uses.length)throw new Error(`Image source coverage changed: ${a.id}`);
  }
  return {bytes,book,receipt};
}
