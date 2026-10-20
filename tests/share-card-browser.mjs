import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Developer regression only: generated original writing, isolated browser records,
// observed real canvas/PNG output and stubbed OS handoff. No recipient is contacted.
// Native selection handles, the share sheet and installed-device behavior still
// require a separate physical-device review.
const root=fileURLToPath(new URL('../',import.meta.url));
const defaultOutput=new URL('../test-results/share-card/',import.meta.url);
const projects=['.','examples/pride-and-prejudice','examples/alice-in-wonderland','examples/walden','examples/schopenhauer-hegel','examples/odyssey','examples/dracula','examples/at-table','examples/inward-life','examples/music-and-feeling','examples/learning-to-see','examples/beside-the-bed'];
const action=(page,name)=>page.locator(`[data-card-action="${name}"]`);
const preview=page=>page.locator('.passage-card-preview');
const compact=text=>text.replace(/\s/gu,'');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const privateNote='PRIVATE_UNSAVED_CARD_NOTE — never export this annotation.';
const privateSource='PRIVATE_CARD_SOURCE_DESCRIPTION';
const privateURL='https://private.invalid/device-secret';
const shortText='  A square of morning.\n    Café, λόγος, a blue boat.\n\n\n\nThe last line: <script> is text.';
const longText=Array.from({length:6},(_,i)=>`Original sentence ${i+1} keeps the rain, the lamp, and every final word.`).join(' ')+' An unmistakable final sentence.';
let visit=0;

function installObservers() {
  const qa=window.cardQA={mode:'success',canShare:true,shares:[],copies:[],urls:[],files:[],draws:[],rasters:[],pending:[],pendingShares:[],pendingPreviews:[],delayBlob:false,failBlob:false,delayPreview:false,activation:null,clicks:0};
  // Observe the actual synchronous click-listener stack. A microtask/timer before
  // navigator.share loses this marker even when transient userActivation remains.
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,wrapped=new WeakMap();
  EventTarget.prototype.addEventListener=function(type,listener,options) {
    if(type==='click'&&listener&&(typeof listener==='function'||typeof listener.handleEvent==='function')) {
      const original=listener;
      if(!wrapped.has(listener))wrapped.set(listener,function(event){
        const previous=qa.activation;
        qa.activation={trusted:event.isTrusted,serial:++qa.clicks};
        try{return typeof original==='function'?original.call(this,event):original.handleEvent(event);}
        finally{qa.activation=previous;}
      });
      listener=wrapped.get(listener);
    }
    return add.call(this,type,listener,options);
  };
  EventTarget.prototype.removeEventListener=function(type,listener,options) {
    return remove.call(this,type,type==='click'&&wrapped.has(listener)?wrapped.get(listener):listener,options);
  };
  const NativeFile=File;
  window.File=new Proxy(NativeFile,{construct(target,args,newTarget){
    const file=Reflect.construct(target,args,newTarget);
    qa.files.push({file,click:qa.activation?.serial||0});
    return file;
  }});
  Object.defineProperty(navigator,'share',{configurable:true,get:()=>qa.mode==='absent'?undefined:data=>{
    const file=data.files?.[0],known=qa.files.find(item=>item.file===file);
    qa.shares.push({data,file,activation:qa.activation&&{...qa.activation},prebuilt:!!known&&known.click!==(qa.activation?.serial||-1)});
    if(qa.mode==='pending')return new Promise((resolve,reject)=>qa.pendingShares.push({resolve,reject}));
    if(qa.mode==='throws')throw new DOMException('Original synchronous denial','NotAllowedError');
    if(qa.mode==='cancel')return Promise.reject(new DOMException('Original test cancellation','AbortError'));
    if(qa.mode==='blocked')return Promise.reject(new DOMException('Original test denial','NotAllowedError'));
    return Promise.resolve();
  }});
  Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>qa.canShare&&Array.isArray(data.files)&&data.files.length===1&&data.files[0] instanceof NativeFile&&data.files[0].type==='image/png'&&data.files[0].size>0});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>qa.copies.push(text)}});
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{
    const url=create(blob);qa.urls.push({url,blob,revocations:0});return url;
  };
  URL.revokeObjectURL=url=>{
    const item=qa.urls.find(item=>item.url===url);if(item)item.revocations++;
    return revoke(url);
  };
  const canvases=new WeakMap();let canvasId=0;
  const id=canvas=>{if(!canvases.has(canvas))canvases.set(canvas,++canvasId);return canvases.get(canvas);};
  const fillText=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,x,y,maxWidth) {
    const metrics=this.measureText(text),size=Number(this.font.match(/([\d.]+)px/)?.[1]||0);
    qa.draws.push({canvas:id(this.canvas),text:String(text),x,y,font:this.font,size,maxWidth:maxWidth??null,
      left:x-metrics.actualBoundingBoxLeft,right:x+metrics.actualBoundingBoxRight,
      top:y-metrics.actualBoundingBoxAscent,bottom:y+metrics.actualBoundingBoxDescent});
    return maxWidth===undefined?fillText.call(this,text,x,y):fillText.call(this,text,x,y,maxWidth);
  };
  const toBlob=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=function(callback,...args) {
    const record={canvas:id(this),width:this.width,height:this.height};
    qa.rasters.push(record);
    return toBlob.call(this,blob=>{
      record.size=blob?.size||0;
      const finish=()=>callback(qa.failBlob?null:blob);
      if(qa.delayBlob)qa.pending.push(finish);else finish();
    },...args);
  };
  const readAsDataURL=FileReader.prototype.readAsDataURL;
  FileReader.prototype.readAsDataURL=function(blob) {
    if(qa.delayPreview) {
      qa.pendingPreviews.push(()=>new Promise(resolve=>{
        this.addEventListener('loadend',resolve,{once:true});readAsDataURL.call(this,blob);
      }));
      return;
    }
    return readAsDataURL.call(this,blob);
  };
}

