// Exact excerpts from the pinned prepared edition. Narrator: Jonathan Harker.
export const EDITION_SHA256="bd6ad7e5338e3866b239553f0b9d93f32f0a56e227c319d72ebf8233005d003a";
export const STORY=[
  {
    "section": "chap02",
    "block": "chap02-b061",
    "date": "8 May",
    "chapter": "II",
    "quote": "The castle is a veritable prison, and I am a prisoner!",
    "context": [
      "chap02-b060",
      "chap02-b061"
    ],
    "start": 0,
    "end": 54,
    "href": "#reference/chap02/chap02-b061"
  },
  {
    "section": "chap02",
    "block": "chap02-b030",
    "date": "7 May",
    "chapter": "II",
    "quote": "In the library I found, to my great delight, a vast number of English books, whole shelves full of them, and bound volumes of magazines and newspapers.",
    "context": [
      "chap02-b030"
    ],
    "start": 0,
    "end": 151,
    "href": "#reference/chap02/chap02-b030"
  },
  {
    "section": "chap04",
    "block": "chap04-b050",
    "date": "25 June",
    "chapter": "IV",
    "quote": "At last I pulled open a heavy door which stood ajar, and found myself in an old, ruined chapel, which had evidently been used as a graveyard.",
    "context": [
      "chap04-b050"
    ],
    "start": 657,
    "end": 798,
    "href": "#reference/chap04/chap04-b050"
  },
  {
    "section": "chap04",
    "block": "chap04-b081",
    "date": "30 June",
    "chapter": "IV",
    "quote": "Hark! in the courtyard and down the rocky way the roll of heavy wheels, the crack of whips, and the chorus of the Szgany as they pass into the distance.",
    "context": [
      "chap04-b080",
      "chap04-b081"
    ],
    "start": 0,
    "end": 152,
    "href": "#reference/chap04/chap04-b081"
  },
  {
    "section": "chap04",
    "block": "chap04-b083",
    "date": "30 June",
    "chapter": "IV",
    "quote": "I may find a way from this dreadful place.",
    "context": [
      "chap04-b083"
    ],
    "start": 169,
    "end": 211,
    "href": "#reference/chap04/chap04-b083"
  }
];
export const citation=s=>`Jonathan Harker’s journal · Chapter ${s.chapter}, ${s.date}`;
export const storyForHash=hash=>STORY.find(s=>s.href===hash);
