import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.SHOWCASE_TEST_PORT||4321),base='http://127.0.0.1:'+port,out=new URL('../test-results/showcase/readers/',import.meta.url);await mkdir(out,{recursive:true});
const allEntries=[['austen','austen-pride-1894','chapter-1','chapter-2'],['alice','alice-rackham-28885','chapter-01','chapter-02'],['walden','walden','chap02','chap03'],['two-halls','hegel','section-3','section-4'],['odyssey','odyssey-butler-1727','book-01','book-02'],['dracula','dracula','chap01','chap02'],['at-table','savarin','s226','s249'],['inward-life','julian','s13','s14'],['beside-the-bed','nightingale-1898','id00210','id00287'],['learning-to-see','ruskin','preface','letter-1'],['music-and-feeling','hanslick','preface','chapter-1']];
const requested=process.env.READER_CHECK_IDS?.split(',');
if(requested)assert.ok(requested.length&&requested.every(id=>allEntries.some(e=>e[0]===id)),'Unknown reader check selection');
const entries=requested?allEntries.filter(e=>requested.includes(e[0])):allEntries;
const collectionIds=new Set(['at-table','inward-life','music-and-feeling','learning-to-see','beside-the-bed']);
const result={checkedAt:new Date().toISOString(),passed:false,browsers:[],limits:'Combined-site developer check in Chromium/WebKit. Real stopped-origin reloads; not native home-screen installation, physical iOS or deployed HTTPS verification.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(result,null,2)+'\n');
const ready=(p,b,s)=>p.locator(`#reading-text[data-book="${b}"][data-section="${s}"][data-position-ready="true"]`).waitFor();
const collectionFonts={'at-table':'Newsreader','inward-life':'Literata','music-and-feeling':'Gentium Plus','learning-to-see':'Alegreya','beside-the-bed':'Bitter'};
async function loadedCollectionFont(page,slug){
 const family=collectionFonts[slug];if(!family)return;
 const proof=await page.evaluate(async family=>{
  const faces=await Promise.all(['normal 400','italic 400','normal 700','italic 700'].map(async variant=>{const loaded=await document.fonts.load(`${variant} 24px "${family}"`);return loaded.length>0&&loaded.every(f=>f.status==='loaded')}));
  await document.fonts.ready;
  return {faces,family:getComputedStyle(document.querySelector('#reading-text')).fontFamily};
 },family);
 assert.ok(proof.family.replaceAll('"','').replaceAll("'",'').startsWith(family),slug+' applies its chosen reading font');
 assert.ok(proof.faces.every(Boolean),slug+' serves real upright/italic and normal/bold faces: '+JSON.stringify(proof));
}
async function stableChrome(page,label){
 const heights=await page.evaluate(async()=>{const values=[];for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);values.push(document.querySelector('.masthead').getBoundingClientRect().height)}return values});
 assert.ok(Math.max(...heights)-Math.min(...heights)<.1,label+' header stays still between frames: '+heights);
}

