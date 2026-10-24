// Authored context and reviewed rights presentation. Literary witnesses remain
// in ignored prepared editions.
import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';

// Rights presentation is bound to complete reviewed snapshots, including their
// metadata and notices. It never rewrites an imported or previously stored book.
const shareWitnesses={
 'caesar-vii-la':{source:'15ec3ef2a36352742ddb75d4f7da23a143899b6b60ee3a7ca3192d4917ca1568',snapshot:'55c85c1840e1764c07db8851307dad6c832044d00a0bcb8410f25cb957008102',anchor:'caesar-latin'},
 'marcus-ii-iii-grc':{source:'9752103971dbbfcee8d483e926c4e926f78e8304abdff795f88e9f8766c178dc',snapshot:'2264359c379a7cdead612790a18a7bf8ee9f340f0c031421cbe90a9c6612fa85',anchor:'marcus-greek'}
};
const reviewedSharing=new WeakMap();
const sourceSnapshots={
 'caesar-vii-en':['29c67915a5ebc74c184a0f12d7126fde2a6d9a85e6c65f5cebddf47e09d1325e','d5ef8db3d0f91b5db59efa233153027c4a959f5c8fbd7d16df996bd8b18d673d'],
 'augustus-en':['a74a2ecab34a1925c7122e16e2e34f0d231812ca1f2ab703974bd3dee870fcae','d6dcc282b062ae0d9c807be809a09003f2b880d501923c177388dda635c53081'],
 'augustus-la':['31697d0a451742be7b2b335b4d87fbe948c3b563d96c29a80fe94e14163240cb','6c846f81066dfa2cbf3fd520d581fd8218403d4cd6c8647b4afb99d49dbc84e0'],
 'marcus-ii-iii-en':['c3917dc34b50962b867c21194d05cbb73b9dec08c201c0dbf90b9052897d769e'],
 'sallust-51':['2dc336f2a8efb4757851951410c5a6b8df80dac258576a5a77629de2d7702e64'],
 'tacitus-annals-1':['b843e066ff32c18e63555f9201cbe1b36a7af2e0dd9947c41ef0eda75660a155'],
 'pliny-trajan':['9f3c99169b3458fc12f6e908d47d37dd1eb7c86019bb7a414e5d1fb202c570df','96603b5fbf375893f24bac5cabcf213861c4f3d2803bf04fe0a4826ff8b8ec17']
};
const reviewedSourceCopy=new WeakMap();
export async function prepareRomanSourceCopy(books){
 for(const book of books){
  const pins=sourceSnapshots[book.id];if(!pins)continue;
  try{const snapshot=canonical(book);if(pins.includes(await sha256(new TextEncoder().encode(snapshot))))reviewedSourceCopy.set(book,snapshot);}catch{/* Keep exact stored source notices. */}
 }
}
export function romanSourceText(book,context){
 if(reviewedSourceCopy.get(book)!==canonical(book)||context.through!==null||!context.label.startsWith('Edition'))return context.text;
 const limit='Copyright status outside the United States has not been reviewed for this edition.';
 return context.text.replace('; no broader publication clearance is asserted.','. '+limit)
  .replace('; broader publication remains unreviewed.','. '+limit)
  .replace('; other territories and public release remain separate decisions.','. '+limit)
  .replace('; no print-scan proofreading or broader publication clearance is claimed.','. No print-scan proofreading is claimed. '+limit)
  .replace('; no broader publication decision is made.','. '+limit)
  .replace('; public release elsewhere remains unreviewed.','. '+limit);
}
export async function prepareRomanShareRights(books){
 for(const book of books){
  const witness=shareWitnesses[book.id];if(!witness||book.source.sha256!==witness.source)continue;
  try{const snapshot=canonical(book);if(await sha256(new TextEncoder().encode(snapshot))===witness.snapshot)reviewedSharing.set(book,snapshot);}catch{/* Reading and exact exports remain available. */}
 }
}
export function romanShareAttribution(book){
 const witness=shareWitnesses[book.id];if(!witness||book.source.sha256!==witness.source)return [];
 if(reviewedSharing.get(book)!==canonical(book))throw new Error('This edition’s sharing credits could not be verified. Export the exact edition with its source notes instead.');
 return ['Perseus / Tufts · CC BY-SA 4.0 · selected and reflowed',`Full credits, source, license and changes: https://newreading.app/rome/sources/#${witness.anchor}`];
}
export function romanShareIssue(passage,book,format='text'){
 const greek=book.id==='marcus-ii-iii-grc'&&reviewedSharing.get(book)===canonical(book);
 const inscription=book.id==='augustus-la'&&reviewedSourceCopy.get(book)===canonical(book);
 if(!greek&&!inscription)return '';
 const section=book.sections.find(s=>s.id===passage.sectionId),kinds=greek?['del','ins']:['em'];
 const marked=passage.segments.some(segment=>section.blocks.find(b=>b.id===segment.blockId)?.marks.some(mark=>kinds.includes(mark.kind)&&mark.start<segment.end&&mark.end>segment.start));
 if(!marked)return '';
 if(greek)return 'This selection includes editorial additions or deletions. Plain text and quotation cards cannot preserve those signs here. Export the exact edition instead.';
 return format==='card'?'':'This selection includes reconstructed Latin letters. Plain text would lose their italic signs. Make a card or export the exact edition instead.';
}
export const works=[
 {en:'caesar-vii-en',original:'caesar-vii-la',name:'Caesar',title:'Gallic War',scope:'Book VII · all 90 chapters',date:'52 BCE',language:'Latin',intro:'A commander narrates a year of revolt, siege and conquest.'},
 {en:'augustus-en',original:'augustus-la',name:'Augustus',title:'Res Gestae',scope:'All 35 sections · later Summary separate',date:'14 CE',language:'Latin',intro:'An emperor sets down the achievements by which he asks to be remembered.'},
 {en:'marcus-ii-iii-en',original:'marcus-ii-iii-grc',name:'Marcus Aurelius',title:'Meditations',scope:'Books II–III · both complete',date:'Second century CE',language:'Greek',intro:'A ruler addresses himself about judgment, mortality and life with other people.'}
];
export const essays=[
 {id:'caesar-voice',book:'caesar-vii-en',sections:['vii-1','vii-5'],title:'Caesar writing Caesar',scope:'VII.1 and VII.5 · with Catiline 51',text:'Caesar gives himself a name and a place in the third person. That distance can make his account sound like an external record, but he remains the commander whose decisions it describes. At VII.5 he expressly refuses to state as certain a motive that he cannot establish. Read that admission beside his account of the Gallic leaders’ deliberations at the opening. The narrative’s knowledge has different degrees of certainty.\n\nSallust gives us a different Caesar: the speaker in a Senate debate about punishment during the conspiracy of 63 BCE, eleven years before this campaign. The complete speech in Catiline 51 argues through the danger of precedents and the visibility of powerful men’s actions. It is Sallust’s literary reconstruction, not a transcript and not an independent recording of Caesar’s voice.',url:'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Caesar/Gallic_War/7A*.html',support:'sallust-51',supportSection:'catiline-51',supportLabel:'Read Sallust’s complete speech'},
 {id:'hunger',book:'caesar-vii-en',sections:['vii-77','vii-78'],title:'Hunger at the siege',scope:'VII.77–78 · includes the following chapter when opened at VII.77',text:'Caesar introduces Critognatus’s speech by condemning its cruelty. In the next chapter, he records his own refusal to admit the expelled Mandubii, including women and children, who ask for food and enslavement. The sequence puts two decisions about hunger beside one another; VII.78 does not tell us the expelled people’s ultimate fate.\n\nThe speech and the refusal reach us through the same Roman narrator. They differ in form as well as action: one is a speech attributed to a besieged leader, the other a decision Caesar reports about his own army. Keeping the two complete chapters together lets the reader examine that arrangement without treating either as an unmediated Gallic account.',url:'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Caesar/Gallic_War/7G*.html',compare:['vii-77','vii-78']},
 {id:'two-lines',book:'caesar-vii-en',sections:['vii-69','vii-72','vii-73','vii-74'],title:'Two lines around Alesia',scope:'VII.69–74 · historical plan',text:'The first Roman line faces the town. At VII.74, a second line faces outward against the relief army. Caesar’s description asks us to hold two directions of danger in mind: a force inside the siege and a force approaching from outside it.\n\nThe plan reproduced with Edwards’s edition, after Colonel Stoffel, sets those lines in a landscape of hills and rivers. It is a historical interpretation attached to this translation, not a modern archaeological reconstruction. Its labels can help follow the narrative, but neither its drawn positions nor Caesar’s reported troop totals should be mistaken for measurements made by a present-day survey.',url:'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Caesar/Gallic_War/7F*.html',asset:'alesia'},
 {id:'augustus-power',book:'augustus-en',sections:['rg-19','rg-20','rg-21','rg-22','rg-23','rg-24','rg-34'],title:'What does a ruler count?',scope:'Res Gestae 19–24 and 34 · later Tacitus comparison',text:'The lists of buildings, money and public gifts make rule visible as something completed and counted. In section 34, Augustus turns from that ledger to the relation between his position and the state. His claim joins a transfer of control to Senate and people with his own continuing precedence. The Latin printed in this witness uses dignitate; other critical texts use auctoritate.\n\nTacitus’s later account follows different agents: soldiers, ordinary people, nobles and provinces accommodating themselves to the new order. His account also preserves a qualification easy to miss: the provinces had found senatorial government corrupt and burdensome. The contrast is between two shaped accounts of power, not between a ruler’s statement and a neutral verdict.',url:'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Augustus/Res_Gestae/6*.html',support:'tacitus-annals-1',supportSection:'annals-1-2',supportLabel:'Read Tacitus · Annals I.2–4'},
 {id:'postbag',book:'marcus-ii-iii-en',sections:['ii-1','iii-4'],title:'Letters to an emperor',scope:'Pliny and Trajan · early second century CE · two complete exchanges',text:'A fire at Nicomedia prompts Pliny to ask for an organized company of 150 firemen. Trajan treats the proposal as a question about associations: a body created for a practical purpose could become a political faction. His reply substitutes equipment and assistance from householders and the public. The exchange makes the political terms of a seemingly technical remedy visible.\n\nThe aqueduct letters shift from construction to responsibility. Pliny describes failed works, reusable stone and the need for an expert; Trajan asks who has wasted the money. These letters belong to Trajan’s administration, earlier than Marcus Aurelius. They do not show Marcus putting his own reflections into practice. Their form also differs from the Meditations: a request has a named recipient who can authorize, refuse and demand a report.',url:'https://archive.org/details/letterscaiuspli01bosagoog',support:'pliny-trajan',supportSection:'letter-33',supportLabel:'Read both complete exchanges'},
 {id:'marcus-conduct',book:'marcus-ii-iii-en',sections:['ii-1','ii-2','iii-4','iii-16'],title:'An emperor addressing himself',scope:'Meditations II.1 · and the sequence of Books II–III',text:'The opening begins with the people who will be difficult to meet. It moves from that expectation to shared reason and mutual assistance. Reading the whole numbered reflection matters: the difficult people are not simply a reason to withdraw from them.\n\nThese are exercises addressed to the self, written in Greek. Their commands show the conduct the writer urges on himself; they do not by themselves establish how he governed or how consistently he acted. The books are not a campaign diary with a secure date for each reflection. Chrystal’s English and Leopold’s Greek come from different editorial traditions, so the language switch follows numbered chapters rather than pretending to align every sentence.',url:'https://www.gutenberg.org/ebooks/55317'}
];
export const workFor=id=>works.find(w=>w.en===id||w.original===id);
export const essaysFor=(id,section)=>{const w=workFor(id);return essays.filter(e=>e.book===w?.en&&e.sections.includes(section));};
