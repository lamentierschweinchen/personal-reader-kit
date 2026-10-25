// Prepare self-contained review candidates from the existing public jackets.
// Build a reviewed catalogue first, then capture these pages at 1200x630.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {cover} from './library/covers.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function previewCandidates({baseline=path.join(root,'showcase/dist'),output=path.join(root,'test-results/social-previews/candidates')}={}){
 const {editions}=JSON.parse(await readFile(path.join(root,'showcase/library/entries.json')));
 const asset=async url=>{
  assert.match(url,/^\/[a-zA-Z0-9/_.-]+$/);assert.ok(!url.split('/').includes('..'));
  const mime=url.endsWith('.woff2')?'font/woff2':url.endsWith('.svg')?'image/svg+xml':url.endsWith('.webp')?'image/webp':url.endsWith('.png')?'image/png':'image/jpeg';
  return `data:${mime};base64,${(await readFile(path.join(baseline,url))).toString('base64')}`;
 };
 let css=await readFile(path.join(root,'showcase/library/style.css'),'utf8');
 for(const match of [...css.matchAll(/url\('([^']+)'\)/g)])css=css.replaceAll(match[0],`url('${await asset(match[1])}')`);
 const jacket=async b=>{
  let html=cover(b);
  for(const match of [...html.matchAll(/src="([^\"]+)"/g)])html=html.replaceAll(match[0],`src="${await asset(match[1])}"`);
  return html;
 };
 const style=`${css}
 html,body{width:1200px;height:630px;overflow:hidden}body{position:relative;font-synthesis:none}
 .preview-brand{position:absolute;top:40px;left:62px;font:italic 34px/1 Fell,Georgia,serif}
 .preview-jacket{position:absolute;left:64px;top:111px;width:278px}
 .preview-copy{position:absolute;left:404px;right:58px;top:136px}
 .preview-copy .eyebrow{font-size:12px;margin-bottom:19px}
 .preview-copy h1{font:400 var(--title-size,78px)/1.04 Fell,Georgia,serif;letter-spacing:-1.6px;margin:0}
 .preview-author{font:400 25px/1.35 Piazzolla,Georgia,serif;margin-top:23px;max-width:680px}
 .preview-feature{font:400 28px/1.35 Fell,Georgia,serif;margin-top:23px;color:#625e54}
 .preview-footer{position:absolute;left:404px;right:58px;bottom:37px;border-top:1px solid #cfc8b8;padding-top:17px;font:14px/1.4 Martian,monospace;color:#625e54}
 .library-copy{position:absolute;left:62px;top:153px;width:399px}
 .library-copy h1{font:400 96px/.98 Fell,Georgia,serif;letter-spacing:-2px}
 .library-copy p{font:400 35px/1.18 Fell,Georgia,serif;margin-top:27px}
 .library-books{position:absolute;left:520px;right:57px;top:180px;display:flex;gap:16px;align-items:start}
 .library-books>.cover{width:143px;flex:none}.library-books>.cover:nth-child(even){margin-top:36px}
 .library-footer{left:62px}
 `;
 const page=(title,body)=>`<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(title)}</title><style>${style}</style><body><div class="preview-brand">new reading</div>${body}</body></html>`;
 await mkdir(output,{recursive:true});
 const candidates=[];
 for(const b of editions){
  const size=b.title.length>40?62:b.title.length>29?69:78;
  const html=page(b.title,`<div class="preview-jacket">${await jacket(b)}</div><main class="preview-copy" style="--title-size:${size}px"><p class="eyebrow">${escape(b.kind)}</p><h1>${escape(b.title)}</h1><p class="preview-author">${escape(b.shortAuthor)}</p><p class="preview-feature">${escape(b.feature)}</p></main><div class="preview-footer">newreading.app/${b.id}/</div>`);
  await writeFile(path.join(output,b.id+'.html'),html);candidates.push({id:b.id,title:b.title,author:b.shortAuthor,feature:b.feature});
 }
 const selected=['austen','alice','pictures-after-dark','rome'].map(id=>editions.find(b=>b.id===id));
 await writeFile(path.join(output,'library.html'),page('The library',`<main class="library-copy"><h1>The<br>library.</h1><p>Made by one reader.<br>Ready for the next.</p></main><div class="library-books">${(await Promise.all(selected.map(jacket))).join('')}</div><div class="preview-footer library-footer">newreading.app/library/</div>`));
 candidates.push({id:'library',title:'The library',author:'New reading',feature:'Made by one reader. Ready for the next.'});
 await writeFile(path.join(output,'candidates.json'),JSON.stringify(candidates,null,2)+'\n');
 await writeFile(path.join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>Social preview candidates</title><h1>Social preview candidates</h1>${candidates.map(c=>`<p><a href="${c.id}.html">${escape(c.title)}</a></p>`).join('')}`);
 return {output,candidates:candidates.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await previewCandidates({baseline:process.argv[2]||path.join(root,'showcase/dist')}));