async function settle(page) {
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

async function appReady(page) {
  // Collection metadata finishes loading after the first heading appears.
  // Do not abort those real startup requests with the next fixture navigation.
  // Await the already-running entry module; the blocked-worker test context can
  // otherwise leave navigator.serviceWorker.ready pending indefinitely.
  await page.waitForFunction(async()=>{await import('/app.mjs');return true;});
}

async function openRoute(page,base,route='') {
  // A changed query forces exactly one fresh application load, including when
  // a fixture has just changed in IndexedDB. goto followed by reload aborts it.
  await page.goto(`${base}/?private-card-device=must-not-export&card-visit=${++visit}${route}`);
  await appReady(page);
}

async function fixture(page,text,title,{kind='prose',fixed=false}={}) {
  return page.evaluate(async({text,title,kind,fixed,privateSource,privateURL})=>{
    const {fromText}=await import('/core.mjs'),db=await import('/db.mjs');
    const book=await fromText(text,{title,author:'The original fixture author',kind});
    book.edition='Original card test edition';
    book.sections[0].title='A window and a quiet morning';
    book.source.description=privateSource+' '+privateURL;
    const first=book.sections[0].blocks[0],emphasis=first.text.indexOf('Café');
    if(emphasis>=0)first.marks=[{kind:'em',start:emphasis,end:emphasis+4},{kind:'strong',start:emphasis,end:emphasis+4}];
    if(fixed)for(const block of book.sections[0].blocks)block.layout='fixed';
    await db.saveBook(book);
    return {id:book.id,section:book.sections[0].id,text,title:book.title,author:book.author,edition:book.edition,sectionTitle:book.sections[0].title,revision:book.source.sha256};
  },{text,title,kind,fixed,privateSource,privateURL});
}

async function openFixture(page,base,item) {
  await openRoute(page,base,`#read/${item.id}/${item.section}`);
  await page.locator(`#reading-text[data-book="${item.id}"][data-position-ready="true"]`).waitFor();
  // Dracula's source notice appears at startup regardless of the chosen book.
  const notice=page.locator('#dialog[open] [data-action="notice-read"]');
  if(await notice.count()){await notice.click();await page.locator('#dialog').waitFor({state:'hidden'});}
  await settle(page);
  const text=await page.evaluate(()=>{
    const blocks=[...document.querySelectorAll('#reading-text [data-block]')],range=document.createRange();
    range.setStart(blocks[0],0);range.setEnd(blocks.at(-1),blocks.at(-1).childNodes.length);
    return range.toString();
  });
  assert.equal(text,item.text);
}

async function selectAll(page) {
  const quote=await page.evaluate(()=>{
    const blocks=[...document.querySelectorAll('#reading-text [data-block]')],range=document.createRange();
    range.setStart(blocks[0],0);range.setEnd(blocks.at(-1),blocks.at(-1).childNodes.length);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    return range.toString();
  });
  await page.locator('#selection-save:not([hidden])').click();
  if(await page.locator('[data-action="selection-new"]').isVisible())await page.locator('[data-action="selection-new"]').click();
  await page.locator('#note-text').waitFor();
  assert.equal(await page.locator('.dialog-quote').textContent(),quote);
  await action(page,'make').waitFor();
  return quote;
}

async function makeCard(page) {
  await action(page,'make').click();
  await page.locator('.passage-card-preview[data-card-state="ready"]').waitFor();
  await page.locator('img.passage-card-image').evaluate(image=>image.decode());
  return readRaster(page);
}

async function readRaster(page) {
  return page.evaluate(async()=>{
    const image=document.querySelector('img.passage-card-image'),url=document.querySelector('[data-card-action="save"]').href,entry=cardQA.urls.find(item=>item.url===url);
    if(!entry)throw new Error('Save image must refer to its generated local PNG.');
    if(!image.src.startsWith('data:image/png;base64,'))throw new Error('Preview must use a PNG data URL permitted by the actual deployment CSP.');
    const bytes=new Uint8Array(await entry.blob.arrayBuffer()),view=new DataView(bytes.buffer);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const previewBytes=Uint8Array.from(atob(image.src.split(',')[1]),char=>char.charCodeAt(0));
    const previewDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',previewBytes)),n=>n.toString(16).padStart(2,'0')).join('');
    const raster=cardQA.rasters.at(-1),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data,background=pixels.slice(0,4);let changed=0,transparent=0;
    for(let i=0;i<pixels.length;i+=16){
      if(pixels[i+3]!==255)transparent++;
      if(Math.abs(pixels[i]-background[0])+Math.abs(pixels[i+1]-background[1])+Math.abs(pixels[i+2]-background[2])>60)changed++;
    }
    return {url,type:entry.blob.type,size:entry.blob.size,signature:Array.from(bytes.slice(0,8)),width:view.getUint32(16),height:view.getUint32(20),
      naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,digest,previewDigest,changed,transparent,alt:image.alt,
      draws:cardQA.draws.filter(draw=>draw.canvas===raster.canvas)};
  });
}

function assertRaster(card,item) {
  assert.deepEqual(card.signature,[137,80,78,71,13,10,26,10],'Real PNG signature');
  assert.equal(card.type,'image/png');assert.equal(card.width,1080);
  assert.equal(card.previewDigest,card.digest,'CSP-compatible preview and downloadable PNG contain identical bytes');
  assert.ok(card.height>=1080&&card.height<=1920,`Bounded readable card height: ${card.height}`);
  assert.equal(card.naturalWidth,card.width);assert.equal(card.naturalHeight,card.height);
  assert.ok(card.size>10000,'PNG contains rendered content, not an empty placeholder');
  assert.ok(card.changed>1000,`Decoded pixels contain ink: ${card.changed} contrasting sampled pixels`);assert.equal(card.transparent,0,'Opaque paper survives export');
  const drawn=card.draws.map(draw=>draw.text).join('');
  assert.ok(compact(drawn).includes(compact(item.text)),'All chosen words reach the real canvas in source order');
  for(const text of [item.author,item.title,item.sectionTitle,item.edition])assert.ok(compact(drawn).includes(compact(text)),`Visible attribution includes ${text}`);
  assert.doesNotMatch(drawn,/PRIVATE_UNSAVED_CARD_NOTE|PRIVATE_CARD_SOURCE_DESCRIPTION|private\.invalid|private-card-device|127\.0\.0\.1/);
  assert.ok(!drawn.includes(item.revision),'Edition fingerprints are not card copy');
  let quoted=0;
  for(const draw of card.draws.filter(draw=>draw.text.trim())) {
    assert.ok(draw.size>=(quoted<compact(item.text).length?58:30),'Source and reference type retain their minimum legible sizes');
    quoted+=compact(draw.text).length;
    assert.ok(draw.left>=-1&&draw.right<=card.width+1&&draw.top>=-1&&draw.bottom<=card.height+1,`Drawn text stays on the PNG: ${JSON.stringify(draw)}`);
    assert.ok(draw.maxWidth===null||draw.maxWidth>=draw.right-draw.left-1,'Do not silently squeeze text into the card');
  }
  assert.equal(card.alt,item.text+'\n\n'+[`${item.author} · ${item.title}`,item.sectionTitle,item.edition].join('\n'),'Text alternative retains exact source whitespace and complete attribution');
}

async function assertDraft(page,expected=privateNote) {
  assert.equal(await page.locator('#note-text').inputValue(),expected);
  assert.equal(await page.locator('#dialog').evaluate(dialog=>dialog.open),true);
}

async function shareImage(page,expected,mode='success',activation='click') {
  await page.evaluate(mode=>cardQA.mode=mode,mode);
  const before=await page.evaluate(()=>cardQA.shares.length);
  if(activation==='touch')await action(page,'share').tap();
  else if(activation==='keyboard'){await action(page,'share').focus();await page.keyboard.press('Enter');}
  else await action(page,'share').click();
  await page.waitForFunction(count=>cardQA.shares.length>count,before);
  const result=await page.evaluate(async()=>{
    const call=cardQA.shares.at(-1),file=call.file;
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
    return {keys:Object.keys(call.data).sort(),title:call.data.title,text:call.data.text,fileCount:call.data.files.length,
      file:file instanceof File,name:file.name,type:file.type,size:file.size,digest,activation:call.activation,prebuilt:call.prebuilt};
  });
  assert.ok(result.keys.every(key=>['files','title','text'].includes(key)),'Only selected card and attribution are handed off');
  assert.equal(result.fileCount,1);assert.equal(result.file,true);assert.equal(result.type,'image/png');assert.match(result.name,/\.png$/i);
  assert.equal(result.size,expected.size);assert.equal(result.digest,expected.digest,'Shared file exactly matches the preview');
  assert.equal(result.activation?.trusted,true,'navigator.share runs synchronously inside the fresh genuine click');
  assert.equal(result.prebuilt,true,'File exists before the share click');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_UNSAVED_CARD_NOTE|PRIVATE_CARD_SOURCE_DESCRIPTION|private\.invalid|private-card-device|127\.0\.0\.1/);
  await assertDraft(page);
  return result;
}

