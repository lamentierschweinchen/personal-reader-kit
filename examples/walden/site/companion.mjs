// Original editorial reading. Quoted passages are opened from the exact edition,
// never pasted into this module. Each reading has an explicit permission boundary.
export const introduction = `Thoreau lived at Walden Pond from 1845 to 1847, in a house on Emerson’s land. Walden was published in 1854; the civil-disobedience essay had appeared in 1849 as “Resistance to Civil Government.” This collection reverses their publication order. Thoreau also worked as a land surveyor. The writer who asks how to live keeps accounts, measures property, and argues about what a citizen owes.`;
export const introductorySource = 'https://concordlibrary.org/special-collections/fin_aids/HDT';
export const readings = [
 {id:'cost',title:'What belongs in the total?',label:'After Economy',book:'walden',section:'chap02',
  paragraphs:[],refs:[],
  sources:[{label:'Evidence: the complete source chapter, Economy',url:'https://www.gutenberg.org/cache/epub/205/pg205-images.html#chap02'}]},
 {id:'depth',title:'The bottom and the symbol',label:'After The Pond in Winter',book:'walden',section:'chap17',
  paragraphs:[
   `The survey’s lines A–B and C–D cut across the pond; the profiles below turn a surface outline into depth. Soundings mark places where a measurement was made, without establishing that every point on the bottom was measured. The railroad and the small label for the house put the water among human works.`,
   `The accompanying paragraph describes an early-1846 survey with compass, chain, and sounding line. Against stories of a bottomless pond, Thoreau supplies a method and a maximum depth. The paragraph then turns to the pond’s value as a symbol. An exact depth and an imaginative use coexist within the same piece of prose.`,
   `Concord Free Public Library catalogues his manuscript Walden Pond survey as item 133a, dated [1846]. Its collection also contains land and property surveys he made for the town and private owners.`,
   `Later in the chapter, Thoreau notices the deepest point where the lines of greatest length and breadth cross. He then makes a prediction at White Pond: the measured deepest point is within a hundred feet of his guess, and a foot deeper. The movement is from measurement to conjecture to another measurement; his subsequent comparison with human character does not undergo the same test.`,
  ],
  refs:[{needle:'As I was desirous to recover',label:'Read the sounding method'},{image:true,label:'Inspect the original survey in context'},{needle:'In order to see how nearly I could guess',label:'Read the trial at White Pond'},{needle:'What I have observed of the pond is no less true in ethics.',label:'Read the turn to character'}],
  sources:[{label:'Manuscript survey record, [1846], Concord Free Public Library',url:'https://concordlibrary.org/special-collections/walden/1'},{label:'Thoreau papers and survey practice, Concord Free Public Library',url:'https://concordlibrary.org/special-collections/fin_aids/HDT'}]},
 {id:'tax',title:'A payment is also a relation',label:'After Civil Disobedience',book:'civil-disobedience',section:'chap20',
  paragraphs:[
   `The essay distinguishes the poll tax Thoreau refused from the highway tax he says he is willing to pay. In the passage about allegiance, he declines to trace his dollar to a particular purchase. His concern is what relation the payment acknowledges. Read that distinction beside the account of his imprisonment.`,
   `Thoreau spent one night in Concord jail in 1846. The essay confronts slavery and the Mexican War, and first appeared as “Resistance to Civil Government” in Aesthetic Papers in 1849. The title used by this source collection is later wording.`,
   `The comparison with Economy is editorial, not a claim that Thoreau planned these two works as a single sequence. The house account asks which costs a sum includes; the tax essay asks what participation a payment signifies.`,
   `Leaving labor out of a household total and withholding a payment to the state are different acts. One changes the account of a house’s cost; the other brings Thoreau to jail. The shared vocabulary of payment does not make their consequences equivalent.`,
  ],
  refs:[{needle:'I have never declined paying the highway tax',label:'Read the distinction between payments'},{needle:'I have paid no poll-tax for six years',label:'Read the imprisonment passage'}],
  sources:[{label:'Social Reform, The Walden Woods Project',url:'https://www.walden.org/what-we-do/library/thoreau/civil-disobedience/'}]},
];

// Account displays quote the installed edition at runtime. IDs locate its exact
// blocks; needles select exact ranges, and unavailable evidence fails visibly.
export const accountSheets = [
 {id:'house',title:'House',total:'$28.12½',ledger:'chap02-b77',
  scope:'Materials and transportation. The work has no price in this total.',
  evidence:[
   {block:'chap02-b76',needle:'but not counting the work, all of which was done by myself',label:'The terms of the figure',contextLabel:'Read the terms of the house account'},
   {block:'chap02-b78',needle:'These are all the materials excepting the timber stones and sand, which I claimed by squatter’s right.',label:'Materials outside the ledger'},
   {block:'chap02-b72',needle:'with the help of some of my acquaintances',label:'Earlier, at the raising'},
  ],
  note:'The claim of doing the work himself sits beside an earlier acknowledgment of help raising the frame. The account records money spent; it does not price every contribution to the house.'},
 {id:'food',title:'Food',total:'$8.74',ledger:'chap02-b90',
  scope:'Eight months: July 4th to March 1st. This is money spent on food, not everything eaten.',
  evidence:[
   {block:'chap02-b89',needle:'not counting potatoes, a little green corn, and some peas, which I had raised, nor considering the value of what was on hand at the last date',label:'Before the food account'},
   {block:'chap02-b99',needle:'But the dining out, being, as I have stated, a constant element, does not in the least affect a comparative statement like this.',label:'His defense of the comparison'},
  ],
  note:'Thoreau acknowledges dining out and treats it as a constant in his comparison. The figure is therefore narrower than the cost of supplying all his meals. The original list also separates foods he calls failed experiments.'},
 {id:'outgoes',title:'All outgoes',total:'$61.99¾',ledger:'chap02-b95',
  scope:'House, a year of farming, and eight months of food, clothing and household expenses.',
  evidence:[
   {block:'chap02-b94',needle:'excepting for washing and mending, which for the most part were done out of the house, and their bills have not yet been received',label:'Bills still outside the sum'},
   {block:'chap02-b98',needle:'beside the leisure and independence and health thus secured, a comfortable house for me as long as I choose to occupy it.',label:'What remains on the other side'},
  ],
  note:'This is neither an annual budget nor a recurring cost: it combines different periods with a house that remains available to him. His closing balance names leisure, independence and health alongside the house.'},
];
