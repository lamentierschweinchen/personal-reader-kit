export const POE='usher-1845';
export const escapeHTML=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const e=escapeHTML;
export const outward=(url,label)=>`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} <svg class="ui-icon ui-icon--up-right" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"/></svg></a>`;
export const works=[
  {
    "id": "beardsley",
    "kind": "Illustration",
    "artist": "Aubrey Beardsley",
    "date": "1894",
    "title": "A man listening",
    "blocks": [
      "u31"
    ],
    "start": "At times, again,",
    "paras": [
      "Beardsley places Roderick low on the sheet, facing a curtain drawn with little more than an outline. A black band cuts across the space above him; another fills the lower edge. Between them, a few lines enclose a large, pale space. The house has almost disappeared around the man who listens to it.",
      "In the narrator’s account, Roderick seems to be listening to an imaginary sound. That is a suspicion, not something the drawing can verify. Roderick’s hand and rigid profile give his attention a visible shape; its object remains outside the image."
    ],
    "ending": false,
    "sources": [
      {
        "label": "The Met · object and image",
        "url": "https://www.metmuseum.org/art/collection/search/753521"
      },
      {
        "label": "The Met · Open Access",
        "url": "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access"
      }
    ],
    "end": "It was no wonder",
    "image": "beardsley.jpg",
    "alt": "Roderick sits in profile in the lower right of a largely pale ink drawing. At left, a curtain is outlined with fine lines; broad black bands frame the space above and below him.",
    "caption": "The Fall of the House of Usher · pen, brush and India ink over graphite · The Metropolitan Museum of Art, 2021.16.16",
    "url": "https://www.metmuseum.org/art/collection/search/753521",
    "credit": "Image: The Metropolitan Museum of Art · Public Domain / CC0"
  },
  {
    "id": "clarke",
    "kind": "Illustration",
    "artist": "Harry Clarke",
    "date": "1919; reproduction in 1923 edition",
    "title": "At the threshold",
    "blocks": [
      "u49"
    ],
    "start": "It was the work",
    "paras": [
      "Clarke gives Madeline two long, reaching arms. One rises diagonally; the other cuts across the black field almost horizontally. The pale opening behind her is narrower than that gesture. Strands of clothing hang from her hands and body, making the figure at once elaborate and threadbare.",
      "Poe describes blood on white robes and a moment of trembling on the threshold. He does not specify this reach: Clarke supplies it. Where Beardsley leaves a man facing an unseen cause, this later illustration extends a body into the room. These are different moments in the story, brought together after the ending to compare what each artist makes visible."
    ],
    "ending": true,
    "sources": [
      {
        "label": "Duke copy · 1923 edition",
        "url": "https://archive.org/details/talesofmysteryim01poee"
      },
      {
        "label": "Public Domain Review · illustrations and reproduction rights",
        "url": "https://publicdomainreview.org/collection/harry-clarke-s-illustrations-for-poe-s-tales-of-mystery-and-imagination-1919"
      }
    ],
    "image": "clarke.jpg",
    "alt": "Madeline stands within a narrow white opening against a black field. Her two long arms reach to the right, one raised and one nearly horizontal; fine patterned strands of clothing hang from her body and hands.",
    "caption": "Madeline at the doorway · plate facing p. 130 in Duke University’s copy of Tales of Mystery and Imagination, catalogued 1923",
    "url": "https://archive.org/details/talesofmysteryim01poee",
    "credit": "Harry Clarke · illustration first published 1919 · Duke University Libraries / Internet Archive · underlying illustration public domain"
  },
  {
    "id": "epstein",
    "kind": "Film adaptation",
    "artist": "Jean Epstein",
    "date": "1928",
    "title": "A portrait replaces an abstraction",
    "blocks": [
      "u17"
    ],
    "start": "If ever mortal painted an idea",
    "paras": [
      "Poe’s narrator struggles to put Roderick’s paintings into words. He calls them abstractions; even the one he describes more fully is a strange, empty vault. Epstein gives Roderick a different subject: Madeline, whose strength declines as her portrait advances.",
      "The film brings The Fall of the House of Usher together with another Poe story, The Oval Portrait. It also makes Madeline Roderick’s wife, where Usher names her as his sister. Painting is no longer only an expression of the brother’s troubled imagination: the act of making an image becomes entangled with the sitter’s life. Watch the portrait scenes against the passage about abstraction. The film has changed what Roderick’s art does."
    ],
    "ending": false,
    "sources": [
      {
        "label": "Cinémathèque française · film and restoration",
        "url": "https://www.cinematheque.fr/henri/film/48361-la-chute-de-la-maison-usher-jean-epstein-1928/"
      },
      {
        "label": "Cinémathèque française · the two stories and altered relationship",
        "url": "https://www.cinematheque.fr/catalogues/restaurations-tirages/film.php?id=48361"
      }
    ],
    "url": "https://www.cinematheque.fr/henri/film/48361-la-chute-de-la-maison-usher-jean-epstein-1928/",
    "link": "Watch at the Cinémathèque française",
    "note": "The linked presentation is the Cinémathèque’s 2013 digital restoration, with Gabriel Thibaudeau’s score performed by the Octuor de France. That accompaniment is distinct from the 1928 film. Full film; reveals the story’s ending. English subtitles available."
  },
  {
    "id": "debussy",
    "kind": "Unfinished opera · later staging",
    "artist": "Claude Debussy; modern staging by Olivier Dhénin",
    "date": "Manuscript c. 1908–1912 · filmed scenes 2020",
    "title": "Who sings the palace?",
    "blocks": [
      "u19"
    ],
    "start": "The words of one of these rhapsodies",
    "paras": [
      "The Haunted Palace reaches us twice removed: Roderick sings it, and the visitor recalls words he admits may not be exact. Its changing palace is therefore also a performance remembered by a frightened listener.",
      "The Musée Henner’s 2020 filmed scenes place a Haunted Palace prologue among Madeline’s interior monologues. A poem the story gives to Roderick becomes part of her voice. Listen for that change of speaker before treating the performance as the missing sound of Poe’s song.",
      "Debussy left his opera unfinished. The BnF manuscript contains a libretto and the opening musical sketches. These filmed scenes belong to Olivier Dhénin’s modern staging; they are not evidence of a completed opera by Debussy."
    ],
    "ending": false,
    "sources": [
      {
        "label": "BnF · autograph manuscript MS-9885",
        "url": "https://catalogue.bnf.fr/ark:/12148/cb42939275j"
      },
      {
        "label": "Musée Henner · 2020 filmed scenes",
        "url": "https://musee-henner.fr/actualite/un-opera-inedit-de-debussy-au-musee-henner"
      }
    ],
    "url": "https://musee-henner.fr/actualite/un-opera-inedit-de-debussy-au-musee-henner",
    "link": "Watch the Musée Henner scenes",
    "note": "Modern filmed staging; related material may reveal the full story."
  },
  {
    "id": "parsons",
    "kind": "Musical adaptation",
    "artist": "The Alan Parsons Project",
    "date": "1976",
    "title": "A storm made audible",
    "blocks": [
      "u32"
    ],
    "start": "Shaking this off",
    "paras": [
      "Poe’s narrator listens through gaps in the storm. Later, the noises of a romance read aloud acquire disturbing counterparts in the house. Sound arrives before a reliable account of its source.",
      "The Alan Parsons Project gives the story five movements: Prelude, Arrival, Intermezzo, Pavane and Fall. The credits for Arrival identify thunder and storm effects recorded outside Abbey Road Studio Two with a binaural dummy head. Here one of the sounds has a literal source: weather caught by microphones. Begin with Arrival, then return to the narrator’s uncertain listening. A convincing sound and a trustworthy explanation are different things."
    ],
    "ending": true,
    "sources": [
      {
        "label": "The Alan Parsons Project · credits and versions",
        "url": "https://www.the-alan-parsons-project.com/tales-of-mystery-and-imagination"
      }
    ],
    "end": "Overpowered by an intense sentiment",
    "url": "https://www.the-alan-parsons-project.com/tales-of-mystery-and-imagination",
    "link": "Album and listening links",
    "note": "The suite is credited to Eric Woolfson, Alan Parsons and Andrew Powell. The album first appeared in 1976; the 1987 remix added Orson Welles narration. Check the version when listening. Official artist page; movement titles and linked album include ending material."
  },
  {
    "id": "glass",
    "kind": "Opera adaptation",
    "artist": "Philip Glass · libretto by Arthur Yorinks",
    "date": "1987; premiered 1988",
    "title": "Giving the witness a name",
    "blocks": [
      "u31"
    ],
    "start": "It was no wonder",
    "paras": [
      "Poe leaves his visitor unnamed. We see Roderick through this man’s recollections, even as he admits that his friend’s fear has infected him. The witness is part of the disturbance he describes.",
      "In Philip Glass and Arthur Yorinks’s opera, the visitor is William. A singer now stands where the prose gave us a narrating voice. Giving the witness a name and a visible presence makes him available for scrutiny alongside Roderick and Madeline. The composer’s account of the opera keeps the possibility of hallucination open; embodiment need not remove uncertainty."
    ],
    "ending": false,
    "sources": [
      {
        "label": "Philip Glass · composition and premiere",
        "url": "https://philipglass.com/compositions/fall_of_the_house_of_usher/"
      },
      {
        "label": "Philip Glass · authorized album",
        "url": "https://philipglass.bandcamp.com/album/philip-glass-the-fall-of-the-house-of-usher"
      }
    ],
    "url": "https://philipglass.bandcamp.com/album/philip-glass-the-fall-of-the-house-of-usher",
    "link": "Listen on Philip Glass’s Bandcamp",
    "note": "Music by Philip Glass; libretto by Arthur Yorinks. Composed in 1987; premiered at the American Repertory Theater on 18 May 1988. The linked album is listed as a 2022 release. Full opera; reveals the story’s ending."
  }
];
export function cover(book,state){return `<section class="usher-cover"><div class="cover-copy"><p class="eyebrow">Edgar Allan Poe · Tales, 1845</p><h1>The Fall<br>of the House<br>of <em>Usher.</em></h1><div class="cover-bottom"><button class="primary" data-action="resume" data-book="${POE}" ${book?'':'disabled'}>${state.positions[POE]?'Continue reading':'Read the story'} <svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"/></svg></button><p>A complete story.<br>Illustrations, film & music in its wake.</p></div></div><figure class="cover-figure"><img src="/beardsley.jpg" alt="Aubrey Beardsley’s pen-and-ink drawing of a seated Roderick Usher." width="2314" height="3645"><figcaption>Aubrey Beardsley, 1894 <button class="text" data-action="work" data-work="beardsley">Look closely</button></figcaption></figure><div class="cover-foot"><span>THE STORY & ITS AFTERLIVES</span><a href="#companion">Enter the collection</a><button class="text" data-action="sources">Edition & sources</button></div></section>`;}
export function gallery(state,returnHTML,ending=false){return `<section class="page collection"><header class="collection-head"><div><p class="eyebrow">The story & its afterlives</p><h1>What the house became.</h1></div><p>Two illustrations, a film and three musical responses.</p></header><div class="collection-return">${returnHTML}<button class="text" data-action="spoilers">${ending?'Hide ending material':'Ending material is hidden'}</button></div><div class="plate-list">${works.slice(0,2).map((w,i)=>`<article class="plate-item"><button class="plate-button ${w.ending&&!ending?'veiled':''}" data-action="work" data-work="${w.id}" aria-label="${w.ending&&!ending?'Reveal an illustration from the ending':`Inspect ${w.artist}’s drawing`}">${w.ending&&!ending?'<span class="veil-number">II</span><span class="veil-label">An image from the ending<br><u>Choose to reveal</u></span>':`<img src="/${w.image}" alt="${e(w.alt)}" loading="lazy">`}</button><div class="plate-label"><p class="eyebrow">0${i+1} · ${w.kind} · ${w.date}</p><h2><button class="text" data-action="work" data-work="${w.id}">${w.ending&&!ending?'The second illustration':e(w.title)}</button></h2><p>${w.artist}</p></div></article>`).join('')}</div><section class="listen-list"><div class="section-label"><h2>On screen. In sound.</h2><p>Read the passage here; visit the work at its official source. External sites need a connection and may reveal the ending.</p></div>${works.slice(2).map((w,i)=>`<button class="work-row" data-action="work" data-work="${w.id}"><span class="work-number">0${i+3}</span><span><span class="eyebrow">${w.kind} · ${w.date}</span><strong>${e(w.title)}</strong><span>${e(w.artist)}</span></span><svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"/></svg></button>`).join('')}</section></section>`;}
export function sourcesHTML(){return `<div class="source-copy"><p class="eyebrow">Edition & sources</p><h3>Edgar Allan Poe, <em>Tales</em>, 1845</h3><p>The complete story follows the Wiley & Putnam edition, pages 64–82. Historical spelling, the French epigraph, the six stanzas of The Haunted Palace, emphasis and the Mad Trist reading are retained. Poe’s original footnote is reachable from its asterisk and printed after the story.</p><p>The Poe Society’s transcription is checked against a scan of the 1845 volume. Modern corrections shown in double brackets on that website are excluded; the earlier printed readings remain, including “rèsonne”, “trellissed” and “sulphureous”. The capital in “Œgipans” on page 75 is restored from the printed scan; the transcription gives a lowercase letter. Printed page breaks become continuous reading. Verse indentation and line breaks remain.</p><p>${outward('https://eapoe.org/works/tales/usherd.htm','Poe Society transcription')}<br>${outward('https://archive.org/details/tales00poeedgar','1845 volume, University of North Carolina')}</p><h3>Two illustrations</h3><p>Beardsley’s 1894 drawing comes from The Metropolitan Museum of Art, accession 2021.16.16. Its image is marked Public Domain and made available under CC0. Clarke’s illustration was first published in 1919; the scan used here is the 1923 Harrap edition held by Duke University Libraries. They depict different moments.</p><p>${outward('https://www.metmuseum.org/art/collection/search/753521','Beardsley at the Met')}<br>${outward('https://www.metmuseum.org/hubs/open-access','Met Open Access')}<br>${outward('https://archive.org/details/talesofmysteryim01poee','Clarke’s 1923 scanned edition')}</p><h3>Reading the adaptations</h3><p>The accompanying observations are editorial readings, not statements of the artists’ intentions. Film, music, modern restorations, performances and completions have separate rights. This reader links to official sources; it includes no audio or film. External sources can discuss the ending.</p><h3>Your copy</h3><p>Reading position, appearance and saved passages stay in this browser. Settings offers private exports and restoration. A different browser or address has a separate collection. Browser storage can be cleared; an offline copy is not a backup.</p><p>Text and art provenance were checked on 18 October 2026. IM Fell English is used under the SIL Open Font License.</p><a href="/OFL-IMFell.txt" target="_blank" rel="noopener">Font licence</a></div>`;}