async function assertRevoked(page,url) {
  await page.waitForFunction(url=>cardQA.urls.find(item=>item.url===url)?.revocations>0,url);
  assert.equal(await page.evaluate(url=>cardQA.urls.find(item=>item.url===url).revocations,url),1,'Preview URL revoked exactly once');
}

async function saveImage(page,card) {
  const promise=page.waitForEvent('download');
  await action(page,'save').click();
  const download=await promise,bytes=await readFile(await download.path());
  assert.match(download.suggestedFilename(),/\.png$/i);
  assert.equal(hash(bytes),card.digest,'Downloaded bytes are exactly the rendered PNG');
  assert.equal(bytes.readUInt32BE(16),card.width);assert.equal(bytes.readUInt32BE(20),card.height);
  assert.ok(!bytes.includes(Buffer.from(privateNote))&&!bytes.includes(Buffer.from(privateURL)),'PNG metadata has no annotation or device URL');
  assert.equal(await download.failure(),null);
  return bytes;
}

export async function shareCardChecks({browser,base,engine,output=defaultOutput,project='.'}) {
  await mkdir(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],external=[],securityViolations=[];
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith(base+'/')&&!/^(blob:|data:)/.test(request.url()))external.push(request.url());});
  await page.exposeFunction('recordCardSecurityViolation',event=>securityViolations.push(event));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>window.recordCardSecurityViolation({directive:event.effectiveDirective,blockedURI:event.blockedURI})));
  await page.addInitScript(installObservers);
  try {
    const response=await page.goto(base+'/');await page.locator('#main h1').waitFor();await appReady(page);
    const contentSecurityPolicy=response.headers()['content-security-policy'];
    assert.ok(contentSecurityPolicy,'Regression server sends the actual deployment CSP');
    if(project==='examples/dracula') {
      await page.locator('#dialog[open] [data-action="notice-read"]').click();
      await page.locator('#dialog').waitFor({state:'hidden'});
    }
    const item=await fixture(page,shortText,'A card from original writing',{kind:'verse'});
    await openFixture(page,base,item);await selectAll(page);
    await page.locator('#note-text').fill(privateNote);
    assert.equal(await page.evaluate(()=>cardQA.urls.length),0,'Selecting a passage does not prepare or share a card automatically');
    let card=await makeCard(page);assertRaster(card,item);
    assert.ok(card.draws.some(draw=>draw.text==='Café'&&/\bitalic\b/.test(draw.font)&&/\b600\b/.test(draw.font)),'Combined original source emphasis reaches the PNG');
    await shareImage(page,card);
    await shareImage(page,card,'cancel','touch');
    await page.locator('.passage-card-status').filter({hasText:/dismiss|cancel/i}).waitFor();
    assert.equal(await action(page,'save').isVisible(),true);
    await shareImage(page,card,'blocked','keyboard');
    await page.locator('.passage-card-status').filter({hasText:/save|unavailable|could|cannot/i}).waitFor();
    assert.equal(await action(page,'save').isVisible(),true);
    await shareImage(page,card,'throws');await assertDraft(page);
    assert.deepEqual(await page.evaluate(()=>cardQA.copies),[],'Cancellation and errors never silently copy text');
    assert.equal(await page.evaluate(async()=>(await (await import('/db.mjs')).loadState()).notes.length),0,'Sharing never saves the annotation');
    await shareImage(page,card,'pending');
    assert.equal(await action(page,'share').isDisabled(),true);
    const previous=card;card=await makeCard(page);assertRaster(card,item);await assertRevoked(page,previous.url);
    await shareImage(page,card,'pending');
    await page.evaluate(()=>cardQA.pendingShares[0].resolve());await settle(page);
    assert.equal(await action(page,'share').isDisabled(),true,'Old native-share completion cannot reset the new request');
    await page.evaluate(()=>cardQA.pendingShares[1].resolve());
    await page.waitForFunction(()=>!document.querySelector('[data-card-action="share"]').disabled);
    const exported=await saveImage(page,card);await assertDraft(page);
    await writeFile(new URL(`${engine}-${project.replaceAll('/','-').replace('.','starter')}-card.png`,output),exported);
    const viewports=[];
    for(const [label,width,height]of [['narrow-phone',320,568],['phone',390,844],['phone-landscape',844,390],['tablet',820,1180],['tablet-landscape',1180,820]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>document.documentElement.style.setProperty('--size','36px'));
      await action(page,'save').scrollIntoViewIfNeeded();await settle(page);
      const geometry=await page.evaluate(()=>{
        const dialog=document.querySelector('#dialog'),image=document.querySelector('img.passage-card-image'),box=image.getBoundingClientRect();
        return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,dialogWidth:dialog.clientWidth,dialogScroll:dialog.scrollWidth,image:{width:box.width,height:box.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight},
          controls:[...document.querySelectorAll('[data-card-action]')].filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {name:el.dataset.cardAction,width:r.width,height:r.height,left:r.left,right:r.right};})};
      });
      assert.ok(geometry.pageWidth<=width+1&&geometry.dialogScroll<=geometry.dialogWidth+1,`${label}: no horizontal overflow ${JSON.stringify(geometry)}`);
      assert.ok(geometry.image.width>0&&geometry.image.width<=geometry.dialogWidth+1);
      assert.ok(Math.abs(geometry.image.width/geometry.image.height-card.width/card.height)<.02,'Preview preserves the export aspect ratio');
      for(const control of geometry.controls)assert.ok(control.width>=43.9&&control.height>=43.9&&control.left>=-1&&control.right<=width+1,`${label} touch target: ${JSON.stringify(control)}`);
      const file=`${engine}-${project.replaceAll('/','-').replace('.','starter')}-${label}.png`;
      await page.screenshot({path:new URL(file,output).pathname,animations:'disabled'});
      viewports.push(label);
    }
    await action(page,'close').click();await assertRevoked(page,card.url);await assertDraft(page);
    assert.equal(await preview(page).isVisible(),false);
    assert.equal(await action(page,'make').getAttribute('aria-expanded'),'false');
    assert.equal(await action(page,'make').evaluate(element=>element===document.activeElement),true,'Closing the preview returns keyboard focus');
    if(project==='.') {
      const held=await makeCard(page);await action(page,'close').focus();await page.keyboard.down('Enter');
      await page.waitForFunction(()=>document.querySelector('.passage-card-preview').hidden);
      await page.keyboard.down('Enter');await page.keyboard.up('Enter');await settle(page);
      assert.equal(await preview(page).isVisible(),false,'Held Enter cannot reopen the preview after focus returns to Make');
      await assertRevoked(page,held.url);
      for(const key of ['Enter','Space']) {
        await action(page,'make').focus();await page.keyboard.press(key);
        await page.locator('.passage-card-preview[data-card-state="ready"]').waitFor();
        await page.locator('img.passage-card-image').evaluate(image=>image.decode());
        const fresh=await readRaster(page);assertRaster(fresh,item);
        await action(page,'close').focus();await page.keyboard.press(key);await assertRevoked(page,fresh.url);
      }
    }
    await page.evaluate(()=>{cardQA.mode='absent';document.documentElement.style.removeProperty('--size');});
    const fallback=await makeCard(page);assertRaster(fallback,item);
    assert.equal(await action(page,'save').isVisible(),true);
    assert.ok(!await action(page,'share').isVisible()||await action(page,'share').isDisabled(),'Unsupported file sharing exposes the real save route');
    await saveImage(page,fallback);await assertDraft(page);
    await action(page,'close').click();await assertRevoked(page,fallback.url);
    await page.evaluate(()=>{cardQA.mode='success';cardQA.canShare=false;});
    const unsupported=await makeCard(page);
    assert.equal(await action(page,'save').isVisible(),true);
    assert.ok(!await action(page,'share').isVisible()||await action(page,'share').isDisabled(),'canShare(files) rejection does not call the OS');
    await action(page,'close').click();await assertRevoked(page,unsupported.url);
    await page.evaluate(()=>{cardQA.canShare=true;cardQA.failBlob=true;});
    await action(page,'make').click();await page.locator('.passage-card-preview[data-card-state="error"]').waitFor();
    await assertDraft(page);
    assert.equal(await page.locator('[data-action="copy-passage"]').isVisible(),true,'Text sharing remains available after raster failure');
    await page.evaluate(()=>cardQA.failBlob=false);
    const retry=await makeCard(page);assertRaster(retry,item);
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});await assertRevoked(page,retry.url);
    await openRoute(page,base,'#passages');await page.locator('[data-action="edit-note"]').first().click();
    await assertDraft(page);
    const saved=await makeCard(page);assertRaster(saved,item);
    await page.locator('#dialog [data-action="close"]').click();await assertRevoked(page,saved.url);
    await page.evaluate(async()=>(await import('/db.mjs')).updateState(state=>{state.notes[0].revision='0'.repeat(64);return state;}));
    await page.reload();await appReady(page);await page.locator('[data-action="edit-note"]').first().click();
    assert.equal(await action(page,'make').count(),0,'Stale edition cannot produce an attributed image');
    assert.equal(await page.locator('.dialog-quote').textContent(),item.text);await assertDraft(page);
    await page.locator('#dialog [data-action="close"]').click();
    const longer=await fixture(page,longText,'Every word has room');
    await openFixture(page,base,longer);await selectAll(page);
    const tall=await makeCard(page);assertRaster(tall,longer);
    assert.ok(tall.height>1080,'A fitting long excerpt uses a taller canvas');
    await page.locator('#dialog [data-action="close"]').click();await assertRevoked(page,tall.url);
    const oversized=await fixture(page,'Original full excerpt. '.repeat(90)+'THE LAST WORD MUST REMAIN.','An intentionally oversized passage');
    await openFixture(page,base,oversized);await selectAll(page);await page.locator('#note-text').fill(privateNote);
    await action(page,'make').click();await page.locator('.passage-card-preview[data-card-state="error"]').waitFor();
    assert.equal(await page.locator('.dialog-quote').textContent(),oversized.text,'Refusal preserves the entire original selection');
    await assertDraft(page);
    assert.equal(await action(page,'save').isVisible(),false,'Oversized excerpts are refused instead of exporting cropped text');
    assert.equal(await page.locator('[data-action="copy-passage"]').isVisible(),true);
    await page.locator('#note-text').fill('');await page.locator('#dialog [data-action="close"]').click();
    const verse=await fixture(page,'One original verse line keeps its shape: '+'word '.repeat(45)+'the exact end.','An original line that cannot fit',{kind:'verse'});
    await openFixture(page,base,verse);await selectAll(page);
    await action(page,'make').click();await page.locator('.passage-card-preview[data-card-state="error"]').waitFor();
    assert.equal(await page.locator('.dialog-quote').textContent(),verse.text,'An unfittable verse line is not silently wrapped');
    assert.equal(await action(page,'save').isVisible(),false);
    assert.equal(await page.locator('[data-action="copy-passage"]').isVisible(),true);
    await page.locator('#dialog [data-action="close"]').click();
    if(project==='.') {
      const fixed=await fixture(page,'ITEM        COUNT\nlamp           12\nboat            4','Original aligned columns',{fixed:true});
      await openFixture(page,base,fixed);await selectAll(page);
      await action(page,'make').click();await page.locator('.passage-card-preview[data-card-state="error"]').waitFor();
      assert.equal(await page.locator('.dialog-quote').textContent(),fixed.text,'Fixed columns are preserved when image export refuses them');
      assert.equal(await action(page,'save').isVisible(),false);assert.equal(await page.locator('[data-action="copy-passage"]').isVisible(),true);
      await page.locator('#dialog [data-action="close"]').click();
    }
    await openFixture(page,base,longer);await selectAll(page);
    await page.evaluate(()=>cardQA.delayBlob=true);
    await action(page,'make').click();await page.waitForFunction(()=>cardQA.pending.length===1);
    const allocated=await page.evaluate(()=>cardQA.urls.length);
    await page.locator('#dialog [data-action="close"]').click();
    await page.evaluate(()=>{cardQA.delayBlob=false;cardQA.pending.splice(0).forEach(finish=>finish());});
    await settle(page);
    assert.equal(await page.evaluate(()=>cardQA.urls.filter(item=>item.revocations===0).length),0,'Closing during generation cannot leave a live preview URL');
    assert.ok(await page.evaluate(count=>cardQA.urls.slice(count).every(item=>item.revocations===1),allocated),'Late completion is discarded or immediately revoked');
    assert.equal(await page.locator('#dialog').evaluate(dialog=>dialog.open),false,'Late generation never reopens a dismissed dialog');
    await selectAll(page);const reopened=await makeCard(page);assertRaster(reopened,longer);
    await page.locator('#dialog [data-action="close"]').click();await assertRevoked(page,reopened.url);
    if(project==='.') {
      await selectAll(page);await page.locator('#note-text').fill(privateNote);
      await page.evaluate(()=>cardQA.delayPreview=true);await action(page,'make').click();
      await page.waitForFunction(()=>cardQA.pendingPreviews.length===1);
      const count=await page.evaluate(()=>cardQA.urls.length);
      await action(page,'close').click();await assertDraft(page);
      await page.evaluate(async()=>{cardQA.delayPreview=false;await Promise.all(cardQA.pendingPreviews.splice(0).map(finish=>finish()));});
      await settle(page);
      assert.equal(await preview(page).isVisible(),false,'Late PNG encoding cannot reopen a closed preview');
      assert.equal(await page.evaluate(()=>cardQA.urls.length),count,'Closed preview encoding cannot allocate a stale object URL');
      await assertDraft(page);
      const recovered=await makeCard(page);assertRaster(recovered,longer);
      await action(page,'close').click();await assertRevoked(page,recovered.url);
      await page.locator('#note-text').fill('');await page.locator('#dialog [data-action="close"]').click();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(securityViolations,[]);
    return {engine,project,viewports,realPNG:true,pngSha256:card.digest,dimensions:[card.width,card.height],longDimensions:[tall.width,tall.height],exactDrawnWordsAndAttribution:true,
      noPrivateNoteSourceOrURL:true,synchronousPrebuiltNativeFile:true,OSShareStubbed:true,cancellationAndFailureKeepDraft:true,downloadBytesMatchPreview:true,
      unsupportedFileShareFallback:true,rasterFailureRetry:true,combinedSourceEmphasis:true,pendingShareRegeneration:true,savedPassage:true,staleEditionRefused:true,oversizedExcerptRefusedWithoutTruncation:true,unfittableVerseRefused:true,
      previewAndDialogCleanup:true,pendingGenerationCleanup:true,...(project==='.'?{heldEnterGuardAndFreshKeys:true,fixedColumnsRefused:true,pendingPreviewEncodingCleanup:true}:{}),contentSecurityPolicy,securityViolations,errors,external,physicalDeviceShareSheetTested:false};
  } catch(error) {
    const name=`${engine}-${project.replaceAll('/','-').replace('.','starter')}-failure`;
    await page.screenshot({path:new URL(name+'.png',output).pathname,animations:'disabled'}).catch(()=>{});
    await writeFile(new URL(name+'.json',output),JSON.stringify({error:error.message,errors,external,securityViolations,state:await page.evaluate(()=>({
      url:location.href,dialogOpen:document.querySelector('#dialog')?.open,dialog:document.querySelector('#dialog')?.textContent,
      selection:getSelection()?.toString(),selectionButton:document.querySelector('#selection-save')?.outerHTML,
      cardStatus:document.querySelector('.passage-card-status')?.textContent
    })).catch(()=>null)},null,2)+'\n');
    throw error;
  } finally {await context.close();}
}

