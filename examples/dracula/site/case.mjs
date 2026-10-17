// Authored case framing. Original excerpts are resolved from the pinned local edition.
import {passageAt,selectionQuote} from './core.mjs';
export const CASE_KEY='whitby-case-v1';
export const dossier=[
 {id:'cargo',number:'01',title:'The cargo at Varna',type:'Captain’s log',date:'Event: 6 July · written: 18 July',blocks:[20,21,22]},
 {id:'olgaren',number:'02',title:'A man not of the crew',type:'Reported testimony',date:'Report: 17 July · written: 18 July',blocks:[34]},
 {id:'search',number:'03',title:'The search below decks',type:'Captain’s log',date:'Undated continuation of the 18 July record',blocks:[36]},
 {id:'sails',number:'04',title:'Why leave the sails set?',type:'Captain’s log',date:'Entry: 1 August',blocks:[48]},
 {id:'mate',number:'05',title:'A leap, then an explanation',type:'Captain’s log',date:'Continuation of the 3 August entry',blocks:[54],start:672},
 {id:'vow',number:'06',title:'The captain’s last intention',type:'Captain’s log',date:'Entry: 4 August',blocks:[56],start:391},
 {id:'arrival',number:'07',title:'The searchlight finds a ship',type:'Newspaper report',date:'Cutting headed 8 August · arrival night',blocks:[9],start:1350},
 {id:'dog',number:'08',title:'Something leaves the ship',type:'Newspaper report',date:'Arrival night · after the ship touches shore',blocks:[10],start:177},
 {id:'wheel',number:'09',title:'What the boarding party found',type:'Newspaper report',date:'After landfall · inspection and estimates',blocks:[12],start:113,end:1064},
 {id:'consignee',number:'10',title:'The cargo changes hands',type:'Newspaper dispatch',date:'Dispatch: 9 August · this morning',blocks:[15],end:527},
 {id:'translation',number:'11',title:'How the log reaches us',type:'Correspondent’s explanation',date:'“Later” in the 9 August dispatch',blocks:[17]},
 {id:'mina',number:'12',title:'Mina’s night of the storm',type:'Mina Murray’s journal',date:'Entry: 8 August',blocks:[61],end:222}
];
export function evidence(book,doc){
 const section=book.sections.find(s=>s.id==='chap07');
 const segments=doc.blocks.map((n,i)=>{const b=section.blocks[n-1];return passageAt(book,section,b,i===0?(doc.start||0):0,i===doc.blocks.length-1?(doc.end??b.text.length):b.text.length).segments[0];});
 return {bookId:book.id,sectionId:section.id,revision:book.source.sha256,segments,quote:selectionQuote(section,segments)};
}
export const events={landfall:'The ship reaches Tate Hill Pier',loaded:'The boxes are loaded at Varna',claimed:'Billington takes possession of the cargo',vow:'The captain plans to bind his hands'};
export const INITIAL_ORDER=['landfall','loaded','claimed','vow'];
export const ORDER=['loaded','vow','landfall','claimed'];
export function freshCase(){return {version:1,stage:0,order:[...INITIAL_ORDER],dating:'',arrivalDate:'',dateEvidence:[],claim:'',support:[],lead:'',trail:[],limit:'',seen:[],selected:'cargo',hints:[0,0,0],solved:[false,false,false]};}
export function getCase(state){
 const raw=state.reflections[CASE_KEY];if(!raw)return freshCase();
 const g=JSON.parse(raw),ids=dossier.map(d=>d.id),keys=Object.keys(freshCase());
 if(!g||g.version!==1||Object.keys(g).some(k=>!keys.includes(k))||!Number.isInteger(g.stage)||g.stage<0||g.stage>3||!Array.isArray(g.order)||g.order.length!==4||new Set(g.order).size!==4||g.order.some(x=>!ORDER.includes(x))||!ids.includes(g.selected))throw Error('The saved case cannot be read. Your reading records are intact. Export recovery data in Settings before resetting only this case.');
 for(const k of ['seen','dateEvidence','support','trail'])if(!Array.isArray(g[k])||g[k].length>12||g[k].some(x=>!ids.includes(x))||new Set(g[k]).size!==g[k].length)throw Error('Saved case evidence needs recovery. Export recovery data before resetting the case.');
 for(const k of ['dating','arrivalDate','claim','lead','limit'])if(typeof g[k]!=='string'||g[k].length>100)throw Error('Invalid case answer. Export recovery data before resetting.');
 if(!Array.isArray(g.hints)||g.hints.length!==3||g.hints.some(h=>!Number.isInteger(h)||h<0||h>3)||!Array.isArray(g.solved)||g.solved.length!==3||g.solved.some(x=>typeof x!=='boolean')||g.solved.some((x,i)=>x&&g.solved.slice(0,i).some(y=>!y))||g.stage>g.solved.filter(Boolean).length)throw Error('Saved case sequence needs recovery. Export recovery data before resetting.');
 return g;
}
const pair=(got,want)=>got.length===want.length&&want.every(x=>got.includes(x));
export function judge(g,stage=g.stage){
 if(stage===0){
  if(g.order.join()!==ORDER.join())return {ok:false,message:'Follow the objects, then the man: cargo aboard; the captain’s plan; the landfall; Billington takes possession. Use the move buttons to revise the sequence.'};
  if(g.dating!=='written')return {ok:false,message:'The log introduces its record on 18 July, then looks back to loading on 6 July. Which date belongs to the act of writing?'};
  if(g.arrivalDate!=='unresolved')return {ok:false,message:'Compare the date on Mina’s storm entry with “last night” in the 9 August dispatch. These records do not agree neatly on one calendar date. Keep their relative sequence.'};
  if(!pair(g.dateEvidence,['consignee','mina']))return {ok:false,message:'Cite the two dated accounts that create the arrival-date problem: one from the correspondent and one from Mina.'};
  return {ok:true,message:'Sequence established. Loading precedes the final vow, the landfall and Billington’s taking possession. You kept 18 July as a writing date, and left the arrival’s calendar date unresolved.'};
 }
 if(stage===1){
  if(g.claim!=='bound')return {ok:false,message:g.claim==='killer'?'The captain’s account reports the mate’s leap, then guesses that he killed the men. No second record establishes that accusation.':g.claim==='monster'?'The records contain frightening testimony, but the boarding party does not independently establish what caused the losses.':'An estimate of time since death cannot give an exact hour. Look for an intention that matches a physical observation.'};
  if(!pair(g.support,['vow','wheel']))return {ok:false,message:'Match a record made before landfall to the physical arrangement found after it. The last intention and the boarding report can support one another.'};
  if(g.limit!=='inference')return {ok:false,message:'The correspondent sees the body and bindings. The act of tying them is reconstructed from the captain’s intention and the coastguard’s inference; nobody here witnesses it happen.'};
  return {ok:true,message:'Corroborated, with a limit. The stated intention fits the bindings, beads and crucifix. Self-binding is supported by these records; it is still an inference, and it does not explain the lost crew.'};
 }
 if(stage===2){
  if(g.lead!=='billington')return {ok:false,message:g.lead==='dog'?'The dog’s route ends in darkness. The cargo has a named recipient and a reported transfer; that makes a more checkable next inquiry.':'The mate’s accusation and the doctor’s estimate leave questions. Look for an object that appears both at departure and after arrival, with a named recipient.'};
  if(!pair(g.trail,['cargo','consignee']))return {ok:false,message:'Connect the boxes loaded at Varna to the boxes taken into possession at Whitby. Two records make a traceable cargo trail.'};
  return {ok:true,message:'Lead established: ask Mr. S. F. Billington, 7, The Crescent, for the consignment and onward-delivery records. A documented handover is a place to inquire, not evidence of the solicitor’s guilt.'};
 }
 return {ok:false,message:'This case is already complete.'};
}
export const hints=[
 ['The log’s heading and its first event carry different July dates. Read paper 01 carefully.','Paper 10 calls the arrival “last night”; paper 12 dates a storm night from Mina’s perspective.','Order: loading, last intention, landfall, transfer of possession. Treat 18 July as writing; cite 10 and 12 and keep the arrival date unresolved.'],
 ['One paper records a plan before arrival. Another records what was actually found.','Look at papers 06 and 09. What does each writer see, and what does each writer infer?','Choose self-binding, connect 06 and 09, and call it an inference supported by two records.'],
 ['Which item survives the voyage with an identifiable recipient?','The dog vanishes. The boxes pass into named hands. Compare papers 01 and 10.','Choose Billington’s consignment records and connect 01 with 10.']
];
