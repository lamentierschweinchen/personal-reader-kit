import {anchorStatus} from './core.mjs';
import {passageShareData} from './share.mjs';

const SHORTER='Choose a shorter passage for a legible card. Nothing has been shortened.';
const RESTORE='Restore this passage’s exact edition before making a card with attribution.';
const WIDTH=1080,MAX_HEIGHT=1920,PADDING=92;
let previewNumber=0;

// This is an explicit source-only projection, not a serialization of a note.
export function passageCardData(passage,book) {
  if(book?.profile==='kingdom-for-a-stage/drama@1')throw new Error('This edition requires its full source notice. Use Share passage or Copy passage to keep the notice with the words.');
  let status,shared;
  try {status=anchorStatus(passage,book);shared=passageShareData(passage,book);}catch {throw new Error(RESTORE);}
  if(!status.valid)throw new Error(RESTORE);
  const attribution=shared.text.slice(passage.quote.length+4).split('\n');
  const blocks=status.section.blocks,first=passage.segments[0],last=passage.segments.at(-1);
  const from=blocks.findIndex(b=>b.id===first.blockId),to=blocks.findIndex(b=>b.id===last.blockId),marks=[],fixedRanges=[];
  let offset=0;
  for(let i=from;i<=to;i++) {
    const block=blocks[i],start=i===from?first.start:0,end=i===to?last.end:block.text.length;
    if(block.layout==='fixed'&&block.kind!=='verse')throw new Error('This passage has a fixed layout that cannot be preserved on this card. Share it as text instead.');
    if(block.lines) {
      let lineStart=0;
      for(const [index,text] of block.text.split('\n').entries()) {
        const line=block.lines[index],lineEnd=lineStart+text.length;
        if(lineEnd>start&&lineStart<end&&(!line||line.indent!==0||line.scale!==1))throw new Error('This passage has a shaped layout that cannot be preserved on this card. Share it as text instead.');
        lineStart=lineEnd+1;
      }
    }
    if(block.kind==='verse'||block.layout==='fixed'||block.lines)fixedRanges.push({start:offset,end:offset+end-start});
    if(block.display?.underline&&end>start)marks.push({kind:'underline',start:offset,end:offset+end-start});
    for(const mark of block.marks||[]) {
      const a=Math.max(start,mark.start),b=Math.min(end,mark.end);
      if(b>a) {
        if(!['em','strong','sup','sub','smallcaps','smallcap','small','page','spaced'].includes(mark.kind))throw new Error('This passage uses source formatting that cannot be preserved on a card. Share it as text instead.');
        marks.push({kind:mark.kind,start:offset+a-start,end:offset+b-start});
      }
    }
    offset+=end-start+(i<to?(block.after||'').length:0);
  }
  return {title:shared.title,quote:passage.quote,attribution,marks,fixedRanges};
}

function styleAt(marks,start,end,size) {
  const active=marks.filter(m=>m.start<=start&&m.end>=end),page=active.some(m=>m.kind==='page'),sup=page||active.some(m=>m.kind==='sup'),sub=active.some(m=>m.kind==='sub');
  return {size:page?size*.65:(sup||sub)?size*.72:active.some(m=>m.kind==='small')?size*.83:size,italic:active.some(m=>m.kind==='em'),bold:active.some(m=>m.kind==='strong'),smallcaps:active.some(m=>['smallcaps','smallcap'].includes(m.kind)),underline:active.some(m=>m.kind==='underline'),pad:active.some(m=>m.kind==='spaced'&&m.start===start)?size*.25:0,dy:sup?-size*.3:sub?size*.18:0};
}

function measuredRuns(text,start,end,marks,size,measure) {
  const boundaries=[...new Set([start,end,...marks.flatMap(m=>[m.start,m.end]).filter(n=>n>start&&n<end)])].sort((a,b)=>a-b),runs=[];
  let x=0;
  for(let i=0;i<boundaries.length-1;i++) {
    const a=boundaries[i],b=boundaries[i+1],style=styleAt(marks,a,b,size);x+=style.pad;
    for(const part of text.slice(a,b).split(/(\t)/)) {
      if(!part)continue;
      const tab=measure('        ',style),width=part==='\t'?tab-(x%tab):measure(part,style);
      if(!Number.isFinite(width)||width<0)throw new Error('The card’s type could not be measured. Please try again.');
      runs.push({text:part,x,width,...style});x+=width;
    }
  }
  return {runs,width:x};
}

