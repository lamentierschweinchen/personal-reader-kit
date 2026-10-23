// Mount the exact reviewed builds. Never copy another library or workspace.
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {injectAnalytics,appendAnalyticsLoader} from './analytics.mjs';
import {createContinuationProfile,injectContinuation,adaptContinuationApp} from './continuation.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const readerPaths=Object.freeze({'pride-and-prejudice':'austen','alice-in-wonderland':'alice',walden:'walden','schopenhauer-hegel':'two-halls',odyssey:'odyssey',dracula:'dracula','at-table':'at-table','inward-life':'inward-life','beside-the-bed':'beside-the-bed','learning-to-see':'learning-to-see','music-and-feeling':'music-and-feeling','nietzsche-in-company':'nietzsche','mountains-and-heights':'mountains','war-and-peace':'war-and-peace'});
function replace(text,from,to,count=1){
  assert.equal(text.split(from).length-1,count,'Reader mount assumption changed: '+from);
  return text.replaceAll(from,to);
}

export async function buildReaders(output){
  const catalog=JSON.parse(await readFile(path.join(root,'examples/catalog.json'),'utf8'));
  assert.equal(catalog.schema,1);
  assert.deepEqual(catalog.examples.map(e=>e.id).sort(),Object.keys(readerPaths).sort(),'Only the explicitly reviewed examples may be mounted');
  const receipt=[],continuationProfiles=[];
  for(const entry of catalog.examples){
    assert.equal(entry.directory,'examples/'+entry.id);
    const slug=readerPaths[entry.id],base='/'+slug+'/',source=path.join(root,entry.directory),destination=path.join(output,slug);
    const builder=await import(pathToFileURL(path.join(source,'scripts/build.mjs'))),built=await builder.build();
    assert.deepEqual([...built.files].sort(),entry.reviewedBuild.map(a=>a.path).sort(),'Reviewed output list changed: '+entry.id);
    const list=async(dir,prefix='')=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?list(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]))).flat();
    assert.deepEqual((await list(path.join(source,'dist'))).sort(),entry.reviewedBuild.map(a=>a.path).sort());
    await mkdir(destination,{recursive:true});
    const changed=[],unchanged=[];
    // IDs are admitted from the same hash-checked public edition used by this mount.
    const libraryAsset=entry.reviewedBuild.find(asset=>asset.path==='library.json');
    const libraryBytes=await readFile(path.join(source,'dist/library.json'));
    assert.equal(sha(libraryBytes),libraryAsset.sha256);
    const {validateBook}=await import(pathToFileURL(path.join(source,'site/core.mjs')));
    const books=JSON.parse(libraryBytes).map(book=>validateBook(book));
    const publicBooks=books.map(book=>book.id);
    const profile=await createContinuationProfile({edition:slug,title:entry.title,books});
    continuationProfiles.push(profile);
    for(const asset of entry.reviewedBuild){
      assert.match(asset.path,/^(?:play\/)?[a-zA-Z0-9_./-]+$/);
      assert.ok(!asset.path.split('/').some(p=>!p||p==='.'||p==='..'));
      const input=path.join(source,'dist',asset.path);
      assert.ok((await lstat(input)).isFile());
      const original=await readFile(input);
      assert.equal(original.length,asset.bytes,entry.id+'/'+asset.path);
      assert.equal(sha(original),asset.sha256,entry.id+'/'+asset.path);
      if(asset.path==='sw.js')continue;
      let bytes=original;
      if(asset.path==='index.html')bytes=Buffer.from(original.toString().replaceAll('href="/','href="'+base).replaceAll('src="/','src="'+base));
      if(asset.path==='index.html'){
        let html=bytes.toString();
        const maker='<p class="maker-credit">Made with <a href="https://newreading.app/">newreading.app</a></p>';
        if(html.includes(maker))html=replace(html,maker,'<p class="maker-credit">Made with <a href="https://newreading.app/">newreading.app</a> · <a href="/privacy/">Privacy</a></p>');
        else {assert.equal(html.split('<footer class="site-footer">').length,2);html=replace(html,'</footer>','<a class="catalogue-return" href="/privacy/">Privacy</a></footer>');}
        bytes=Buffer.from(html);
      }
      if(['index.html','play/index.html'].includes(asset.path))bytes=Buffer.from(injectAnalytics(bytes.toString(),{edition:slug,publicBooks}));
      if(asset.path==='index.html')bytes=Buffer.from(injectContinuation(bytes.toString(),{profiles:[profile],reader:slug}));
      if(asset.path==='app.mjs'){
        let text=replace(original.toString(),"register('/sw.js'",`register('${base}sw.js'`);
        text=replace(text,"fetch('/library.json'",`fetch('${base}library.json'`);
        if(slug==='austen')text=replace(text,'src="/austen-peacock-1894.png"',`src="${base}austen-peacock-1894.png"`);
        bytes=Buffer.from(text);
      }
      if(asset.path==='db.mjs'){
        const prior=slug==='odyssey'?'odyssey-reader-v1':slug==='dracula'?'dracula-reader-v1':['at-table','inward-life','beside-the-bed','learning-to-see','music-and-feeling','war-and-peace'].includes(slug)?slug+'-v1':'reading-kit-v1';
        bytes=Buffer.from(replace(original.toString(),`indexedDB.open('${prior}',1)`,`indexedDB.open('newreading-${slug}-v1',1)`));
      }
      if(asset.path==='app.mjs'&&slug==='nietzsche')bytes=Buffer.from(replace(bytes.toString(),"fetch('/company.json'",`fetch('${base}company.json'`));
      if(asset.path==='app.mjs'&&slug==='mountains')bytes=Buffer.from(replace(bytes.toString(),"fetch('/experience.json')",`fetch('${base}experience.json')`));
      if(asset.path==='edition.mjs'&&slug==='war-and-peace'){
        let text=replace(original.toString(),"['/structure.json','/companion.json']",`['${base}structure.json','${base}companion.json']`);
        text=replace(text,'src="/${esc(p.file)}"','src="'+base+'${esc(p.file)}"');
        text=replace(text,'href="/Literata-OFL.txt"',`href="${base}Literata-OFL.txt"`);
        bytes=Buffer.from(text);
      }
      if(asset.path==='app.mjs'&&slug==='dracula')bytes=Buffer.from(replace(bytes.toString(),"fetch('/source-notices.json')",`fetch('${base}source-notices.json')`));
      if(asset.path==='collection.mjs'&&slug==='inward-life')bytes=Buffer.from(replace(original.toString(),'src="/collection-art.svg"',`src="${base}collection-art.svg"`));
      if(asset.path==='table.mjs'&&slug==='at-table')bytes=Buffer.from(replace(original.toString(),'src="/table.svg"',`src="${base}table.svg"`));
      if(asset.path==='app.mjs'&&slug==='learning-to-see')bytes=Buffer.from(replace(bytes.toString(),'src="/cover.svg"',`src="${base}cover.svg"`));
      if(asset.path==='studio.mjs'&&slug==='learning-to-see')bytes=Buffer.from(replace(original.toString(),"fetch('/study-data.json')",`fetch('${base}study-data.json')`));
      if(asset.path==='app.mjs'&&slug==='beside-the-bed'){
        let text=replace(bytes.toString(),'src="/cover.svg"',`src="${base}cover.svg"`);
        for(const file of ['studies.json','sources.json','notices.json'])text=replace(text,`fetch('/${file}'`,`fetch('${base}${file}'`);
        text=replace(text,'href="/OFL.txt"',`href="${base}OFL.txt"`);
        bytes=Buffer.from(text);
      }
      if(asset.path==='collection.mjs'&&slug==='music-and-feeling'){
        let text=replace(original.toString(),'src="/cover.svg"',`src="${base}cover.svg"`);
        text=replace(text,'href="/GentiumPlus-OFL.txt"',`href="${base}GentiumPlus-OFL.txt"`);bytes=Buffer.from(text);
      }
      if(asset.path==='edition.mjs'&&slug==='music-and-feeling')bytes=Buffer.from(replace(original.toString(),"fetch('/'+asset.file)","fetch(new URL(asset.file,import.meta.url))"));
      if(asset.path==='app.mjs'&&slug==='music-and-feeling'){
        let text=replace(bytes.toString(),"fetch('/studies.json')",`fetch('${base}studies.json')`);
        const privateStudy="if(['127.0.0.1','localhost'].includes(location.hostname)){try{const response=await fetch('/review-studies.json');if(response.ok)privateStudiesData=await response.json();}catch{/* Private studies remain separate from production. */}}";
        text=replace(text,privateStudy,'');bytes=Buffer.from(text);
      }
      if(asset.path==='text.mjs'&&slug==='austen'){
        let text=replace(original.toString(),'img.src=f.src','img.src=new URL(f.src.slice(1),import.meta.url).href');
        text=replace(text,'a.href=f.src','a.href=new URL(f.src.slice(1),import.meta.url).href');
        bytes=Buffer.from(text);
      }
      if(asset.path==='manifest.webmanifest'){
        const manifest=JSON.parse(original);manifest.id=base;manifest.start_url=base;manifest.scope=base;
        for(const icon of manifest.icons)icon.src=base+icon.src.replace(/^\//,'');
        bytes=Buffer.from(JSON.stringify(manifest)+'\n');
      }
      if(asset.path==='app.mjs')bytes=Buffer.from(adaptContinuationApp(bytes.toString(),profile));
      if(asset.path==='app.mjs'||asset.path===(slug==='dracula'?'play/app.mjs':'play/game.mjs'))bytes=Buffer.from(appendAnalyticsLoader(bytes.toString()));
      await mkdir(path.dirname(path.join(destination,asset.path)),{recursive:true});
      await writeFile(path.join(destination,asset.path),bytes);
      (bytes.equals(original)?unchanged:changed).push(asset.path);
    }
    // Namespaced workers cannot evict another reader's offline copy on activation.
    const files=entry.reviewedBuild.filter(a=>a.path!=='sw.js').map(a=>a.path),hash=createHash('sha256');
    const recoverableShell=slug==='beside-the-bed';
    if(recoverableShell)hash.update('optional-data-cache@3');
    for(const file of files)hash.update(file).update(await readFile(path.join(destination,file)));
    // The optional pointer also works offline. Each reader keeps its own cached copy.
    hash.update('/continuation.mjs').update(await readFile(path.join(output,'continuation.mjs')));
    const version=hash.digest('hex').slice(0,16),prefix='newreading-'+slug+'-';
    const install=recoverableShell?`const SHELL=${JSON.stringify([...builder.assets.map(f=>base+f),'/continuation.mjs'])};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{await c.addAll(SHELL);await Promise.all(FILES.filter(f=>!SHELL.includes(f)).map(async f=>{const r=await fetch(f,{cache:'reload'});if(r.ok)await c.put(f,r);else{await r.arrayBuffer();if(![404,410].includes(r.status))throw new Error('Offline source unavailable: '+f);}}));}).then(()=>self.skipWaiting())));`:`self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));`;
    const network=recoverableShell?"fetch(e.request).catch(error=>{if(!SHELL.includes(key))return new Response('Source data unavailable',{status:503});throw error;})":"fetch(e.request)";
    await writeFile(path.join(destination,'sw.js'),`const PREFIX=${JSON.stringify(prefix)},CACHE=PREFIX+${JSON.stringify(version)},BASE=${JSON.stringify(base)};
const FILES=${JSON.stringify([...files.map(f=>base+f),'/continuation.mjs'])};
${install}
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&[BASE,BASE+'index.html'].includes(u.pathname)?BASE+'index.html':e.request.mode==='navigate'&&u.pathname===BASE+'play/'?BASE+'play/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||${network}));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:${JSON.stringify(version)}})));});
`);
    assert.ok(unchanged.includes('library.json'),'The complete edition must remain unchanged');
    receipt.push({id:entry.id,path:base,outputs:files.length+1,version,changed:[...changed,'sw.js'],unchanged:unchanged.length,exactEdition:true});
  }
  return {editions:receipt,continuationProfiles};
}
