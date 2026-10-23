import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_EDITIONS,publicPage,safeReferrer,eligible,fixedEvent,beforeSend,injectAnalytics,appendAnalyticsLoader,startAnalytics} from './analytics.mjs';
const site='https://newreading.app';
test('only exact approved public entrances are measured; payload URL data is removed',()=>{
  for(const path of ['/','/learn/','/library/',...PUBLIC_EDITIONS.map(id=>`/${id}/`),'/alice/play/','/odyssey/play/','/dracula/play/']){
    assert.equal(publicPage(site+path+'?private=DO_NOT_SEND#PRIVATE_BOOK').url,site+path);
  }
  for(const value of ['http://newreading.app/','https://newreading.app:444/','https://read.lookatseel.com/','https://newreading.app.evil.example/','https://name@newreading.app/','https://newreading.app/privacy/','https://newreading.app/personal/','https://newreading.app/austen/index.html','https://newreading.app/austen/play/','https://newreading.app/orwell/','https://newreading.app/library.json','https://newreading.app/%61usten/'])assert.equal(publicPage(value),null,value);
});
test('unmodifiable provider referrers must be empty, omitted same-origin, or bare external origins',()=>{
  for(const value of ['',site+'/austen/?private=secret#note','https://example.com','https://example.com/','http://example.com:8080/'])assert.equal(safeReferrer(value),true,value);
  for(const value of ['https://NEWREADING.APP/private?secret=value','https://example.com/private','https://example.com/?private=secret','https://example.com/#secret','https://name@example.com/','not a URL','data:text/plain,secret'])assert.equal(safeReferrer(value),false,value);
});
test('automation, privacy signals and offline visits cause no analytics initialization',()=>{
  const base={url:site+'/'};assert.equal(eligible(base),true);
  for(const setting of [{webdriver:true},{userAgent:'Mozilla HeadlessChrome'},{dnt:'1'},{dnt:'yes'},{gpc:true},{online:false},{referrer:'https://example.com/private'},{url:'https://preview.vercel.app/'}])assert.equal(eligible({...base,...setting}),false,JSON.stringify(setting));
});
test('beforeSend rebuilds pageview and event bodies; arbitrary fields and event types fail closed',()=>{
  const current=site+'/library/?SECRET#SECRET';
  assert.deepEqual(beforeSend({type:'pageview',url:current,payload:undefined},current),{type:'pageview',url:site+'/library/'});
  const valid={type:'event',url:current,payload:{name:'edition_preview',data:{page:'library',edition:'alice'}}};
  assert.deepEqual(beforeSend(valid,current),{...valid,url:site+'/library/'});
  for(const event of [{...valid,__cdp:{SECRET:1}},{...valid,type:'identify'},{...valid,url:site+'/unknown/'},{...valid,payload:{...valid.payload,SECRET:'value'}},{...valid,payload:{name:'private-text',data:{page:'library'}}},{...valid,payload:{name:'edition_preview',data:{page:'library',edition:'private-book'}}},{...valid,payload:{name:'edition_preview',data:{page:'library',edition:'alice',search:'SECRET'}}},{type:'pageview',url:current,payload:{SECRET:'value'}}])assert.equal(beforeSend(event,current),false);
});
test('event enums preserve distinctions between attempts, displayed text, and successful operations',()=>{
  assert.ok(fixedEvent('prompt_copy',{page:'home',outcome:'copied'},publicPage(site+'/')));
  assert.ok(fixedEvent('prompt_copy',{page:'guide',outcome:'fallback'},publicPage(site+'/learn/')));
  assert.equal(fixedEvent('prompt_copy',{page:'home',outcome:'clicked'},publicPage(site+'/')),null);
  assert.equal(fixedEvent('game_start',{page:'game',edition:'alice'},publicPage(site+'/alice/play/')),null);
  assert.equal(fixedEvent('reading_visible_30s',{page:'reader',edition:'alice'},publicPage(site+'/austen/')),null);
  assert.equal(fixedEvent('companion_open',{page:'reader',edition:'austen'},publicPage(site+'/austen/')),null);
});
test('build configuration is inert and cannot embed arbitrary book metadata',()=>{
  const html='<html><head><script type="module" src="/app.mjs"></script></head><body></body></html>';
  const output=injectAnalytics(html,{edition:'alice',publicBooks:['alice-rackham-28885']});
  assert.ok(output.includes('src="/app.mjs"'));
  assert.ok(output.includes('<meta name="newreading-analytics" data-newreading-analytics data-public-books="alice-rackham-28885">'));
  assert.equal(output.includes('src="/analytics.mjs"'),false,'Optional metadata cannot create a load-blocking request');
  assert.throws(()=>injectAnalytics(output));assert.throws(()=>injectAnalytics(html,{edition:'private-book'}));assert.throws(()=>injectAnalytics(html,{edition:'alice',publicBooks:['<script>SECRET']}));
});
test('mounted loader preserves essential source and rejects duplicate adapters',()=>{
  const source='export const essential = true;\n',output=appendAnalyticsLoader(source);
  assert.ok(output.startsWith(source));assert.match(output.slice(source.length),/void import\('\/analytics\.mjs'\)\.catch\(\(\)=>\{\}\);/);
  for(const invalid of [null,'','  ',output,"import('/analytics.mjs');"])assert.throws(()=>appendAnalyticsLoader(invalid));
});
test('optional import is scheduled after the load event completes; essential code runs immediately',()=>{
  for(const readyState of ['loading','complete']){
    const tasks=[];let onLoad;
    const win={setTimeout:(callback,delay)=>{assert.equal(delay,0);tasks.push(callback);},addEventListener:(event,callback,options)=>{assert.equal(event,'load');assert.deepEqual(options,{once:true});onLoad=callback;}};
    new Function('window','document',appendAnalyticsLoader('window.essentialRan=true;'))(win,{readyState});
    assert.equal(win.essentialRan,true);
    if(readyState==='loading'){assert.equal(tasks.length,0);assert.equal(typeof onLoad,'function');onLoad();}
    assert.equal(tasks.length,1,'Import is queued in a later task, never inside the load handler');
  }
});