// Soft wrapping adds no characters. Hard breaks, whitespace and tabs retain
// their exact source positions; tabs use eight-space stops in the drawing.
function wrap(text,marks,size,width,measure,fixedRanges=[]) {
  const parts=text.split(/(\r\n|\r|\n|\u2028|\u2029)/),lines=[];
  let offset=0;
  for(let i=0;i<parts.length;i+=2) {
    const hard=parts[i],newline=parts[i+1]||'',tokens=hard.match(/\s+|\S+/gu)||[];
    if(fixedRanges.some(range=>range.start<offset+hard.length&&range.end>offset)) {
      const result=measuredRuns(text,offset,offset+hard.length,marks,size,measure);
      if(result.width>width+.01)throw new Error(SHORTER);
      lines.push({text:hard,break:newline,...result});offset+=hard.length+newline.length;continue;
    }
    let start=offset,end=offset;
    for(const token of tokens) {
      const next=end+token.length,candidate=measuredRuns(text,start,next,marks,size,measure);
      if(candidate.width>width+.01&&end>start) {
        const result=measuredRuns(text,start,end,marks,size,measure);
        lines.push({text:text.slice(start,end),break:'',...result});start=end;
      }
      if(measuredRuns(text,start,next,marks,size,measure).width>width+.01)throw new Error(SHORTER);
      end=next;
    }
    lines.push({text:text.slice(start,end),break:newline,...measuredRuns(text,start,end,marks,size,measure)});
    offset+=hard.length+newline.length;
  }
  return lines;
}

// measure(text, {size, italic, bold}) returns a width in pixels. A pure layout
// plan makes bounds and source conservation independently testable.
export function layoutPassageCard(data,measure) {
  if(typeof data?.quote!=='string'||!data.quote.trim()||data.quote.length>1200)throw new Error(SHORTER);
  if(!Array.isArray(data.attribution)||!data.attribution.length||data.attribution.some(s=>typeof s!=='string'))throw new Error('Source attribution is required for a card.');
  if(data.attribution.join('\n').length>2400)throw new Error('The full source attribution does not fit this card. Share the passage as text instead.');
  const width=WIDTH-PADDING*2,attribution=[];
  let attributionHeight=0;
  try {
    for(const [index,text] of data.attribution.entries()) {
      const size=index===0?34:30,lines=wrap(text,[],size,width,measure),lineHeight=size*1.4;
      for(const line of lines){attribution.push({...line,y:attributionHeight+size*.86});attributionHeight+=lineHeight;}
      if(index<data.attribution.length-1)attributionHeight+=8;
    }
  }catch {throw new Error('The full source attribution does not fit this card. Share the passage as text instead.');}
  if(attributionHeight>550)throw new Error('The full source attribution does not fit this card. Share the passage as text instead.');
  for(const fontSize of [100,88,78,68,58]) {
    let lines;try {lines=wrap(data.quote,data.marks||[],fontSize,width,measure,data.fixedRanges||[]);}catch {continue;}
    const lineHeight=fontSize*1.32,quoteHeight=lines.length*lineHeight;
    const height=Math.ceil(Math.max(1080,180+quoteHeight+100+attributionHeight+PADDING));
    if(height>MAX_HEIGHT)continue;
    const attributionTop=height-PADDING-attributionHeight;
    return {width:WIDTH,height,padding:PADDING,fontSize,lineHeight,
      quote:lines.map((line,index)=>({...line,y:180+fontSize*.86+index*lineHeight})),
      attribution:attribution.map(line=>({...line,y:attributionTop+line.y})),ruleY:attributionTop-38};
  }
  throw new Error(SHORTER);
}

const canvasFont=(style,font)=>`${style.italic?'italic ':''}${style.smallcaps?'small-caps ':''}${style.bold?'600':'400'} ${style.size}px ${font}`;

