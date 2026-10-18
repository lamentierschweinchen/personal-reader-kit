import {passageAt,selectionQuote} from './core.mjs';

// Editorial routes into the pinned editions. No invented dialogue or translations.
export const sessions=[
 {id:'disagreement',number:'01',title:'What do we want from disagreement?',teaser:'Many philosophies; two disputants.',prompt:'When has disagreement changed the question you were asking?',corridor:'These passages work at different scales. Hegel asks why a history containing many philosophies can still be a history of truth. Schopenhauer describes what happens when two individuals think together and then part company. Read for the difference between a necessary diversity of thought and the temptation to locate every mistake in someone else.',sides:[
  {book:'hegel',section:'c10',from:'h0087',to:'h0090',label:'Diversity is part of the work',location:'Introduction · Common Ideas · c. Diversity in Philosophies (pp. 17–19)',orientation:'Hegel has just set out the objection that philosophers keep refuting one another. Here he rejects the conclusion that their diversity makes philosophy futile. His fruit analogy leads to a stronger claim: the differences are necessary to philosophy itself.'},
  {book:'schopenhauer',section:'link2H_4_0003',from:'s0027',to:'s0028',label:'The other person is always mistaken',location:'The Art of Controversy · Preliminary: Logic and Dialectic',orientation:'Schopenhauer proposes a distinction between the laws of thought and the conduct of disputants. His subject here is the obstinacy that interrupts joint reasoning. The diagnosis is narrower than a rejection of disagreement or of truth.'}
 ]},
 {id:'winning',number:'02',title:'Does winning bring us nearer truth?',teaser:'A good argument can still serve a bad end.',prompt:'What would distinguish a convincing performance from a reason to change your mind?',corridor:'Both passages resist making the success of a performance the measure of truth. Schopenhauer separates a proposition from the proof offered for it, then follows the pressure of vanity. Hegel asks what directs a person who can argue from many sides. Their uses of “dialectic” should not be treated as interchangeable definitions.',sides:[
  {book:'hegel',section:'c352',from:'h0670',to:'h0672',label:'Reasons for almost anything',location:'The Sophists · reflective reasoning (pp. 368–371)',orientation:'Hegel has credited the Sophists with a place in Greek intellectual culture. This is his account of its danger: skill at finding reasons does not by itself settle which end should guide us. These are Hegel’s historical judgments, not a neutral transcript of the Sophists.'},
  {book:'schopenhauer',section:'link2H_4_0003',from:'s0029',to:'s0034',label:'A lost proof is not a lost truth',location:'The Art of Controversy · Preliminary: Logic and Dialectic',orientation:'Schopenhauer diagnoses the urge to win, but also explains why a person may hesitate to surrender a claim after one proof fails. Saunders’s preface calls much of the essay ironical.'}
 ]},
 {id:'judgment',number:'03',title:'Can we borrow another person’s judgment?',teaser:'The source, the expert, and an opinion passed around.',prompt:'When is trusting a reader or an expert justified—and what would you check yourself?',corridor:'Hegel begins with a demand to read philosophical works, then immediately admits practical reasons for using historians and abstracts. Schopenhauer traces how repeated acceptance can disguise an untested origin. When does a chain of testimony still connect us to reasons?',sides:[
  {book:'hegel',section:'c110',from:'h0258',to:'h0258',label:'Go to the springs—and know the limits',location:'Introduction · Sources of the History of Philosophy (pp. 110–111)',orientation:'Hegel weighs direct reading against lost, rare, and excessively long sources. Read how quickly an apparently absolute instruction becomes a practical judgment.'},
  {book:'schopenhauer',section:'section-36',from:'s0158',to:'s0164',label:'How an opinion acquires a crowd',location:'The Art of Controversy · Stratagem XXX, middle passage',orientation:'Earlier in this stratagem Schopenhauer has described the appeal to authority as a debating tactic. Here, beginning with “But to speak seriously,” he questions whether wide acceptance adds evidence. His account is sharply contemptuous of the crowd.'}
 ]}
];
export function sessionPassage(side,books){
 const book=books.find(b=>b.id===side.book),section=book?.sections.find(s=>s.id===side.section);
 if(!section)return null;
 const from=section.blocks.findIndex(b=>b.id===side.from),to=section.blocks.findIndex(b=>b.id===side.to);
 if(from<0||to<from)throw Error('The session does not match its reviewed source edition.');
 const segments=section.blocks.slice(from,to+1).filter(b=>b.text.length).flatMap(b=>passageAt(book,section,b).segments);
 return {bookId:book.id,revision:book.source.sha256,sectionId:section.id,segments,quote:selectionQuote(section,segments)};
}
export const historicalSource='https://plato.stanford.edu/entries/schopenhauer/';