export async function offlineCardChecks({browser,base,engine,stopOrigin,project='.'}) {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true}),page=await context.newPage(),errors=[],securityViolations=[];
  let lastRaster,phase='startup';
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('recordCardSecurityViolation',event=>securityViolations.push(event));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>window.recordCardSecurityViolation({directive:event.effectiveDirective,blockedURI:event.blockedURI})));
  await page.addInitScript(installObservers);
  try {
    await page.goto(base+'/');await page.locator('#main h1').waitFor();await appReady(page);
    const item=await fixture(page,shortText,'An original card made offline',{kind:'verse'});
    await openFixture(page,base,item);
    phase='cache readiness';
    await page.waitForFunction(()=>document.querySelector('#offline-status')?.textContent.includes('Available offline'));
    const controlledBeforeOffline=await page.evaluate(()=>!!navigator.serviceWorker.controller);
    // Do not rasterize online first: bundled card code and font variants must
    // really be available from the installed worker during their first use.
    assert.equal(await page.evaluate(()=>cardQA.rasters.length),0);
    phase='network outage';
    if(engine==='webkit') {
      await stopOrigin();
      await assert.rejects(()=>page.request.get(base+'/card-negative-control',{timeout:2000}));
    } else await context.setOffline(true);
    phase='offline reload';
    await page.reload();await page.locator(`#reading-text[data-book="${item.id}"][data-position-ready="true"]`).waitFor();await appReady(page);
    // A document requested during activation can miss clients.claim(). Verify
    // control on the actual offline navigation, after the cache is complete.
    phase='offline document control';
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(async()=>{
      try{await fetch('/card-negative-control',{cache:'no-store'});return false;}catch{return true;}
    }),true,'Direct network access is genuinely unavailable');
    await selectAll(page);await page.locator('#note-text').fill(privateNote);
    await page.waitForFunction(async id=>!!(await (await import('/db.mjs')).loadState()).positions[id],item.id);
    const before=await page.evaluate(async id=>(await (await import('/db.mjs')).loadState()).positions[id],item.id);
    phase='first offline card';
    const card=lastRaster=await makeCard(page);assertRaster(card,item);
    await saveImage(page,card);await assertDraft(page);
    assert.deepEqual(await page.evaluate(async id=>(await (await import('/db.mjs')).loadState()).positions[id],item.id),before,'Offline card making does not move the reading place');
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();
    await page.locator('#dialog').waitFor({state:'hidden'});await assertRevoked(page,card.url);
    phase='saved-note reload';
    await page.reload();await page.locator(`#reading-text[data-book="${item.id}"][data-position-ready="true"]`).waitFor();await appReady(page);
    const after=await page.evaluate(async()=>(await (await import('/db.mjs')).loadState()));
    assert.equal(after.notes.length,1);assert.equal(after.notes[0].quote,item.text);assert.equal(after.notes[0].note,privateNote);
    assert.deepEqual(after.positions[item.id],before);
    assert.deepEqual(errors,[]);assert.deepEqual(securityViolations,[]);
    return {engine,project,controlledBeforeOffline,firstCardCreatedOffline:true,serviceWorkerReload:true,realPNGAndDownload:true,noteSavedAndReloadedOffline:true,
      readingPlacePreserved:true,negativeControl:true,outage:engine==='webkit'?'origin stopped':'browser network disabled',errors,securityViolations};
  } catch(error) {
    const name=`${engine}-${project.replaceAll('/','-').replace('.','starter')}-offline-failure`;
    await page.screenshot({path:new URL(name+'.png',defaultOutput).pathname,animations:'disabled'}).catch(()=>{});
    const png=await page.evaluate(async()=>{
      const url=document.querySelector('[data-card-action="save"]')?.href,entry=cardQA.urls.find(item=>item.url===url);
      return entry?Array.from(new Uint8Array(await entry.blob.arrayBuffer())):null;
    }).catch(()=>null);
    if(png)await writeFile(new URL(name+'-export.png',defaultOutput),Buffer.from(png));
    const state=await page.evaluate(async()=>{
      const describe=worker=>worker?{script:worker.scriptURL,state:worker.state}:null,keys=await caches.keys();
      return {url:location.href,offline:document.querySelector('#offline-status')?.textContent,card:document.querySelector('.passage-card-status')?.textContent,
        worker:!!navigator.serviceWorker?.controller,controller:describe(navigator.serviceWorker?.controller),
        registrations:(await navigator.serviceWorker.getRegistrations()).map(registration=>({scope:registration.scope,active:describe(registration.active),waiting:describe(registration.waiting),installing:describe(registration.installing)})),
        caches:keys,cachedPaths:await Promise.all(keys.map(async name=>({name,paths:(await (await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)})))};
    }).catch(()=>null);
    console.error('Offline card failure: '+JSON.stringify({engine,project,phase,error:error.message,state}));
    await writeFile(new URL(name+'.json',defaultOutput),JSON.stringify({error:error.message,phase,errors,securityViolations,lastRaster,state},null,2)+'\n');
    throw error;
  } finally {await context.close();}
}

