import {anchorStatus} from './core.mjs';

// Deliberately project only the chosen source words and their attribution.
// Never serialize the note, library, device URL, or private edition fingerprint.
export function passageShareData(passage,book) {
  const status=anchorStatus(passage,book);
  if(!status.valid)throw new Error('Restore this passage’s exact edition before sharing it with attribution.');
  const attribution=[book.author?`${book.author} · ${book.title}`:book.title,status.section.title,book.edition].filter(Boolean).join('\n');
  return {title:book.title,text:`${passage.quote}\n\n— ${attribution}`};
}

export async function sharePassage(data,device=globalThis.navigator) {
  if(typeof device?.share!=='function')return 'unavailable';
  try {
    if(typeof device.canShare==='function'&&!device.canShare(data))return 'unavailable';
    // Invoke synchronously within the originating click's user activation.
    await device.share(data);
    return 'opened'; // A resolved share promise does not prove delivery.
  } catch(error) {return error?.name==='AbortError'?'cancelled':'unavailable';}
}

export async function copyPassage(data,device=globalThis.navigator) {
  if(typeof device?.clipboard?.writeText!=='function')return false;
  try {await device.clipboard.writeText(data.text);return true;}catch{return false;}
}