export async function renderPassageCard(data,options={}) {
  const doc=options.document||globalThis.document;
  if(!doc?.createElement)throw new Error('This browser cannot make an image. You can still share the passage as text.');
  const canvas=doc.createElement('canvas'),context=canvas.getContext('2d');
  if(!context)throw new Error('This browser cannot make an image. You can still share the passage as text.');
  const font=options.font||'Georgia, serif';
  if(data.marks?.some(mark=>['smallcaps','smallcap'].includes(mark.kind))) {
    context.font=`small-caps 58px ${font}`;
    if(!context.font.includes('small-caps'))throw new Error('This browser cannot preserve the passage’s small capitals in an image. Share it as text instead.');
  }
  if(doc.fonts?.load) {
    let timer;
    try {
      await Promise.race([Promise.all(['400','600','italic 400','italic 600'].map(weight=>doc.fonts.load(`${weight} 58px ${font}`,data.quote+data.attribution.join(' ')))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The card’s type is not ready. Please try again.')),4000);})]);
    }finally {clearTimeout(timer);}
  }
  const plan=layoutPassageCard(data,(text,style)=>{context.font=canvasFont(style,font);return context.measureText(text).width;});
  canvas.width=plan.width;canvas.height=plan.height;
  context.fillStyle=options.paper||'#f6f2e9';context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle=options.accent||options.ink||'#282b29';context.fillRect(PADDING,96,72,5);
  context.fillStyle=options.ink||'#282b29';context.textBaseline='alphabetic';
  for(const line of [...plan.quote,...plan.attribution])for(const run of line.runs) {
    context.font=canvasFont(run,font);
    if(run.text!=='\t')context.fillText(run.text,PADDING+run.x,line.y+run.dy);
    if(run.underline)context.fillRect(PADDING+run.x,line.y+run.dy+run.size*.1,run.width,Math.max(1,run.size*.018));
  }
  context.fillStyle=options.accent||options.ink||'#282b29';context.fillRect(PADDING,plan.ruleY,72,2);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('The image could not be made. Please try again.')),'image/png'));
  return {blob,width:plan.width,height:plan.height};
}

function palette(root,options) {
  const styles=root.ownerDocument.defaultView.getComputedStyle(root),get=(name,fallback)=>options[name]||styles.getPropertyValue(`--share-card-${name}`).trim()||styles.getPropertyValue(fallback).trim();
  return {paper:get('paper','--paper')||'#f6f2e9',ink:get('ink','--ink')||'#282b29',accent:get('accent','--accent')||'#9e3927',font:get('font','--serif')||styles.fontFamily||'Georgia, serif',document:root.ownerDocument};
}

function pngPreviewURL(blob,view) {
  return new Promise((resolve,reject)=>{
    const reader=new view.FileReader(),fail=()=>reject(new Error('The image preview could not be made. Please try again.'));
    reader.onload=()=>typeof reader.result==='string'&&reader.result.startsWith('data:image/png;base64,')?resolve(reader.result):fail();
    reader.onerror=fail;reader.onabort=fail;
    reader.readAsDataURL(blob);
  });
}

