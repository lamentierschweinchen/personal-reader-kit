import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';

// Complete reviewed edition snapshots, including source notes. Imported or
// customized data never receives a publication claim based on its ID alone.
const witnesses = {
  "erlkoenig-de": {
    "source": "d553c3cb787b8305791a4b9164c69990709666678ccba1615bba7d3509306ad3",
    "snapshots": [
      "26fbc1466de8b9fb8d3ef0c386b894b49662ee71ea56ec7173518d58ca1ca6c8"
    ],
    "share": true
  },
  "erlkoenig-en": {
    "source": "448a0b109eab3cc7afaa9364a5bc394c85e888c25c7194c4bfbe88a462a437df",
    "snapshots": [
      "3338870c6c7b54756dfdbb835b5d58011b3e30bec3b6a518ee2de65bb00f06b3"
    ],
    "share": false
  },
  "handschuh-de": {
    "source": "cf95d4ed558d91a3a4b9ea8d85470f476755bfe6d3c132bad093e8d764d9d294",
    "snapshots": [
      "1ab6898d5b6aacbfe78c142949255e64a184b14802484899c28cf34f90192617"
    ],
    "share": false
  },
  "handschuh-en": {
    "source": "b87a217ebcbfd017810c8918def16362434f4ef8580d782b39974c2ce0953795",
    "snapshots": [
      "c01bec63256223375c357477002d2bc27a5471bba8a2eb7b5fac0265c47ea464",
      "835c1a8a2be706eebf38994eb5eb9223a4ac188bfefe0280090ead70013efe71"
    ],
    "share": false
  },
  "iphigenie-de": {
    "source": "2b20693f34e6a8869d700cd10f4f0cbe9111797859a174ab10fe3c41a5d329a2",
    "snapshots": [
      "d6eed21d05b9a7681b1bb953f4a9b7b73526c35a6cf5ed6ee1fce6c173a39696",
      "4bb5bccf425f1c56a7c166317a5f7a120f863288a847b0480015850bbe904aef"
    ],
    "share": false
  },
  "iphigenie-en": {
    "source": "9a763196d921884d8bb6867df55cf9cc6e158642834815a6ea15cb6fef9987d7",
    "snapshots": [
      "478e9acbff61858058418e963aacaea1c8030deca6b631b1ff9dd583d0e3403c"
    ],
    "share": false
  },
  "kraniche-de": {
    "source": "b7974d65856bc391d28f04ebe98ade690796bd01d40ab12823f2e57aa44b63e0",
    "snapshots": [
      "81afa9b70392e4cc67b825343de4c89c4ee607c3dab89fc2a149cd641e5ee007"
    ],
    "share": true
  },
  "kraniche-en": {
    "source": "b87a217ebcbfd017810c8918def16362434f4ef8580d782b39974c2ce0953795",
    "snapshots": [
      "e27566c9fb10142b2381464e924b7625836e7fb0e4221a37bfe640c9d630bedf",
      "9b52e2614a4a2522395b06944d6701affeb9291923f86aeca60d6414af408d82"
    ],
    "share": false
  },
  "lenore-de": {
    "source": "97c3744b154c3dd4fe65c40f4ec537d4a98ce95090892042f868a36fa90fb776",
    "snapshots": [
      "ca89cca43b36539f86531e52428f5e8dfd0208972f7fa757047e4268c21679cb"
    ],
    "share": true
  },
  "lenore-en": {
    "source": "eff3f42935453285ed192dc09eb967c558af84ef6d2ccb4ab017620622ab1c61",
    "snapshots": [
      "4772ed5549f4db86ed331149014a65dfcdb099d7f94253640c53da05e9be8761"
    ],
    "share": false
  },
  "taucher-de": {
    "source": "9cac09269a70b47fbf2a7a5ce9558d91c946215c43c283a5e348b79addf5699a",
    "snapshots": [
      "256cce89ce7bca5283be946f2d0b408eba6c9f0034dcd0f87f72609ed433aeaf"
    ],
    "share": true
  },
  "taucher-en": {
    "source": "b87a217ebcbfd017810c8918def16362434f4ef8580d782b39974c2ce0953795",
    "snapshots": [
      "99c8c783422b54d151d465b7b7d6377ca0cc74a2a7b6aab217d8fd600eec0df9",
      "1627957fe0c9f4388d4d61f46e3a97e96091cd35a206d35b750abf11948835ff"
    ],
    "share": false
  }
};
const reviewed = new WeakMap();
export async function prepareBalladShareRights(books) {
  for (const book of books) {
    const witness = witnesses[book.id];
    if (!witness || book.source.sha256 !== witness.source) continue;
    try {
      const snapshot = canonical(book);
      if (witness.snapshots.includes(await sha256(new TextEncoder().encode(snapshot)))) reviewed.set(book, snapshot);
    } catch { /* Exact reading and recovery remain available. */ }
  }
}
export function isReviewedBallad(book) {
  return reviewed.has(book) && reviewed.get(book) === canonical(book);
}
export function balladShareAttribution(book) {
  const witness = witnesses[book.id];
  if (!witness || book.source.sha256 !== witness.source) return [];
  if (book.id === 'iphigenie-en') {
    if (!isReviewedBallad(book)) throw new Error('This edition’s sharing credits could not be verified. Export the exact edition with its source notes instead.');
    return [PG_NOTICE, 'United States public-domain basis; check local law elsewhere.', 'Full Project Gutenberg License: https://www.gutenberg.org/policy/license.html'];
  }
  if (!witness.share) return [];
  if (!isReviewedBallad(book)) throw new Error('This edition’s sharing credits could not be verified. Export the exact edition with its source notes instead.');
  return [
    'Wikisource contributors · adapted transcription · CC BY-SA 4.0',
    'https://creativecommons.org/licenses/by-sa/4.0/',
    `Source, contributor history and changes: https://newreading.app/ballads/sources/#${book.id}`
  ];
}
export function balladContextPresentation(book, context) {
  if (!isReviewedBallad(book)) return context;
  if (context.label === 'Local edition' && context.text === 'This collection is prepared for local reading. Historical spelling, translation and source uncertainties remain part of the edition. Public release requires a separate source and audience review.') {
    return {...context, label:'Edition scope', text:'Historical spelling, translation and source uncertainties remain part of this edition. Source notes identify each selected witness.'};
  }
  if (book.id === 'iphigenie-en' && context.label === 'Anna Swanwick') {
    return {...context, text:context.text.replace(' This local edition is not authorized for public hosting.', '')};
  }
  if (book.id === 'erlkoenig-en' && context.label === 'Edgar Alfred Bowring · checked print witness') {
    return {...context, text:context.text.replace('as1874', 'as 1874').replace('titlepage is1882', 'title page is 1882')};
  }
  if (book.id === 'lenore-de' && context.label === 'German witness') {
    return {...context, text:context.text.replace('Spencer’s1796', 'Spencer’s 1796')};
  }
  return context;
}

export const PG_NOTICE = 'This eBook is for the use of anyone anywhere at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org';
export function pgNoticeKey(book) {
  return book?.id === 'iphigenie-en' && isReviewedBallad(book) ? 'ballads-pg-notice-' + witnesses[book.id].snapshots[0] : null;
}
