// Mount the four exact reviewed builds. Never copy another library or workspace.
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const readerPaths=Object.freeze({'pride-and-prejudice':'austen','alice-in-wonderland':'alice',walden:'walden','schopenhauer-hegel':'two-halls'});
function replace(text,from,to,count=1){
  assert.equal(text.split(from).length-1,count,'Reader mount assumption changed: '+from);
  return text.replaceAll(from,to);
}

export async function buildReaders(output){
  const catalog=JSON.parse(await readFile(path.join(root,'examples/catalog.json'),'utf8'));
  assert.equal(catalog.schema,1);
  assert.deepEqual(catalog.examples.map(e=>e.id).sort(),Object.keys(readerPaths).sort(),'Only the four reviewed examples may be mounted');
  const receipt=[];
  for(const entry of catalog.examples){
    assert.equal(entry.directory,'examples/'+entry.id);
    const slug=readerPaths[entry.id],base='/'+slug+'/',source=path.join(root,entry.directory),destination=path.join(output,slug);
    const built=await (await import(pathToFileURL(path.join(source,'scripts/build.mjs')))).build();
    assert.deepEqual([...built.files].sort(),entry.reviewedBuild.map(a=>a.path).sort(),'Reviewed output list changed: '+entry.id);
    assert.deepEqual((await readdir(path.join(source,'dist'))).sort(),entry.reviewedBuild.map(a=>a.path).sort());
    await mkdir(destination,{recursive:true});
    const changed=[],unchanged=[];
    for(const asset of entry.reviewedBuild){
      assert.match(asset.path,/^[a-zA-Z0-9_.-]+$/);
      const input=path.join(source,'dist',asset.path);
      assert.ok((await lstat(input)).isFile());
      const original=await readFile(input);
      assert.equal(original.length,asset.bytes,entry.id+'/'+asset.path);
      assert.equal(sha(original),asset.sha256,entry.id+'/'+asset.path);
      if(asset.path==='sw.js')continue;
      let bytes=original;
      if(asset.path==='index.html')bytes=Buffer.from(original.toString().replaceAll('href="/','href="'+base).replaceAll('src="/','src="'+base));
      if(asset.path==='app.mjs'){
        let text=replace(original.toString(),"register('/sw.js'",`register('${base}sw.js'`);
        text=replace(text,"fetch('/library.json'",`fetch('${base}library.json'`);
        if(slug==='austen')text=replace(text,'src="/austen-peacock-1894.png"',`src="${base}austen-peacock-1894.png"`);
        bytes=Buffer.from(text);
      }
      if(asset.path==='db.mjs')bytes=Buffer.from(replace(original.toString(),"indexedDB.open('reading-kit-v1',1)",`indexedDB.open('newreading-${slug}-v1',1)`));
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
      await writeFile(path.join(destination,asset.path),bytes);
      (bytes.equals(original)?unchanged:changed).push(asset.path);
    }
    // Namespaced workers cannot evict another reader's offline copy on activation.
    const files=entry.reviewedBuild.filter(a=>a.path!=='sw.js').map(a=>a.path),hash=createHash('sha256');
    for(const file of files)hash.update(file).update(await readFile(path.join(destination,file)));
    const version=hash.digest('hex').slice(0,16),prefix='newreading-'+slug+'-';
    await writeFile(path.join(destination,'sw.js'),`const PREFIX=${JSON.stringify(prefix)},CACHE=PREFIX+${JSON.stringify(version)},BASE=${JSON.stringify(base)};
const FILES=${JSON.stringify(files.map(f=>base+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&[BASE,BASE+'index.html'].includes(u.pathname)?BASE+'index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:${JSON.stringify(version)}})));});
`);
    assert.ok(unchanged.includes('library.json'),'The complete edition must remain unchanged');
    receipt.push({id:entry.id,path:base,outputs:files.length+1,version,changed:[...changed,'sw.js'],unchanged:unchanged.length,exactEdition:true});
  }
  return receipt;
}
