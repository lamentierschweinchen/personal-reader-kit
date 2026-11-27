import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateBook} from '../site/core.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const digest = data => createHash('sha256').update(data).digest('hex');
const paths = [
  'site/index.html','site/reader.mjs','site/reader.css','site/mark.svg','site/core.mjs','site/db.mjs',
  'site/bundle.mjs','site/text.mjs','site/newsreader-normal.woff2','site/newsreader-italic.woff2','site/newsreader-OFL.txt',
  'site/apple-touch-icon.png','site/icon-192.png','site/icon-512.png','site/manifest.webmanifest','site/robots.txt',
  'edition/edition.json','edition/market-detail.webp','edition/frontispiece.webp','edition/title-page.webp'
];
export const buildInputs = ['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...paths];

async function regular(file) {
  const filename = path.join(root,file);
  assert.equal(await realpath(filename),filename,'Build inputs must be local regular files');
  assert.ok((await lstat(filename)).isFile(),file);
  return readFile(filename);
}

export function workerFor(outputs) {
  const hash = createHash('sha256');
  for (const [name, bytes] of outputs) hash.update(name).update(bytes);
  const version = hash.digest('hex').slice(0,16);
  const files = [...outputs.keys()];
  const worker = `const cacheName = 'goblin-market-${version}';
const scope = new URL(self.registration.scope);
const urls = ${JSON.stringify(files)}.map(name => new URL(name, scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(urls)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('goblin-market-') && key !== cacheName) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const key = url.pathname === scope.pathname && url.origin === scope.origin ? new URL('index.html', scope).href : url.href;
  if (urls.includes(key)) event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(key)) || fetch(request)));
});
self.addEventListener('message', event => {
  if (event.data !== 'CHECK_OFFLINE') return;
  event.waitUntil(caches.open(cacheName).then(async cache => {
    const ready = (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready, version:'${version}'});
  }));
});
`;
  return {version, bytes:Buffer.from(worker)};
}

export async function build() {
  const lock = JSON.parse(await regular('edition-lock.json'));
  assert.equal(lock.schema,1);
  assert.equal(lock.sourceCommit,'bb75c216e8373afacc576e71fc2416015112cd3f');
  assert.deepEqual(lock.files.map(file => file.path),paths);
  const outputs = new Map();
  for (const file of lock.files) {
    const bytes = await regular(file.path);
    assert.equal(bytes.length,file.bytes,file.path);
    assert.equal(digest(bytes),file.sha256,file.path);
    outputs.set(path.basename(file.path),bytes);
  }
  const {book,layout} = JSON.parse(outputs.get('edition.json'));
  assert.deepEqual(validateBook(book),book);
  assert.equal(book.id,'goblin-market-1862');
  assert.equal(book.sections.length,1);
  const blocks = book.sections[0].blocks;
  assert.equal(blocks.length,567);
  assert.equal(blocks.filter(block => layout[block.id][2]).length,30);
  assert.equal(blocks.filter(block => layout[block.id][1]).length,27);
  const worker = workerFor(outputs);
  outputs.set('sw.js',worker.bytes);
  const destination = path.join(root,'dist');
  try { assert.equal(await realpath(destination),destination); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await rm(destination,{recursive:true,force:true});
  await mkdir(destination);
  for (const [name,bytes] of outputs) await writeFile(path.join(destination,name),bytes);
  return {version:worker.version,files:[...outputs.keys()],personalBooksIncluded:false};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await build()));