export function mountPassageCard(root,passage,book,options={}) {
  if(!root?.ownerDocument||book?.profile==='kingdom-for-a-stage/drama@1')return ()=>{};
  const doc=root.ownerDocument,view=doc.defaultView,device=view.navigator,id=`passage-card-preview-${++previewNumber}`;
  const button=(label,action)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.dataset.cardAction=action;return b;};
  const make=button('Make card','make');make.className='text passage-card-make';make.setAttribute('aria-expanded','false');make.setAttribute('aria-controls',id);
  const ownActions=!root.querySelector('.dialog-actions'),actions=root.querySelector('.dialog-actions')||doc.createElement('div');
  if(ownActions){actions.className='dialog-actions';root.append(actions);}actions.append(make);
  const panel=doc.createElement('section');panel.id=id;panel.className='passage-card-preview';panel.hidden=true;panel.dataset.cardState='idle';panel.setAttribute('aria-label','Quotation card preview');
  const header=doc.createElement('div');header.className='passage-card-heading';
  const heading=doc.createElement('h3');heading.textContent='Quotation card';heading.tabIndex=-1;
  const close=button('Close preview','close');close.className='text';header.append(heading,close);
  const status=doc.createElement('p');status.className='passage-card-status small';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const image=doc.createElement('img');image.className='passage-card-image';image.hidden=true;
  const cardActions=doc.createElement('div');cardActions.className='passage-card-actions';cardActions.hidden=true;
  const share=button('Share image','share');share.className='secondary';
  const save=doc.createElement('a');save.textContent='Save image';save.dataset.cardAction='save';save.download='passage-card.png';save.target='_blank';save.rel='noopener';save.className='secondary';
  cardActions.append(share,save);panel.append(header,status,image,cardActions);root.append(panel);
  let alive=true,generation=0,url=null,file=null,title='',sharing=false;
  const discard=()=>{if(url)view.URL.revokeObjectURL(url);url=null;file=null;image.removeAttribute('src');image.hidden=true;save.removeAttribute('href');cardActions.hidden=true;};
  const current=token=>alive&&token===generation;
  const canShare=()=>{try{return typeof device.share==='function'&&typeof device.canShare==='function'&&device.canShare({files:[file]});}catch{return false;}};
  const onMake=async()=>{
    const token=++generation;discard();sharing=false;panel.hidden=false;panel.dataset.cardState='generating';panel.setAttribute('aria-busy','true');make.disabled=true;make.setAttribute('aria-expanded','true');status.textContent='Making your image…';heading.focus({preventScroll:true});
    try {
      const data=passageCardData(passage,book);
      if(data.quote.length>1200)throw new Error(SHORTER);
      const result=await renderPassageCard(data,palette(root,options));
      if(!current(token))return;
      // The preview encodes the same PNG bytes; data images satisfy the reader's CSP.
      const preview=await pngPreviewURL(result.blob,view);
      if(!current(token))return;
      if(JSON.stringify(passageCardData(passage,book))!==JSON.stringify(data))throw new Error(RESTORE);
      file=new view.File([result.blob],'passage-card.png',{type:'image/png'});title=data.title;url=view.URL.createObjectURL(result.blob);
      image.alt=data.quote+'\n\n'+data.attribution.join('\n');image.width=result.width;image.height=result.height;image.src=preview;image.hidden=false;save.href=url;cardActions.hidden=false;
      share.disabled=!canShare();status.textContent=share.disabled?'Image sharing is not available here. Save the image instead.':'Your image is ready.';panel.dataset.cardState='ready';
    }catch(error) {if(current(token)){discard();panel.dataset.cardState='error';status.textContent=error.message||'The image could not be made. Please try again.';}}
    finally {if(current(token)){make.disabled=false;panel.removeAttribute('aria-busy');}}
  };
  const onClose=()=>{generation++;discard();sharing=false;panel.hidden=true;panel.removeAttribute('aria-busy');make.disabled=false;make.setAttribute('aria-expanded','false');make.focus({preventScroll:true});};
  const onShare=()=>{
    if(!file||sharing)return;
    if(!canShare()){share.disabled=true;status.textContent='Image sharing is not available here. Save the image instead.';return;}
    const token=generation;let pending;sharing=true;share.disabled=true;
    try {
      // The PNG and File already exist. Do not await anything before this call.
      pending=device.share({files:[file],title});
    }catch {sharing=false;share.disabled=false;status.textContent='Image sharing did not open. You can still save the image.';return;}
    Promise.resolve(pending).then(()=>{if(current(token))status.textContent='Share menu opened. Delivery depends on the app you choose.';},error=>{if(current(token))status.textContent=error?.name==='AbortError'?'Share dismissed. Your image and note are unchanged.':'Image sharing did not open. You can still save the image.';}).finally(()=>{if(current(token)){sharing=false;share.disabled=!canShare();}});
  };
  // Close returns focus to Make. A key still held on Close must not reopen it.
  const ownedButtons=new Set([make,close,share]);let activation=null;
  const onKeyDown=event=>{
    if(!['Enter',' '].includes(event.key))return;
    const target=event.target.closest('button');
    if(!event.repeat)activation=ownedButtons.has(target)?{target,key:event.key}:null;
    else if(activation?.key===event.key&&activation.target!==target)event.preventDefault();
  };
  const onKeyUp=event=>{if(activation?.key!==event.key)return;if(activation.target!==event.target.closest('button'))event.preventDefault();activation=null;};
  root.addEventListener('keydown',onKeyDown,true);root.addEventListener('keyup',onKeyUp,true);
  make.addEventListener('click',onMake);close.addEventListener('click',onClose);share.addEventListener('click',onShare);
  return ()=>{if(!alive)return;alive=false;generation++;discard();root.removeEventListener('keydown',onKeyDown,true);root.removeEventListener('keyup',onKeyUp,true);make.removeEventListener('click',onMake);close.removeEventListener('click',onClose);share.removeEventListener('click',onShare);make.remove();panel.remove();if(ownActions)actions.remove();};
}