test('dwell requires current canonical admission, observes revocation and never reads book content',()=>{
  const win=new EventTarget(),doc=new EventTarget(),events=[],timers=new Map();let now=0,next=0,verified=false,notify;
  const text={getAttribute:name=>({'data-book':'austen-pride-1894','data-section':'chapter-1'}[name]),querySelector:()=>({}),getBoundingClientRect:()=>({width:500,top:0,bottom:800})};
  Object.defineProperty(text,'textContent',{get(){throw Error('Analytics must not inspect text');}});
  Object.assign(doc,{visibilityState:'visible',referrer:'',body:{},createElement:()=>({dataset:{}}),head:{appendChild(script){doc.provider=script;}},querySelector(selector){
    if(selector==='meta[data-newreading-analytics]')return {getAttribute:()=> 'austen-pride-1894'};
    if(selector.startsWith('#reading-text'))return selector.includes('[data-public-edition="verified"]')&&!verified?null:text;
    return null;
  }});
  Object.assign(win,{navigator:{onLine:true},location:{href:site+'/austen/',hash:'#read/austen-pride-1894/chapter-1'},localStorage:{getItem:()=>null},performance:{now:()=>now},innerHeight:900,setTimeout(callback,delay){const id=++next;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),MutationObserver:class {constructor(callback){notify=callback;}observe(_target,options){assert.ok(options.attributeFilter.includes('data-public-edition'));}disconnect(){}}});
  const controller=startAnalytics(win,doc);win.vai=true;win.va=(name,payload)=>events.push({name,payload});doc.provider.onload();
  const advance=ms=>{now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}};
  advance(31000);assert.equal(events.some(e=>e.name==='event'),false,'Public ID alone is insufficient');
  verified=true;notify();advance(10000);verified=false;notify();advance(40000);assert.equal(events.some(e=>e.name==='event'),false,'Revocation stops counting');
  verified=true;notify();advance(20000);assert.equal(events.filter(e=>e.name==='event').length,1,'Only verified intervals accumulate');
  assert.deepEqual(events.find(e=>e.name==='event').payload,{name:'reading_visible_30s',data:{page:'reader',edition:'austen'}});controller.stop();
});
