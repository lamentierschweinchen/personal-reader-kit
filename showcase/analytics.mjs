// Optional measurement for the owner-approved public catalogue only.
// This module never reads reader storage, quotations, form values or clipboard data.
// The provider-reserved attribution key is checked for presence only; it is never parsed.
export const PUBLIC_EDITIONS=Object.freeze(['austen','alice','walden','two-halls','odyssey','dracula','at-table','inward-life','music-and-feeling','learning-to-see','beside-the-bed','nietzsche','mountains','war-and-peace','douglass','poe','ballads','shakespeare','pictures-after-dark','rome']);
// Fail closed if the provider changes before its client receives another privacy review.
export const PROVIDER_INTEGRITY='sha256-BQ41v35ullkPKp3hFMFP95KAbtKEV7Mkh2KUQ1DAukw=';
const games=new Set(['alice','odyssey','dracula']);
const origin='https://newreading.app';
const cataloguePages=new Set(['home','guide','library']);
const own=(object,keys)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).every(key=>keys.includes(key));
export function publicPage(value){
  try{
    const url=new URL(value);
    if(url.origin!==origin||url.username||url.password)return null;
    const fixed={'/':'home','/learn/':'guide','/library/':'library'};
    if(fixed[url.pathname])return {url:origin+url.pathname,page:fixed[url.pathname]};
    for(const edition of PUBLIC_EDITIONS){
      if(url.pathname===`/${edition}/`)return {url:origin+url.pathname,page:'reader',edition};
      if(games.has(edition)&&url.pathname===`/${edition}/play/`)return {url:origin+url.pathname,page:'game',edition};
    }
  }catch{/* Unknown addresses never enter measurement. */}
  return null;
}
export function safeReferrer(value){
  if(value==='')return true;
  try{
    const url=new URL(value);
    if(url.username||url.password||!['https:','http:'].includes(url.protocol))return false;
    // The provider omits same-origin referrers. Other referrers must be bare origins.
    if(url.origin===origin)return value.includes('newreading.app');
    return (value===url.origin||value===url.origin+'/')&&!url.search&&!url.hash;
  }catch{return false;}
}
export function eligible({url,referrer='',webdriver=false,dnt=null,gpc=false,online=true,userAgent=''}={}){
  return !!publicPage(url)&&safeReferrer(referrer)&&!webdriver&&!userAgent.includes('Headless')&&!['1','yes'].includes(String(dnt).toLowerCase())&&!gpc&&online!==false;
}
export function fixedEvent(name,data,current){
  if(!current||!own(data,['page','edition','outcome'])||data.page!==current.page||Object.keys(data).length>2)return null;
  const keys=Object.keys(data).sort().join(',');
  if(name==='prompt_copy'&&['home','guide'].includes(current.page)&&keys==='outcome,page'&&['copied','fallback'].includes(data.outcome))return {name,data:{page:current.page,outcome:data.outcome}};
  if(name==='kit_link'&&cataloguePages.has(current.page)&&keys==='page')return {name,data:{page:current.page}};
  if(name==='edition_preview'&&current.page==='library'&&keys==='edition,page'&&PUBLIC_EDITIONS.includes(data.edition))return {name,data:{page:'library',edition:data.edition}};
  if(['reader_link','game_link'].includes(name)&&cataloguePages.has(current.page)&&keys==='edition,page'&&PUBLIC_EDITIONS.includes(data.edition)&&(name!=='game_link'||games.has(data.edition)))return {name,data:{page:current.page,edition:data.edition}};
  if(name==='reading_visible_30s'&&current.page==='reader'&&keys==='edition,page'&&data.edition===current.edition)return {name,data:{page:'reader',edition:current.edition}};
  return null;
}
export function beforeSend(event,currentUrl){
  const current=publicPage(currentUrl),incoming=publicPage(event?.url);
  if(!current||!incoming||current.url!==incoming.url||!own(event,['type','url','payload']))return false;
  if(event.type==='pageview'&&event.payload===undefined)return {type:'pageview',url:current.url};
  if(event.type!=='event'||!own(event.payload,['name','data'])||Object.keys(event.payload).length!==2)return false;
  const payload=fixedEvent(event.payload.name,event.payload.data,current);
  return payload?{type:'event',url:current.url,payload}:false;
}
// Build-time injection affects mounted public HTML only; standalone examples stay exact.
export function injectAnalytics(html,{edition,publicBooks=[]}={}){
  if(edition&&!PUBLIC_EDITIONS.includes(edition))throw Error('Unknown public analytics edition');
  if(!Array.isArray(publicBooks)||publicBooks.some(id=>typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(id)))throw Error('Invalid public analytics book inventory');
  if(html.split('</head>').length!==2||html.includes('data-newreading-analytics'))throw Error('Analytics HTML insertion assumption changed');
  const books=edition?` data-public-books="${publicBooks.join(',')}"`:'';
  return html.replace('</head>',`<meta name="newreading-analytics" data-newreading-analytics${books}></head>`);
}
// Append only to existing essential modules in the mounted public build.
// WebKit font readiness can wait for even an unawaited import begun before load.
export function appendAnalyticsLoader(source){
  if(typeof source!=='string'||!source.trim()||source.includes('/analytics.mjs')||source.includes('newreading-analytics-loader'))throw Error('Invalid or duplicate analytics loader');
  return source+"\n/* newreading-analytics-loader */\n{\n  const queueAnalytics=()=>window.setTimeout(()=>{void import('/analytics.mjs').catch(()=>{});},0);\n  if(document.readyState==='complete')queueAnalytics();\n  else window.addEventListener('load',queueAnalytics,{once:true});\n}\n";
}

