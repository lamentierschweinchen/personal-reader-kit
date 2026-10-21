import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const origin='https://reader.invalid';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function inspectPng(bytes,{size,opaque=false}={}){
  assert.ok(bytes.subarray(0,8).equals(signature),'Icon must be a PNG');
  const chunks=[];let offset=8;
  while(offset<bytes.length){
    assert.ok(offset+12<=bytes.length,'Incomplete PNG chunk');
    const length=bytes.readUInt32BE(offset),end=offset+12+length;
    assert.ok(end<=bytes.length,'Incomplete PNG data');
    const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,end-4);
    assert.equal(crc32(bytes.subarray(offset+4,end-4)),bytes.readUInt32BE(end-4),'Invalid PNG checksum');
    chunks.push({type,data});offset=end;
  }
  assert.equal(chunks[0]?.type,'IHDR','PNG needs a first IHDR');
  assert.equal(chunks[0].data.length,13,'Invalid PNG header');
  assert.equal(chunks.at(-1)?.type,'IEND','PNG needs an IEND');
  const header=chunks[0].data,width=header.readUInt32BE(0),height=header.readUInt32BE(4),depth=header[8],color=header[9];
  assert.ok(width>0&&width<=2048&&height>0&&height<=2048,'Icon dimensions must be within 2048 pixels');
  if(size){assert.equal(width,size,'Wrong icon width');assert.equal(height,size,'Wrong icon height');}
  if(opaque){assert.equal(color,2,'Home-screen PNG must use opaque RGB');assert.ok(!chunks.some(c=>c.type==='tRNS'),'Home-screen PNG must not have transparency');}
  assert.equal(depth,8,'Use an 8-bit PNG');assert.ok([2,6].includes(color),'Use RGB or RGBA PNG');
  assert.deepEqual([...header.subarray(10)],[0,0,0],'Use a non-interlaced PNG');
  const row=width*(color===2?3:4)+1;
  const pixels=inflateSync(Buffer.concat(chunks.filter(c=>c.type==='IDAT').map(c=>c.data)),{maxOutputLength:row*height});
  assert.equal(pixels.length,row*height,'Incomplete PNG pixels');
  for(let y=0;y<height;y++)assert.ok(pixels[y*row]<=4,'Invalid PNG row filter');
  return {width,height,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
}
function attributes(tag){return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));}
export async function checkHomeScreen(directory,{base='/',id=base,cache=false}={}){
  assert.match(base,/^\/(?:[a-z0-9-]+\/)*$/,'Base must be a canonical directory path');
  const root=path.resolve(directory),indexUrl=new URL(base,origin),files=[];
  async function readReference(reference,from=indexUrl){
    assert.equal(typeof reference,'string','Missing icon or manifest URL');
    const url=new URL(reference,from);
    assert.equal(url.origin,origin,'Home-screen assets must stay on the reader origin');
    assert.ok(url.pathname.startsWith(base),'Home-screen asset escapes this reader scope');
    assert.ok(!url.search&&!url.hash,'Home-screen asset URLs must name exact files');
    const decoded=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+decoded);
    assert.ok(file.startsWith(root+path.sep)&&!decoded.includes('\\'),'Asset escapes the output directory');
    assert.ok((await lstat(file)).isFile(),'Home-screen asset must be a regular file');
    const bytes=await readFile(file);files.push(url.pathname);return {url,bytes};
  }
  const {bytes:html}=await readReference(base+'index.html');
  const links=[...html.toString('utf8').matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const apple=links.filter(l=>l.rel==='apple-touch-icon');assert.equal(apple.length,1,'Provide one explicit Apple touch icon');
  assert.equal(apple[0].sizes,'180x180','Declare the 180px Apple touch icon');
  const touch=await readReference(apple[0].href);const applePng=inspectPng(touch.bytes,{size:180,opaque:true});
  const manifestLinks=links.filter(l=>l.rel==='manifest');assert.equal(manifestLinks.length,1,'Provide one manifest');
  const response=await readReference(manifestLinks[0].href),manifest=JSON.parse(response.bytes);
  assert.equal(manifest.id,id,'Installed identity changed or is not explicit');
  assert.equal(manifest.start_url,base,'Installed launch URL must be the reader entrance');
  assert.equal(manifest.scope,base,'Installed scope must stay inside this reader');
  assert.ok(typeof manifest.name==='string'&&manifest.name.trim(),'Give the reader a name');
  assert.ok(typeof manifest.short_name==='string'&&manifest.short_name.trim(),'Give the home-screen label a short name');
  assert.ok(Array.isArray(manifest.icons),'Manifest icons are missing');
  const pngs=[];
  for(const icon of manifest.icons){
    const asset=await readReference(icon.src,response.url);
    if(icon.type==='image/png'){
      assert.match(icon.sizes,/^(192x192|512x512)$/,'Declare the exact PNG dimensions');
      assert.ok((icon.purpose||'any').split(' ').every(p=>['any','maskable'].includes(p)),'Unknown PNG icon purpose');
      pngs.push({...inspectPng(asset.bytes,{size:Number(icon.sizes.split('x')[0]),opaque:true}),path:asset.url.pathname,purpose:icon.purpose||'any'});
    }else{assert.equal(icon.type,'image/svg+xml','Unsupported icon type');assert.equal(icon.sizes,'any');assert.match(asset.bytes.toString('utf8'),/<svg\b/,'SVG icon is missing');}
  }
  for(const size of [192,512])assert.ok(pngs.some(p=>p.width===size&&p.purpose.split(' ').includes('any')),'Missing '+size+'px manifest PNG');
  if(cache){
    const worker=(await readReference(base+'sw.js')).bytes.toString('utf8');
    for(const file of files.filter(f=>!f.endsWith('/sw.js')))assert.ok(worker.includes(JSON.stringify(file)),'Offline cache omits '+file);
  }
  return {base,id:manifest.id,name:manifest.short_name,apple:{path:touch.url.pathname,...applePng},icons:pngs,cacheChecked:cache};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),options={};let directory=fileURLToPath(new URL('../site/',import.meta.url));
  while(args.length){const arg=args.shift();if(arg==='--cache')options.cache=true;else if(['--site','--base','--id'].includes(arg)&&args.length){const value=args.shift();if(arg==='--site')directory=path.resolve(value);else options[arg.slice(2)]=value;}else throw Error('Use --site DIRECTORY, --base /reader/, --id /stable-id, and optional --cache.');}
  console.log(JSON.stringify(await checkHomeScreen(directory,options),null,2));
}
