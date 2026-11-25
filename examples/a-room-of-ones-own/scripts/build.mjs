import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical, KIT_VERSION} from '../site/bundle.mjs';
import {EDITION_DIGEST} from '../site/conditions.mjs';
import {validateBook} from '../site/core.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const sha = data => createHash('sha256').update(data).digest('hex');
export const assets = ["index.html", "app.mjs", "core.mjs", "db.mjs", "bundle.mjs", "text.mjs", "share.mjs", "conditions.mjs", "style.css", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "robots.txt"];
export const buildInputs = ['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...assets.map(name => 'site/'+name),'edition/library.json'];
async function regular(relative) {
  const input = path.join(root, relative);
  assert.equal(await realpath(input), input, 'Build input may not traverse a symlink');
  assert.ok((await lstat(input)).isFile(), 'Expected a regular file: '+relative);
  return readFile(input);
}
export async function build() {
  assert.equal(await realpath(root), root);
  const lock = JSON.parse(await regular('edition-lock.json'));
  assert.equal(lock.schema, 1);
  assert.equal(lock.sourceCommit, 'a7a6c809ab19256e6df34276d1c8c866ec8edf99');
  assert.equal(JSON.parse(await regular('package.json')).version, KIT_VERSION);
  assert.deepEqual(lock.files.map(file => file.path), [...assets.map(name => 'site/'+name),'edition/library.json']);
  const outputs = new Map();
  for (const {path: relative, bytes, sha256} of lock.files) {
    const data = await regular(relative);
    assert.equal(data.length, bytes, relative);
    assert.equal(sha(data), sha256, relative);
    outputs.set(path.basename(relative), data);
  }
  const library = JSON.parse(outputs.get('library.json'));
  assert.equal(library.length, 1);
  const book = validateBook(library[0]);
  assert.equal(book.id, 'woolf-room-1929');
  assert.equal(book.profile, 'woolf/hogarth-1929@1');
  assert.equal(sha(canonical(book)), EDITION_DIGEST);
  assert.deepEqual(book, library[0]);
  const digest = createHash('sha256').update(await regular('vercel.json'));
  for (const [name, data] of outputs) digest.update(name).update(data);
  const version = digest.digest('hex').slice(0,16);
  const files = [...outputs.keys()];
  const worker = `const CACHE='woolf-room-${version}';
const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('woolf-room-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
  outputs.set('sw.js', worker);
  const destination = path.join(root, 'dist');
  try { assert.equal(await realpath(destination), destination); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(destination,{recursive:true,force:true});
  await mkdir(destination);
  for (const [name,data] of outputs) await writeFile(path.join(destination,name),data);
  return {version,files:[...outputs.keys()],personalBooksIncluded:false};
}
if (process.argv[1]===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await build()));