export function startAnalytics(win=window,doc=document){
  const nav=win.navigator;
  const reservedData=()=>{
    // The provider appends attribution and flags outside beforeSend. Opt out entirely.
    try{return win.localStorage.getItem('__va_attribution')!==null||!!doc.querySelector('[data-flag-values]');}
    catch{return true;}
  };
  const permitted=()=>eligible({url:win.location.href,referrer:doc.referrer,webdriver:nav.webdriver,dnt:[nav.doNotTrack,win.doNotTrack,nav.msDoNotTrack].some(value=>['1','yes'].includes(String(value).toLowerCase()))?'1':null,gpc:nav.globalPrivacyControl,online:nav.onLine,userAgent:nav.userAgent})&&!reservedData();
  if(!permitted()||win.va||win.vaq||win.vai)return;
  const initial=publicPage(win.location.href),configuration=doc.querySelector('meta[data-newreading-analytics]');
  if(!configuration)return;
  // Only the generated public-ID inventory is inspected, never library/record storage.
  const publicBooks=new Set((configuration.getAttribute('data-public-books')||'').split(',').filter(id=>/^[-a-zA-Z0-9_]{1,100}$/.test(id)));
  let phase='loading',pending=[],loadTimer,visibleTimer,visibleSince=null,visibleMs=0,observer;
  const seen=new Set(),listeners=[];
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
  const stub=(...args)=>{if(win.vaq.length<2)win.vaq.push(args);};
  win.vaq=[];win.va=stub;
  win.va('beforeSend',event=>permitted()?beforeSend(event,win.location.href):false);
  function stop(){
    if(phase==='stopped')return;
    phase='stopped';pending=[];win.clearTimeout(loadTimer);win.clearTimeout(visibleTimer);observer?.disconnect();
    for(const remove of listeners)remove();
    // Do not retain attempted events or retry after a failed/offline visit.
    win.vaq=[['beforeSend',()=>false]];
    if(win.va!==stub)win.va('beforeSend',()=>false);
  }
  function send(name,data){
    if(phase==='stopped')return;
    if(!permitted()){stop();return;}
    const payload=fixedEvent(name,data,publicPage(win.location.href));
    if(!payload)return;
    const key=JSON.stringify(payload);if(seen.has(key))return;
    seen.add(key);
    if(phase==='ready')win.va('event',payload);
    else if(pending.length<16)pending.push(payload);
  }
  const script=doc.createElement('script');
  script.integrity=PROVIDER_INTEGRITY;script.crossOrigin='anonymous';
  script.src='/_vercel/insights/script.js';script.async=true;script.dataset.disableAutoTrack='true';
  script.onload=()=>{
    if(phase!=='loading')return;
    win.clearTimeout(loadTimer);
    if(!permitted()||!win.vai||win.va===stub){stop();return;}
    phase='ready';win.va('pageview',{});
    const queued=pending;pending=[];for(const payload of queued)win.va('event',payload);
  };
  script.onerror=stop;
  loadTimer=win.setTimeout(stop,6000);
  doc.head.appendChild(script);
  listen(win,'offline',stop,{once:true});
  listen(win,'pagehide',stop,{once:true});
  listen(doc,'newreading:analytics',event=>{
    const detail=event.detail;if(!own(detail,['name','outcome','edition']))return;
    if(detail.name==='prompt_copy'&&Object.keys(detail).sort().join(',')==='name,outcome')send(detail.name,{page:initial.page,outcome:detail.outcome});
    if(detail.name==='edition_preview'&&Object.keys(detail).sort().join(',')==='edition,name')send(detail.name,{page:initial.page,edition:detail.edition});
  });
  if(cataloguePages.has(initial.page))listen(doc,'click',event=>{
    const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0)return;
    // Never inspect link text, nearby content, form values, or arbitrary target URLs.
    const href=link.getAttribute('href');
    if(href==='https://github.com/lamentierschweinchen/personal-reader-kit')send('kit_link',{page:initial.page});
    const target=href?.startsWith('/')&&!href.startsWith('//')?publicPage(origin+href):null;
    if(!target||href!==new URL(target.url).pathname||!target.edition)return;
    if(target.page==='reader')send('reader_link',{page:initial.page,edition:target.edition});
    if(target.page==='game')send('game_link',{page:initial.page,edition:target.edition});
  });
  if(initial.page==='reader'&&publicBooks.size){
    function publicReadingVisible(){
      if(doc.visibilityState!=='visible'||doc.querySelector('dialog[open]'))return false;
      let parts;try{parts=win.location.hash.slice(1).split('/').map(decodeURIComponent);}catch{return false;}
      if(parts.length!==3||parts[0]!=='read'||!publicBooks.has(parts[1]))return false;
      // The mounted reader proves its immutable edition; analytics reads only this boolean.
      const text=doc.querySelector('#reading-text[data-position-ready="true"][data-public-edition="verified"]');
      if(!text||text.getAttribute('data-book')!==parts[1]||text.getAttribute('data-section')!==parts[2]||!text.querySelector('[data-block]'))return false;
      const rect=text.getBoundingClientRect();return rect.width>0&&rect.bottom>0&&rect.top<win.innerHeight;
    }
    function reading(){
      if(phase==='stopped')return;
      if(!permitted()){stop();return;}
      const now=win.performance.now();
      if(visibleSince!==null){visibleMs+=Math.max(0,now-visibleSince);visibleSince=null;}
      win.clearTimeout(visibleTimer);
      if(!publicReadingVisible())return;
      if(visibleMs>=30000){send('reading_visible_30s',{page:'reader',edition:initial.edition});return;}
      visibleSince=now;visibleTimer=win.setTimeout(reading,30000-visibleMs);
    }
    observer=new win.MutationObserver(reading);
    observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-position-ready','data-public-edition','data-book','data-section','open']});
    listen(win,'hashchange',reading);listen(win,'scroll',reading,{passive:true});listen(doc,'visibilitychange',reading);
    reading();
  }
  return {stop};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  // Even a dynamically inserted provider script can postpone window load if
  // inserted earlier. Reading and font readiness must finish independently.
  const queueAnalytics=()=>window.setTimeout(()=>startAnalytics(),0);
  if(document.readyState==='complete')queueAnalytics();
  else window.addEventListener('load',queueAnalytics,{once:true});
}
