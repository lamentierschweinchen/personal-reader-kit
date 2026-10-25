// Public metadata only. Cards reuse the reviewed covers, never browser reading data.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export const editions=JSON.parse(await readFile(new URL('./library/entries.json',import.meta.url),'utf8')).editions;
export const socialCards=JSON.parse(await readFile(new URL('./social-previews.json',import.meta.url),'utf8')).cards;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const origin='https://newreading.app';

export async function validateSocialCards(){
  assert.deepEqual(Object.keys(socialCards).sort(),[...editions.map(b=>b.id),'library'].sort(),'Every library item needs its own reviewed social card');
  for(const [id,card] of Object.entries(socialCards)){
    assert.equal(card.id,id);assert.equal(card.file,`assets/social-${id}.jpg`);
    assert.equal(card.width,1200);assert.equal(card.height,630);
    assert.ok(card.alt?.trim());assert.match(card.sha256,/^[a-f0-9]{64}$/);
    const b=editions.find(b=>b.id===id);
    if(b)for(const [key,value] of Object.entries({title:b.title,author:b.shortAuthor,feature:b.feature}))assert.equal(card[key],value,`Social image needs review after ${id} ${key} changes`);
    const bytes=await readFile(new URL(card.file,import.meta.url));
    assert.equal(bytes.length,card.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),card.sha256);
  }
}

export function socialMetadata(id,{listing=false}={}){
  const card=socialCards[id];assert.ok(card,'Missing social card: '+id);
  const b=editions.find(b=>b.id===id);
  return {
    title:b?`${b.title} · New reading`:'The library · New reading',
    description:b?`${b.author}. ${b.description}`:'Books prepared by readers, for readers. Browse complete books and meetings of writers, then share an edition of your own.',
    url:origin+(id==='library'?'/library/':listing?`/library/${id}/`:`/${id}/`),
    image:`${origin}/${card.file}?v=${card.sha256.slice(0,12)}`,
    alt:card.alt,width:card.width,height:card.height
  };
}

export function injectSocialMetadata(html,metadata){
  const tags=[`<title>${escape(metadata.title)}</title>`,
    `<meta name="description" content="${escape(metadata.description)}">`,
    `<link rel="canonical" href="${escape(metadata.url)}">`];
  const properties={title:metadata.title,description:metadata.description,type:'website',url:metadata.url,site_name:'New reading',image:metadata.image,'image:type':'image/jpeg','image:width':metadata.width,'image:height':metadata.height,'image:alt':metadata.alt};
  for(const [key,value] of Object.entries(properties))tags.push(`<meta property="og:${key}" content="${escape(value)}">`);
  for(const [key,value] of Object.entries({card:'summary_large_image',title:metadata.title,description:metadata.description,image:metadata.image,'image:alt':metadata.alt}))tags.push(`<meta name="twitter:${key}" content="${escape(value)}">`);
  assert.match(html,/<head[\s>]/i);assert.match(html,/<\/head>/i);
  return html.replace(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i,(_,open,head,close)=>{
    const clean=head.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'').replace(/<meta\b[^>]*>/gi,tag=>/\b(?:name|property)\s*=\s*["'](?:description|og:[^"']+|twitter:[^"']+)["']/i.test(tag)?'':tag).replace(/<link\b[^>]*>/gi,tag=>/\brel\s*=\s*["']canonical["']/i.test(tag)?'':tag);
    return open+clean+'\n'+tags.join('\n')+'\n'+close;
  });
}