// Optional landmarks within the complete paired readings. Each phrase must be
// unique in its named source block. The complete readings and paired reflections
// remain whole; a marked phrase can also be kept as an individual passage.
export const readingCues={
 disagreement:[
  {label:'Fruit and clocks',targets:[
   {block:'h0088',text:'likened to an invalid recommended by the doctor to eat fruit, and who has cherries, plums or grapes, before him, but who pedantically refuses to take anything because no part of what is offered him is fruit'},
   {block:'s0027',text:'ought to think in common, but who, as soon as they cease to agree like two clocks keeping exactly the same time, create a disputation, or intellectual contest.'}
  ]},
  {label:'What difference means',targets:[
   {block:'h0089',text:'such diversity is, and has been, absolutely necessary to the existence of a science of Philosophy and that it is essential to it.'},
   {block:'s0028',text:"he does not begin by revising his own process of thinking, so as to discover any mistake which he may have made, but he assumes that the mistake has occurred in B.'s."}
  ]}
 ],
 winning:[
  {label:'Reasons on either side',targets:[
   {block:'h0670',text:'everything can be proved by argument, and arguments for and against can be found for everything; as particular, however, they throw no light upon the universal, the Notion.'},
   {block:'s0029',text:'my adversary may refute the proof, and thus appear to have refuted the assertion, for which there may, nevertheless, be other proofs.'}
  ]},
  {label:'Where the will enters',targets:[
   {block:'h0672',text:'This is either the good, the universal, or the individuality, the arbitrary will of the subject; and both may be united, as is shown later on in Socrates.'},
   {block:'s0033',text:'the weakness of our intellect and the perversity of our will lend each other mutual support; and that, generally, a disputant fights not for truth, but for his proposition'}
  ]}
 ],
 judgment:[
  {label:'Where evidence begins',targets:[
   {block:'h0258',text:'If we wish to study the history of Philosophy in earnest, we must go to such springs as these.'},
   {block:'s0158',text:'the universality of an opinion is no proof, nay, it is not even a probability, that the opinion is right.'}
  ]},
  {label:'When others read for us',targets:[
   {block:'h0258',text:'There are other periods, too, where it is desirable that others should have read the works of the philosophers and that we should receive abstracts therefrom.'},
   {block:'s0162',text:'It is no more established than an historical fact reported by a hundred chroniclers who can be proved to have plagiarised it from one another; the opinion in the end being traceable to a single individual.'}
  ]}
 ]
};
export function cuePassages(session,index,books){
 const cue=readingCues[session.id]?.[index];if(!cue)throw Error('Unknown reading cue.');
 return session.sides.map((side,i)=>{
  const book=books.find(b=>b.id===side.book),section=book?.sections.find(s=>s.id===side.section),target=cue.targets[i],block=section?.blocks.find(b=>b.id===target.block);
  const whole=sessionPassage(side,books),start=block?.text.indexOf(target.text)??-1;
  if(start<0||block.text.indexOf(target.text,start+1)!==-1||!whole?.segments.some(s=>s.blockId===block.id&&s.start<=start&&s.end>=start+target.text.length))throw Error('A reading cue does not match its complete source passage.');
  return passageAt(book,section,block,start,start+target.text.length);
 });
}