async function serve(project,skipBuild) {
  const folder=path.join(root,project);
  if(!skipBuild)await (await import(pathToFileURL(path.join(folder,'scripts/build.mjs')))).build();
  const {headers}=JSON.parse(await readFile(path.join(folder,'vercel.json'),'utf8'));
  assert.ok(headers.some(rule=>rule.source==='/(.*)'&&rule.headers.some(header=>header.key.toLowerCase()==='content-security-policy')),'Serve the actual site security policy');
  assert.ok(headers.every(rule=>rule.source==='/(.*)'||/^\/[a-zA-Z0-9_.-]+$/.test(rule.source)),'Handle every configured deployment header rule');
  const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
  const server=http.createServer(async(req,res)=>{
    try {
      const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
      if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name.startsWith('.'))throw Error('Not found');
      const bytes=await readFile(path.join(folder,'dist',name));
      for(const rule of headers)if(rule.source==='/(.*)'||rule.source==='/'+name)for(const header of rule.headers)res.setHeader(header.key,header.value);
      res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let stopped=false;
  const stop=async()=>{if(stopped)return;stopped=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));};
  return {server,base:'http://127.0.0.1:'+server.address().port,stop};
}

async function main() {
  const requested=(process.env.SHARE_CARD_PROJECTS||'.').split(',');
  const selected=requested.includes('all')?projects:projects.filter(project=>requested.includes(project));
  assert.ok(selected.length&&requested.every(project=>project==='all'||projects.includes(project)),'SHARE_CARD_PROJECTS must name known readers, or all');
  const offlineOnly=process.argv.includes('--offline-only'),suite=offlineOnly?'offline-only':'full';
  if(offlineOnly)assert.ok(selected.every(project=>project==='.'||project==='examples/music-and-feeling'),'Offline-only checks cover the starter and Music');
  const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
  const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),receipts=[];
  await mkdir(defaultOutput,{recursive:true});
  for(const project of selected) {
    const {base,stop}=await serve(project,process.argv.includes('--skip-build'));
    try {
      for(const engine of engines) {
        const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
        const browser=await playwright[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
        try {
          const report=offlineOnly?{engine,project}:await shareCardChecks({browser,base,engine,project});
          report.moduleSha256=hash(await readFile(path.join(root,project,'dist/share-card.mjs')));
          report.cssSha256=hash(await readFile(path.join(root,project,'dist/share-card.css')));
          if(project==='.'||project==='examples/music-and-feeling') {
            const offline=await serve(project,true);
            try{report.offline=await offlineCardChecks({browser,base:offline.base,engine,project,stopOrigin:offline.stop});}
            finally{await offline.stop();}
          }
          receipts.push(report);
          await writeFile(new URL('receipt.json',defaultOutput),JSON.stringify({suite,complete:false,receipts},null,2)+'\n');
          console.log(`${engine} ${project}: ${offlineOnly?'offline first-card PNG, download, saved note, reading place and network negative control':'PNG, source attribution, private draft, synchronous share, download, responsive layout and cleanup'} passed.`);
        } finally {await browser.close();}
      }
    } finally {await stop();}
  }
  await writeFile(new URL('receipt.json',defaultOutput),JSON.stringify({suite,complete:true,receipts},null,2)+'\n');
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))await main();