const companionCollections=new Set(['at-table','inward-life','beside-the-bed','learning-to-see','music-and-feeling']);
const collectionBooks=new Map(await Promise.all(entries.filter(([slug])=>companionCollections.has(slug)).map(async([slug])=>[slug,JSON.parse(await readFile(new URL('dist/'+slug+'/library.json',import.meta.url)))])));
const stateFor=(page,slug)=>page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);
function sourceRange(books,ref){
 const book=books.find(b=>b.id===ref.book),section=book?.sections.find(s=>s.id===ref.section),first=section?.blocks.findIndex(b=>b.id===ref.first),last=section?.blocks.findIndex(b=>b.id===(ref.last||ref.first));
 assert.ok(book&&section&&first>=0&&last>=first,'Companion reference resolves in the admitted edition: '+JSON.stringify(ref));
 return {book,section,blocks:section.blocks.slice(first,last+1)};
}
async function exactFragment(locator,books,ref,label,{excerpt=false}={}){
 const {blocks}=sourceRange(books,ref);await locator.locator('[data-block]').first().waitFor();
 assert.deepEqual(await locator.locator('[data-block]').evaluateAll(es=>es.map(e=>({id:e.dataset.block,text:e.textContent}))),blocks.map(b=>({id:b.id,text:b.text})),label+' exact source blocks');
 assert.equal(await locator.textContent(),blocks.map((b,i)=>b.text+(excerpt&&i===blocks.length-1?'':b.after)).join(''),label+' source separators');
}
async function sourceDialog(page,button,books,ref,label){
 const {book,section}=sourceRange(books,ref);await button.click();const context=page.locator('#dialog[open] #context-text[data-location-ready="true"]');await context.waitFor();
 assert.equal(await context.getAttribute('data-book'),ref.book,label+' context book');assert.equal(await context.getAttribute('data-section'),ref.section,label+' context section');
 let contextBlocks=section.blocks;
 if(book.profile==='music-and-feeling/edition@1'&&section.id==='notes'){
  const starts=new Set(book.sections.flatMap(s=>s.blocks.flatMap(b=>(b.refs||[]).map(r=>r.target))));
  let from=section.blocks.findIndex(b=>b.id===ref.first);while(from>0&&!starts.has(section.blocks[from].id))from--;
  let end=from+1;while(end<section.blocks.length&&!starts.has(section.blocks[end].id))end++;
  contextBlocks=section.blocks.slice(from,end);assert.ok(contextBlocks.some(b=>b.id===ref.last),'The complete source note includes the full selected range');
 }
 assert.equal(await context.textContent(),contextBlocks.map(b=>b.text+b.after).join(''),label+' complete context');
 assert.equal(await context.locator(`[data-block="${ref.first}"]`).textContent(),section.blocks.find(b=>b.id===ref.first).text,label+' target exists');
 await page.locator('#dialog [data-action="close"]').first().click();await page.locator('#dialog').waitFor({state:'hidden'});
}
async function inwardCompanionTextResize(page){
 const viewport=page.viewportSize(),prefs=(await stateFor(page,'inward-life')).prefs,hash=await page.evaluate(()=>location.hash),cases=[];
 const routes=[['truth','What makes an experience feel true?'],['love','What happens to the self in love?'],['living','How should inward experience change living?'],['voices','Who is speaking?']];
 const setSize=async size=>{await page.locator('[data-action="settings"]').first().click();await page.locator('#dialog[open] #size').fill(String(size));await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'})};
 try{
  for(const width of [320,390])for(const size of [21,36]){
   await page.setViewportSize({width,height:844});await setSize(size);
   for(const [key,title]of routes){
    await page.goto(base+'/inward-life/#companion/'+(key==='voices'?'voices':'doors/'+key));
    await page.waitForFunction(title=>document.querySelector('.collection-studies>h1')?.textContent===title,title);
    if(key==='voices'){await page.locator('[data-action="study-control"][data-value="0"]').click();await page.locator('[data-action="study-control"][data-value="0"][aria-pressed="true"]').waitFor()}
    await page.locator('.study-source .reading-surface [data-block]').first().waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished))});
    const text=await page.locator('.study-source .reading-surface').allTextContents();
    await page.evaluate(()=>{const elements=[...document.querySelectorAll('body,body *')],sizes=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));window.inwardZoomRestore=elements.map(e=>[e,e.style.fontSize]);elements.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px')});
    try{
     await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
     const geometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,sourceSize:parseFloat(getComputedStyle(document.querySelector('.study-source .reading-surface .prose')).fontSize)}));
     assert.equal(geometry.sourceSize,size*2,'Inward Life '+key+' retains doubled source type at '+width+'px');
     assert.ok(geometry.width<=width,'Inward Life '+key+' companion reflows at 200% text: '+JSON.stringify(geometry));
     assert.deepEqual(await page.locator('.study-source .reading-surface').allTextContents(),text,'Text enlargement preserves every source word and separator');
     cases.push({route:key,width,size,textScale:2,sourceSize:geometry.sourceSize,documentWidth:geometry.width});
    }finally{await page.evaluate(()=>{for(const[e,size]of window.inwardZoomRestore)e.style.fontSize=size;delete window.inwardZoomRestore})}
   }
  }
 }finally{await setSize(prefs.size);await page.setViewportSize(viewport);await page.goto(base+'/inward-life/'+hash);await page.locator('.collection-studies').waitFor()}
 return cases;
}
async function besideGuardedAbout(browser,books){
 // Separate fresh contexts keep customized import fixtures out of the main
 // reader's saved-place, note and offline-cache checks.
 for(const customized of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const fixtures=structuredClone(books);
  if(customized)for(const book of fixtures)book.context[1].text+=' Original customized import fixture.';
  try{
   if(customized){
    await page.goto(base+'/beside-the-bed/robots.txt');
    await page.evaluate(async records=>{const {saveBook}=await import('/beside-the-bed/db.mjs');for(const book of records)await saveBook(book);},fixtures);
   }
   for(const [i,book]of fixtures.entries()){
    // Worker registration is blocked only for these presentation fixtures.
    // Await the actual source response rather than its offline-ready promise.
    const notices=i===0?page.waitForResponse(r=>new URL(r.url()).pathname==='/beside-the-bed/notices.json'):null;
    const section=book.id==='nightingale-1898'?'id00004':'w001';
    await page.goto(base+'/beside-the-bed/#read/'+book.id+'/'+section);await ready(page,book.id,section);
    if(notices){await (await notices).finished();await page.waitForTimeout(100)}
    await page.locator('[data-action="background"]').click();
    const contexts=page.locator('#dialog[open] .context-item .companion-reading');await contexts.first().waitFor();
    assert.equal(await contexts.nth(0).textContent(),book.context[0].text,'About retains exact edition identity/limitations');
    const supplied=book.context[1].text,expected=customized?supplied:supplied.replace(' This local reader has not been published.','');
    assert.equal(await contexts.nth(1).textContent(),expected,customized?'Customized imported context is not rewritten':'Known exact edition omits obsolete publication claim');
    assert.equal(await page.locator('#dialog .context-item').nth(1).locator('a').getAttribute('href'),book.context[1].url,'Source attribution link is retained');
    await page.keyboard.press('Escape');await page.locator('#dialog').waitFor({state:'hidden'});
   }
   if(customized)assert.deepEqual(await page.evaluate(async()=>(await import('/beside-the-bed/db.mjs')).rawBooks()),fixtures,'Display correction never rewrites imported books');
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
}

async function musicGuardedAbout(browser,books){
 for(const customized of [false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const book=structuredClone(books.find(book=>book.id==='hanslick'));
  if(customized)book.context[2].text+=' Customized same-ID import fixture.';
  try{
   if(customized){
    await page.goto(base+'/music-and-feeling/robots.txt');
    await page.evaluate(async book=>{const {saveBook}=await import('/music-and-feeling/db.mjs');await saveBook(book);},book);
   }
   await page.goto(base+'/music-and-feeling/#read/hanslick/preface');await ready(page,'hanslick','preface');
   await page.locator('[data-action="background"]').click();
   const contexts=page.locator('#dialog[open] .context-item .companion-reading');await contexts.first().waitFor();
   const expected=book.context.map((item,i)=>!customized&&i===2?item.text.replace('1891 Novello printing','1891-dated Cohen edition'):item.text);
   assert.deepEqual(await contexts.allTextContents(),expected,customized?'Customized Hanslick context remains supplied':'Exact Hanslick About uses qualified date and retains other context');
   assert.equal(await page.locator('#dialog .small').first().textContent(),book.edition,'Hanslick edition identity retained');
   for(const [i,item]of book.context.entries())if(item.url)assert.equal(await page.locator('#dialog .context-item').nth(i).locator('a').getAttribute('href'),item.url,'Hanslick source URL retained');
   if(customized)assert.deepEqual(await page.evaluate(async()=>(await import('/music-and-feeling/db.mjs')).rawBooks()),[book],'Display correction never rewrites customized Hanslick');
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
}

async function learningResetFocus(page){
 const results=[];
 for(const key of ['Enter','Space']){
  await page.locator('#exit-height').fill('160');
  await page.locator('#exit-height').dispatchEvent('input');
  await page.locator('#pattern-reset').focus();
  const before=await page.evaluate(()=>scrollY);
  await page.keyboard.press(key);
  await page.waitForFunction(()=>document.querySelector('#exit-height')?.value==='188'&&document.activeElement?.id==='pattern-reset');
  assert.equal(await page.locator('#stem-bend').inputValue(),'86','Reset restores the original bend');
  assert.equal(await page.locator('#join-view').getAttribute('aria-pressed'),'false','Reset restores original join placement');
  assert.equal(await page.locator('#grid-view').getAttribute('aria-pressed'),'true','Reset restores visible boundaries');
  const after=await page.evaluate(()=>scrollY);
  assert.ok(Math.abs(after-before)<2,'Reset refocus does not move the workbench');
  results.push({activation:key,focused:'pattern-reset',scrollBefore:before,scrollAfter:after});
 }
 // Model a real pointer click that does not natively focus Reset, as on Safari.
 // Suppress mousedown focus so the condition is deterministic in both engines.
 await page.locator('#exit-height').fill('160');
 await page.locator('#exit-height').dispatchEvent('input');
 await page.locator('#pattern-reset').scrollIntoViewIfNeeded();
 await page.locator('.masthead [data-action="settings"]').evaluate(node=>node.focus({preventScroll:true}));
 await page.locator('#pattern-reset').evaluate(node=>node.addEventListener('mousedown',event=>event.preventDefault(),{once:true}));
 await page.locator('#pattern-reset').click();
 await page.waitForFunction(()=>document.querySelector('#exit-height')?.value==='188');
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'settings','An unfocused pointer reset must not steal focus');
 results.push({activation:'pointer without native focus',focused:'settings',focusNotStolen:true});
 return results;
}

async function collectionCompanion(page,slug,book,first,offline){
 const books=collectionBooks.get(slug),label=slug+(offline?' offline':' online');let fragments=0,contexts=0,sourceImages=0,workbenchChanges=0,companionTextResize=[],resetFocusChecks=[];
 // Establish a real main-book position before the excursion, then await its persisted record.
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#reading-text [data-block]').evaluateAll(es=>{const candidates=es.filter(e=>e.textContent.length>60),target=candidates[Math.min(2,candidates.length-1)];if(!target)throw Error('No substantial source block');target.scrollIntoView({block:'start'});scrollBy(0,-120)});
 await page.waitForTimeout(400);
 let before;
 for(let attempt=0;attempt<50;attempt++){before=await stateFor(page,slug);if(before.positions[book]?.sectionId===first&&before.positions[book]?.blockId)break;await page.waitForTimeout(100)}
 assert.ok(before.positions[book]?.blockId,label+' has a persisted source position');
 const companionHash=await page.locator('[data-nav="companion"]').getAttribute('href');assert.ok(companionHash.startsWith('#companion'));await page.goto(base+'/'+slug+'/'+companionHash);
 if(offline)await page.reload();
 const unchanged=async()=>{const state=await stateFor(page,slug);assert.deepEqual(state.positions,before.positions,label+' source excursion preserves every main position');assert.equal(state.lastBook,before.lastBook,label+' source excursion preserves the main book');assert.deepEqual(state.notes,before.notes,label+' source excursion preserves saved notes')};
 const context=async(button,ref)=>{await sourceDialog(page,button,books,ref,label);contexts++;await unchanged()};
 if(slug==='at-table'){
  const pairs=[
   [['savarin','s2042','b-id02231','b-id02235'],['beeton','s521','b-id00577','b-id00583'],['estes','soups','b45']],
   [['savarin','s648','b-id00662','b-id00667'],['beeton','s521','b-id00531','b-id00539'],['estes','soups','b47']],
   [['savarin','s709','b-id00943','b-id00949'],['beeton','s9922','b-id09929','b-id09934'],['estes','pies-and-pastries','b473']]
  ];
  await page.locator('.table-comparison').waitFor();assert.equal(await page.locator('[data-action="study-choice"]').count(),3,label+' ingredient choices');
  for(let choice=0;choice<pairs.length;choice++){
   await page.locator(`[data-action="study-choice"][data-choice="${choice}"]`).click();assert.equal(await page.locator(`[data-action="study-choice"][data-choice="${choice}"]`).getAttribute('aria-pressed'),'true');
   for(const [book,section,from,to=from]of pairs[choice]){const ref={book,section,first:from,last:to},source=page.locator('#voice-'+book);await exactFragment(source.locator('[data-fragment]'),books,ref,label,{excerpt:true});fragments++;await context(source.locator('[data-action="source-reference"]'),ref)}
  }
  await page.locator('a[href="#study/authority"]').click();await page.locator('.table-authority').waitFor();
  const refs=[['estes','foreword','b13','b15'],['beeton','s251','b-id00255','b-id00257'],['estes','sketch-of-my-life','b18','b24'],['estes','hints-to-kitchen-maids','b30','b35']];
  for(let i=0;i<refs.length;i++){const [book,section,from,to]=refs[i],ref={book,section,first:from,last:to},source=page.locator('.table-authority .study-source').nth(i);await exactFragment(source.locator('[data-fragment]'),books,ref,label,{excerpt:true});fragments++;await context(source.locator('[data-action="source-reference"]'),ref)}
 }else if(slug==='inward-life'){
  const questions=[
   ['truth',[['james','b1008','b1014'],['julian','b1278','b1282'],['tagore','b12','b15']]],
   ['love',[['julian','b243','b250'],['tagore','b186','b190'],['james','b1125','b1128']]],
   ['living',[['tagore','b234','b241'],['julian','b264','b269'],['james','b1274','b1277']]]
  ];
  await page.locator('.doors-entrance').waitFor();assert.equal(await page.locator('.door-choices a').count(),3,label+' three reading questions');
  const checkSources=async(refs)=>{for(let i=0;i<refs.length;i++){const [book,from,to]=refs[i],section=books.find(b=>b.id===book).sections.find(s=>s.blocks.some(b=>b.id===from)),ref={book,section:section.id,first:from,last:to},source=page.locator('.study-source').nth(i);await exactFragment(source.locator('[data-study-fragment]'),books,ref,label);fragments++;await context(source.locator('button[data-action="source-link"]'),ref)}};
  for(const [key,refs]of questions){await page.locator(`a[href="#companion/doors/${key}"]`).click();await page.locator('.doors-reading').waitFor();await checkSources(refs);await page.locator('.study-path a[href="#companion/doors"]').click();await page.locator('.doors-entrance').waitFor()}
  await page.locator('a[href="#companion/voices"]').click();await page.locator('.mediation').waitFor();
  for(const [i,ref]of [['julian','b29','b29'],['tagore','b16','b18'],['james','b1125','b1128']].entries()){await page.locator(`[data-action="study-control"][data-value="${i}"]`).click();assert.equal(await page.locator(`[data-action="study-control"][data-value="${i}"]`).getAttribute('aria-pressed'),'true');await checkSources([ref])}
  if(!offline)companionTextResize=await inwardCompanionTextResize(page);
 }else if(slug==='learning-to-see'){
  const data=JSON.parse(await readFile(new URL('dist/'+slug+'/study-data.json',import.meta.url)));
  const reference=key=>{const ref=data.sources[key];assert.ok(ref?.blocks?.length,label+' has a source study');const range={book:ref.book,section:ref.section,first:ref.blocks[0],last:ref.blocks.at(-1)};assert.deepEqual(sourceRange(books,range).blocks.map(b=>b.id),ref.blocks);return range};
  const assetFor=key=>{const ref=data.figures[key],asset=books.find(b=>b.id===ref.book)?.assets.find(a=>a.id===ref.asset);assert.ok(asset,label+' has its reviewed source image');return {ref,asset,url:`data:${asset.type};base64,${asset.data}`}};
  const drawingContext=async(key,button)=>{const ref=reference(key),{section}=sourceRange(books,ref);await button.click();const reading=page.locator('#dialog[open] #source-reading');await reading.waitFor();assert.equal(await reading.getAttribute('data-book'),ref.book);assert.deepEqual(await reading.locator('[data-block]').evaluateAll(es=>es.map(e=>({id:e.dataset.block,text:e.textContent}))),section.blocks.map(b=>({id:b.id,text:b.text})),label+' complete illustrated source context');await page.locator('#dialog [data-action="close"]').first().click();await page.locator('#dialog').waitFor({state:'hidden'});contexts++;await unchanged()};
  const plate=async(key,button)=>{const {asset,url}=assetFor(key);await button.click();const image=page.locator('#dialog[open] #detail-image');await image.waitFor();assert.ok(await image.getAttribute('src')===url,label+' whole-plate pixels match the admitted image');const actual=await image.evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight}});assert.deepEqual(actual,{width:asset.width,height:asset.height});await page.locator('[data-action="plate-original"]').click();assert.equal(await page.locator('.plate-viewport').getAttribute('data-mode'),'original');await page.locator('[data-action="plate-fit"]').click();assert.equal(await page.locator('.plate-viewport').getAttribute('data-mode'),'fit');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await image.evaluate(img=>{const frame=img.parentElement,r=img.getBoundingClientRect();return r.width>0&&r.height>0&&r.width<=frame.clientWidth+.5&&r.height<=frame.clientHeight+.5}),label+' Fit image contains the entire plate');await page.locator('#dialog [data-action="close"]').first().click();await page.locator('#dialog').waitFor({state:'hidden'});sourceImages++;await unchanged()};
  await page.locator('.comparison-pair').waitFor();
  for(const view of ['whole','upper','fork']){
   await page.locator(`[data-inspection="${view}"]`).click();await page.locator(`[data-pair-view="${view}"]`).waitFor();assert.equal(await page.locator(`[data-inspection="${view}"]`).getAttribute('aria-pressed'),'true');
   for(const [i,key]of ['olive-nature','olive-design'].entries()){
    const {ref,asset,url}=assetFor(key),button=page.locator('.comparison-pair [data-action="plate"]').nth(i);assert.equal(await button.getAttribute('data-book'),ref.book);assert.equal(await button.getAttribute('data-asset'),ref.asset);
    if(view==='whole'){const image=button.locator('img');assert.ok(await image.getAttribute('src')===url,label+' paired source pixels match');assert.deepEqual(await image.evaluate(async img=>{await img.decode();return [img.naturalWidth,img.naturalHeight]}),[asset.width,asset.height])}
    else{const svg=button.locator('svg'),box=(await svg.getAttribute('viewBox')).split(' ').map(Number);assert.ok(box.length===4&&box[2]>0&&box[3]>0&&box[2]<asset.width&&box[3]<asset.height,label+' actual paired detail viewport');assert.ok(await svg.locator('image').getAttribute('href')===url,label+' crop uses the same complete source pixels')}
    await plate(key,button);
   }
  }
  const evidence=page.locator('details.study-evidence').filter({has:page.locator('[data-study-excerpt="olive"]')});await evidence.locator('summary').click();await exactFragment(page.locator('[data-study-excerpt="olive"]'),books,reference('olive'),label);fragments++;await drawingContext('olive',evidence.locator('[data-action="study-source"]'));
  for(const key of ['boughs','letter'])await drawingContext(key,page.locator(`[data-action="study-source"][data-source-key="${key}"]`));
  await page.locator('.study-nav a[href="#companion/repeat"]').click();await page.locator('#repeat-preview svg').waitFor();
  const original=await page.locator('#repeat-preview svg').evaluate(e=>e.outerHTML);
  await page.locator('#exit-height').evaluate(input=>{input.value='160';input.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.locator('#exit-output').textContent(),'160');assert.notEqual(await page.locator('#repeat-preview svg').evaluate(e=>e.outerHTML),original,label+' exit input redraws the actual repeated SVG');workbenchChanges++;
  const bent=await page.locator('#repeat-preview svg').evaluate(e=>e.outerHTML);await page.locator('#stem-bend').evaluate(input=>{input.value='120';input.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.locator('#bend-output').textContent(),'120');assert.notEqual(await page.locator('#repeat-preview svg').evaluate(e=>e.outerHTML),bent,label+' bend input redraws the actual repeated SVG');workbenchChanges++;
  await page.locator('#join-view').click();assert.equal(await page.locator('#join-view').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#repeat-preview pattern').getAttribute('x'),'-120');workbenchChanges++;
  await page.locator('#grid-view').click();assert.equal(await page.locator('#grid-view').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#repeat-preview [stroke-dasharray]').count(),0);workbenchChanges++;
  const repeat=page.locator('details.study-evidence').filter({has:page.locator('[data-study-excerpt="repeat"]')});await repeat.locator('summary').click();await exactFragment(page.locator('[data-study-excerpt="repeat"]'),books,reference('repeat'),label);fragments++;await drawingContext('repeat',repeat.locator('[data-action="study-source"]'));
  const diagram=page.locator('details.study-evidence').filter({has:page.locator('[data-action="plate"]')});await diagram.locator('summary').click();await plate('repeat',diagram.locator('[data-action="plate"]'));
  resetFocusChecks=await learningResetFocus(page);
 }else if(slug==='music-and-feeling'){
  if(!offline)await musicGuardedAbout(page.context().browser(),books);
  const {ninth}=JSON.parse(await readFile(new URL('dist/'+slug+'/studies.json',import.meta.url)));
  await page.locator('.ninth-pair').waitFor();assert.equal(await page.locator('#ninth-guide').getAttribute('open'),null,label+' commentary is optional on entry');
  const ranges=ninth.refs.map(ref=>({book:ref.book,section:ref.section,first:ref.blocks[0],last:ref.blocks.at(-1)}));
  for(const [i,annotation]of ninth.annotations.entries()){
   const control=page.locator(`[data-action="study-annotation"][data-index="${i}"]`);await control.focus();const scroll=await page.evaluate(()=>scrollY);await control.press('Enter');
   await page.waitForFunction(i=>document.activeElement?.dataset.action==='study-annotation'&&document.activeElement?.dataset.index===String(i),i);
   assert.equal(await control.getAttribute('aria-pressed'),'true',label+' selected Ninth criterion remains active');
   assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<=1,label+' Ninth focus restoration does not scroll');
   for(const [j,ref]of ninth.refs.entries()){
    const {blocks}=sourceRange(books,ranges[j]);assert.deepEqual(blocks.map(b=>b.id),ref.blocks,label+' continuous source range');
    const expected=blocks.map((b,k)=>b.text.slice(k===0?(ref.start||0):0,k===blocks.length-1?(ref.end??b.text.length):b.text.length)+(k<blocks.length-1?b.after:'')).join('');
    const source=page.locator('.ninth-pair .study-source').nth(j);await source.locator('[data-block]').first().waitFor();assert.equal(await source.locator('.fragment-surface').textContent(),expected,label+' exact Ninth passage');fragments++;
    assert.equal(await source.locator('mark.criterion').textContent(),annotation.phrases[j],label+' actual source phrase highlighted');
    await context(source.locator('[data-action="study-context"]'),ranges[j]);
   }
   assert.equal(await page.locator('#ninth-guide').getAttribute('open'),null,label+' switching emphasis does not force commentary open');
   await page.locator('#ninth-guide summary').click();assert.ok(await page.locator('#ninth-guide p').first().textContent()===annotation.copy,label+' selected commentary');await page.locator('#ninth-guide summary').click();await unchanged();
  }
  for(const details of await page.locator('.study-method').all()){await details.locator('summary').click();assert.ok((await details.textContent()).length>100,label+' optional methodological context');await details.locator('summary').click()}
 }else if(slug==='beside-the-bed'){
  if(!offline)await besideGuardedAbout(page.context().browser(),books);
  const studies=JSON.parse(await readFile(new URL('dist/'+slug+'/studies.json',import.meta.url))),essay=JSON.parse(await readFile(new URL('dist/'+slug+'/sources.json',import.meta.url)));
  for(const study of studies){
   await page.goto(base+'/'+slug+'/#companion/'+study.id+'/0');await page.locator(`[data-study="${study.id}"]`).waitFor();assert.equal(await page.locator('.study-heading h1').textContent(),study.title);
   if(await page.locator('[data-action="study-open"]').count())await page.locator('[data-action="study-open"]').click();
   for(const [i,step]of study.steps.entries()){
    await page.locator('#study-stage').selectOption(String(i));await page.locator(`[data-study="${study.id}"][data-stage="${i}"][data-open="true"]`).waitFor();
    assert.equal(await page.locator('.study-body h2').textContent(),step.title);await exactFragment(page.locator('[data-study-text]'),books,step.source,label);fragments++;
    assert.equal(await page.locator('.study-annotation p').textContent(),step.copy,label+' companion explanation loaded');
    if(study.id==='room'){
     if(!await page.locator('.rereading-tools').evaluate(e=>e.open))await page.locator('.rereading-tools summary').click();
     for(const lens of ['visitor','listener','plain']){
      const control=page.locator(`[data-lens="${lens}"]`);await control.focus();const scroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');
      await page.waitForFunction(lens=>document.activeElement?.dataset.lens===lens,lens);
      assert.equal(await control.getAttribute('aria-pressed'),'true',label+' selected Room mark remains active');
      assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<=1,label+' Room mark focus does not scroll the page');
      await exactFragment(page.locator('[data-study-text]'),books,step.source,label+' Room mark changes preserve the source');workbenchChanges++;
     }
     if(step.verse)for(const mode of ['fixed','wrap']){
      await page.locator('#study-lines').focus();const scroll=await page.evaluate(()=>scrollY);await page.locator('#study-lines').selectOption(mode);
      await page.waitForFunction(()=>document.activeElement?.id==='study-lines');
      assert.equal(await page.locator('#study-lines').inputValue(),mode);
      assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<=1,label+' Hymn lines focus does not scroll the page');
      assert.equal(await page.locator(`[data-block="${step.source.last}"]`).evaluate(e=>getComputedStyle(e).whiteSpace),mode==='fixed'?'pre':'pre-wrap');
      await exactFragment(page.locator('[data-study-text]'),books,step.source,label+' line layout preserves the source');workbenchChanges++;
     }
    }
    await context(page.locator('[data-action="study-context"]'),step.source);if(step.related)await context(page.locator('[data-action="study-related"]'),step.related);
   }
  }
  await page.locator('.companion-afterword a[href="#sources/record"]').click();await page.locator('[data-source-essay="record"]').waitFor();assert.equal(await page.locator('.sources-page h1').textContent(),essay.title);
  for(const [i,part]of essay.parts.entries()){const section=page.locator('.source-essay>section').nth(i);assert.equal(await section.locator('.companion-reading').textContent(),part.text,label+' source essay loaded');await context(section.locator('[data-action="essay-context"]:not([data-related])'),part.source);if(part.related)await context(section.locator('[data-related="true"]'),part.related)}
 }
 await unchanged();await page.locator(`main [data-action="resume"][data-book="${book}"]`).first().click();await ready(page,book,first);
 if(slug==='music-and-feeling'){
  const hanslick=books.find(b=>b.id==='hanslick'),leaf=hanslick.pages.find(p=>p.id==='leaf-102'),asset=hanslick.assets.find(a=>a.id===leaf.asset);
  await page.locator('[data-action="background"]').click();assert.ok(await page.locator('#scan-leaf').evaluate(el=>el.getBoundingClientRect().height>=48),label+' source scan selector retains a 48px target in both engines');await page.locator('#scan-leaf').selectOption('leaf-102');await page.locator('#dialog [data-action="facsimile"]').click();const image=page.locator('#dialog .facsimile-view img');await image.waitFor();
  await page.waitForFunction(()=>{const i=document.querySelector('#dialog .facsimile-view img');return i?.complete&&i.naturalWidth>0});
  const pixels=await readFile(new URL('dist/'+slug+'/'+asset.file,import.meta.url));assert.equal(await image.getAttribute('src'),'data:image/jpeg;base64,'+pixels.toString('base64'),label+' exact printed source pixels');
  assert.deepEqual(await image.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[asset.width,asset.height]);await page.locator('[data-action="scan-size"]').click();assert.equal(await page.locator('.facsimile-view').getAttribute('class'),'facsimile-view enlarged');
  await page.locator('#dialog [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});sourceImages++;
 }
 const after=await stateFor(page,slug);assert.equal(after.positions[book].blockId,before.positions[book].blockId,label+' return restores the original source block');
 return {slug,offline,exactFragments:fragments,completeSourceContexts:contexts,sourceImages,workbenchChanges,companionTextResize,resetFocusChecks,mainPlacePreserved:true};
}

for(const engine of ['chromium','webkit']){
 let server=await serve(port),browser;
 try{
  browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
  const context=await browser.newContext({viewport:{width:402,height:874}}),pages=[],errors=[],requests=[],companionChecks=[];result.inProgress={engine,companionChecks};
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));context.on('request',r=>requests.push(r.url()));
  for(const [slug,book,first] of entries){
   const page=await context.newPage();pages.push(page);const url=base+'/'+slug+'/';await page.goto(url+'#read/'+book+'/'+first);await ready(page,book,first);
   if(await page.locator('#dialog[open]').count()){
    const notice=page.locator('[data-action="notice-read"], [data-action="notice-continue"]');
    if(await notice.isVisible())await notice.click();
    else await page.locator('#dialog .close-dialog').click();
    await page.locator('#dialog').waitFor({state:'hidden'});
   }
   await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'),{},{timeout:60000});
   const canonical=JSON.parse(await readFile(new URL('dist/'+slug+'/library.json',import.meta.url))).find(b=>b.id===book).sections.find(s=>s.id===first).blocks.map(b=>b.text+b.after).join('');
   assert.equal(await page.locator('#reading-text').textContent(),canonical);
   await loadedCollectionFont(page,slug);
   await stableChrome(page,slug+' normal type');
   for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);
    await page.locator('[data-action="settings"]').first().click();
    await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished)));
    await page.locator('#dialog[open] #settings-form').waitFor();
    const menuHeights=await page.locator('#settings-form select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(menuHeights.length>0&&menuHeights.every(h=>h>=43.5),slug+' settings menus retain full touch targets: '+menuHeights);
    await page.locator('#dialog [data-action="close"]').click();
    await page.evaluate(()=>{const es=[...document.querySelectorAll('body,body *')],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));window.zoomRestore=es.map(e=>[e,e.style.fontSize]);es.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px')});
    await page.waitForTimeout(100);
    await stableChrome(page,slug+' enlarged type');
    assert.ok(await page.locator('.masthead').evaluate(e=>{const a=e.querySelector('.wordmark').getBoundingClientRect(),b=e.querySelector('.type-button').getBoundingClientRect();return b.top>=a.bottom-1||b.left>=a.right+3}),slug+' settings target clears the title');
    const overflow=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed'}).slice(0,20).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,90),right:e.getBoundingClientRect().right}))}));
    if(overflow.width>overflow.viewport){await page.screenshot({path:new URL(engine+'-'+slug+'-'+width+'-overflow.png',out).pathname});await writeFile(new URL(engine+'-'+slug+'-'+width+'-overflow.json',out),JSON.stringify(overflow,null,2)+'\n');}
    assert.ok(overflow.width<=overflow.viewport,slug+' reflows at 200% text on '+width+'px: '+JSON.stringify(overflow));
    assert.ok(await page.locator('.masthead').evaluate(e=>{const brand=e.querySelector('.wordmark').getBoundingClientRect(),nav=e.querySelector('nav').getBoundingClientRect();return nav.top>=brand.bottom-1||nav.left>=brand.right}),slug+' navigation does not overlap its title');
    await page.screenshot({path:new URL(engine+'-'+slug+'-'+width+'-text-200.png',out).pathname});
    await page.evaluate(()=>{for(const[e,size]of window.zoomRestore)e.style.fontSize=size;delete window.zoomRestore});
   }
   await page.setViewportSize({width:402,height:874});await page.waitForTimeout(100);
   await page.evaluate(()=>{const block=[...document.querySelectorAll('#reading-text [data-block]')].find(e=>e.textContent.length>60),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())&&n.length<35){};const r=document.createRange();r.setStart(n,0);r.setEnd(n,30);getSelection().removeAllRanges();getSelection().addRange(r);});
   await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original '+slug+' combined-site test note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.reload();await ready(page,book,first);
   assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),'/'+slug+'/sw.js');
   const manifest=await (await page.request.get(url+'manifest.webmanifest')).json();assert.equal(manifest.scope,'/'+slug+'/');assert.equal(manifest.start_url,'/'+slug+'/');assert.equal(manifest.id,'/'+slug+'/');
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});
   await page.screenshot({path:new URL(engine+'-'+slug+'.png',out).pathname});
   const beforeExit=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);
   const catalogue=collectionIds.has(slug)?page.locator('main a[href$="/library/"]'):page.locator('#catalogue-return');
   assert.equal(await catalogue.isVisible(),false,'Catalogue link stays outside reading');
   await page.locator('[data-nav="shelf"]').click();await catalogue.waitFor();
   const cataloguePath=collectionIds.has(slug)?'/library/':'/';
   assert.equal(await catalogue.getAttribute('href'),'https://newreading.app'+cataloguePath);
   // Production is same-origin. Only map the production entrance to this test server.
   await catalogue.evaluate((a,url)=>a.href=url,base+cataloguePath);
   await catalogue.click();await page.locator(cataloguePath==='/'?'.hero':'.shelf-intro').waitFor();
   await page.goBack();await catalogue.waitFor();
   const afterExit=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);
   assert.deepEqual(afterExit.notes,beforeExit.notes,'Catalogue roundtrip preserves notes');
   assert.deepEqual(afterExit.positions,beforeExit.positions,'Catalogue roundtrip preserves reading places');
   await page.goto(url+'#read/'+book+'/'+first);await ready(page,book,first);
   if(companionCollections.has(slug))companionChecks.push(await collectionCompanion(page,slug,book,first,false));

  }
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  for(const [slug]of entries){const p=await noJS.newPage();await p.goto(base+'/'+slug+'/');assert.equal(await p.locator('.loading').isVisible(),false);assert.equal(await p.locator('#offline-status').isVisible(),false);await p.locator('noscript .catalogue-return').waitFor();const explanation=await p.locator('noscript').innerText();assert.match(explanation,/JavaScript/);assert.match(explanation,/read|books|editions/i);await p.screenshot({path:new URL(engine+'-'+slug+'-no-js.png',out).pathname});await p.close()}
  await noJS.close();
  const cacheKeys=await pages[0].evaluate(()=>caches.keys());assert.equal(cacheKeys.length,entries.length);for(const [slug]of entries)assert.equal(cacheKeys.filter(k=>k.startsWith('newreading-'+slug+'-')).length,1);
  const scopes=await pages[0].evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname).sort());assert.deepEqual(scopes,entries.map(e=>'/'+e[0]+'/').sort());
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
  for(let i=0;i<entries.length;i++){
   const [slug,book,first,next]=entries[i],page=pages[i];await page.reload();await ready(page,book,first);
   await loadedCollectionFont(page,slug);
   assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-'+Date.now(),{signal:AbortSignal.timeout(5000)});return false}catch{return true}}),true);
   let state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Original '+slug+' combined-site test note.');
   if(companionCollections.has(slug))companionChecks.push(await collectionCompanion(page,slug,book,first,true));
   else{await page.goto(base+'/'+slug+'/#companion');await page.waitForFunction(()=>location.hash==='#companion'&&!document.querySelector('#reading-text'));}
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.locator('[data-nav="passages"]').click();await page.locator('[data-action="edit-note"]').first().click();
   await page.locator('#note-text').fill('Saved offline in '+slug);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.reload();await ready(page,book,next);state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Saved offline in '+slug);
  }
  assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')).length,0);
  assert.equal(requests.filter(u=>['/app.mjs','/db.mjs','/library.json','/sw.js','/cover.svg','/collection-art.svg','/table.svg','/studies.json','/study-data.json','/sources.json','/notices.json'].includes(new URL(u).pathname)).length,0);
  result.browsers.push({engine,readers:entries.length,independentCaches:entries.length,independentScopes:entries.length,independentNotes:true,catalogueRoundTrips:entries.length,exactFirstSections:true,stoppedOriginReloads:entries.length*2+companionChecks.filter(c=>c.offline).length,offlineChapterAndCompanion:true,companionChecks,offlineWritesPersist:true,manifestInstallPaths:true,externalRequests:0});delete result.inProgress;await save();console.log(engine+': '+entries.length+' readers share one origin without cache or storage collisions; stopped-origin reading and saves passed.');
 }catch(error){result.failure=error.stack;await save();throw error}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await browser?.close();}
}
result.passed=true;await save();
