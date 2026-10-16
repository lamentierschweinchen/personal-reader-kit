"""Edition-specific, local adapter for the inspected PG 28885 HTML archive.

Requires lxml and Pillow. Reads only the pinned original ZIP, never its network
links. Outputs a candidate, not a new rights approval. See SOURCE-AND-RIGHTS.md.
"""
import base64
import hashlib
import json
import re
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from lxml import html, etree
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.reader/private/pg28885-h.zip'
PIN = '7f697b6970ebe918109c824fc613ff8c8027b7cb96cc23c98686edebaf4969c5'
BASE = 'https://www.gutenberg.org/cache/epub/28885/'
sha = lambda data: hashlib.sha256(data).hexdigest()
raw = SOURCE.read_bytes()
assert sha(raw) == PIN, 'A different source edition needs a new review.'
with ZipFile(BytesIO(raw)) as z:
    assert len(z.infolist()) < 100 and sum(i.file_size for i in z.infolist()) < 8_000_000
    files = {}
    for i in z.infolist():
        p = Path(i.filename)
        assert not p.is_absolute() and '..' not in p.parts and i.filename not in files
        assert i.file_size < 8_000_000 and i.file_size / max(1, i.compress_size) < 150
        assert i.external_attr >> 16 & 0o170000 != 0o120000 and not i.flag_bits & 1
        files[i.filename] = z.read(i)
source_html = files['pg28885-images.html']
doc = html.fromstring(source_html)
body = doc.find('body')
assets = []
inventory = []
alts = {
 'cover.jpg': "Red book cover with an inset illustration. Lettering: Alice’s Adventures in Wonderland. By Lewis Carroll. Illustrated by Arthur Rackham.",
 'endpapers.jpg': 'Green endpaper drawing: a small house and a bare tree beside a winding path.',
 'f0002-image.jpg': 'Frontispiece: Alice stands facing the viewer, her hands held together in front of her.',
 'title.png': 'Decorated title page: Alice’s Adventures in Wonderland by Lewis Carroll. Illustrated by Arthur Rackham. With a proem by Austin Dobson. London: William Heinemann. New York: Doubleday, Page & Co.',
 'spine.jpg': 'Red book spine with gold title, author, illustrator and publisher lettering.',
 'p0003-rabbithole.png': 'A black-and-white drawing of the dark rabbit-hole under roots and brambles.',
 'p0015-image.png': 'Alice with a very long neck and body, standing in a narrow frame.',
 'p0022-insert2.jpg': 'Alice swims in the pool of tears among small animals and a large bird.',
 'p0028-insert2.jpg': 'Alice stands among a crowd of birds and animals gathered after the race.',
 'p0030-dormouse.png': 'Alice sits opposite a small mouse standing upright with its long tail curling behind it.',
 'p0036-insert2.jpg': 'Alice stands at the left of a path while the White Rabbit gestures beside a bare tree.',
 'p0050-insert2.jpg': 'Alice looks up at a Caterpillar seated on a mushroom and smoking a hookah.',
 'p0056-image.png': 'Alice leans away as a flurry of birds rushes past her.',
 'p0059-image.png': 'Alice’s long neck winds among a tree’s branches.',
 'p0067-image.png': 'Alice stands outside a door beside a seated, formally dressed footman.',
 'p0070-insert2.jpg': 'The Duchess holds a baby in a crowded kitchen with Alice, the cook, the Cheshire Cat and flying utensils.',
 'p0074-insert2.jpg': 'Alice holds a small pig in her arms beneath the trees.',
 'p0075-image.png': 'The Cheshire Cat lies on a tree branch, its wide grin turned outward.',
 'p0079-image.png': 'Alice looks up toward the Cheshire Cat in a gnarled tree.',
 'p0084-insert2.jpg': 'Alice sits at a long tea table outdoors with the Hatter, March Hare and Dormouse.',
 'p0100-insert2.jpg': 'The Queen stands beside Alice and the Knave while card gardeners lie on the ground.',
 'p0103-image.png': 'Alice holds a flamingo whose neck bends down toward a hedgehog.',
 'p0106-image.png': 'The Cheshire Cat’s grinning head appears alone amid curved lines.',
 'p0109-image.png': 'The executioner stands with a large axe.',
 'p0116-insert2.jpg': 'Alice, the Queen and several card courtiers in a wooded croquet scene, with hedgehogs on the ground.',
 'p0119-image.png': 'A Gryphon sits beneath the branches of a tree.',
 'p0132-insert2.jpg': 'Alice sits between the Gryphon and Mock Turtle near the shore.',
 'p0136-image.png': 'The Mock Turtle stands upright, lifting one hoof beside its long face.',
 'p0140-insert2.jpg': 'The King and Queen preside over a crowded courtroom, with the White Rabbit nearby.',
 'p0149-image.jpg': 'The cook stands holding a pepper pot.',
 'p0158-insert2.jpg': 'Alice raises her hands as a pack of playing cards flies around her.',
}
for name, data in files.items():
    if not name.startswith('images/'):
        continue
    short = Path(name).name
    initial = {'a.png': 'A', 'c-quote.png': '"C', 't.png': 'T', 'i.png': 'I', 'f.png': 'F', 'y-quote.png': '"Y', 'h-quote.png': '"H'}.get(short)
    alt = alts.get(short) or ('Decorated initial ' + initial)
    with Image.open(BytesIO(data)) as im:
        im.verify()
    with Image.open(BytesIO(data)) as im:
        width, height = im.size
        mime = Image.MIME[im.format]
    ident = short.replace('.', '-')
    assets.append(dict(id=ident, mime=mime, sha256=sha(data), width=width, height=height,
                       data=base64.b64encode(data).decode(), alt=alt))
    inventory.append(dict(id=ident, archivePath=name, url=BASE + name, sha256=sha(data),
                          bytes=len(data), width=width, height=height, mime=mime, alt=alt,
                          role='decorated initial' if initial else 'source illustration or binding image',
                          originalAlt=list(dict.fromkeys(doc.xpath('//img[@src="'+name+'"]/@alt'))),
                          rights='Part of PG 28885, catalogued public domain in the USA; other jurisdictions unassessed.',
                          attribution='Arthur Rackham illustration edition; source scans credited to University of Florida Digital Collections; digitization by Jana Srna, Emmy and the Online Distributed Proofreading Team.',
                          uses=[]))
asset_by_path = {x['archivePath']: x for x in inventory}
sections, mappings, page_map = [], [], {}
pending_pages = []
pending_initial = None
chapter_count = 0
front_poems = 0

def section(ident, title):
    sections.append(dict(id=ident, title=title, blocks=[]))

section('front', 'Cover and title pages')

def collapse(value):
    # HTML collapses ASCII formatting whitespace, not NBSP or source punctuation.
    return re.sub(r'[\t\r\n ]+', ' ', value)

def inline(el, verse=False):
    text, marks, notes, pages, links, styles = '', [], [], [], [], []
    line_indent, line_scale = 0, 1
    def emit(s):
        nonlocal text
        s = collapse(s)
        if not text or text.endswith((' ', '\n')):
            s = s.lstrip(' ')
        text += s
    def walk(e):
        nonlocal text, line_indent, line_scale
        if not isinstance(e.tag, str):
            return
        cls = e.get('class', '').split()
        if 'pagenum' in cls:
            label = ''.join(e.itertext()).strip('[] \n')
            pages.append(dict(offset=len(text), label=label))
            return
        if e.tag == 'br':
            text = text.rstrip(' ') + '\n'
            styles.append(dict(indent=line_indent, scale=line_scale))
            line_indent, line_scale = 0, 1
            return
        assert e.tag not in ('script', 'iframe', 'object', 'img'), 'Unhandled active/visual inline content'
        indent = re.search(r'margin-left:\s*([.\d]+)em', e.get('style', ''))
        if indent:
            line_indent = float(indent.group(1))
        tale = next((c for c in cls if re.fullmatch(r'tale\d+', c)), None)
        if tale:
            line_scale = (100 - int(tale[4:])) / 100
        start = len(text)
        if e.text:
            emit(e.text)
        for c in e:
            walk(c)
            if c.tail:
                emit(c.tail)
        end = len(text)
        # Source inline trailing spaces belong outside emphasis ranges.
        while start < end and text[start] == ' ': start += 1
        while end > start and text[end-1] == ' ': end -= 1
        kind = {'i':'em', 'em':'em', 'b':'strong', 'strong':'strong', 'sup':'sup', 'sub':'sub'}.get(e.tag)
        if 'smcap' in cls: kind = 'smallcaps'
        if kind and end > start: marks.append(dict(kind=kind, start=start, end=end))
        if 'caption' in cls and end > start: marks.append(dict(kind='strong', start=start, end=end))
        if e.tag == 'ins' and end > start:
            notes.append(dict(start=start, end=end, text=e.get('title', 'Source correction')))
        if e.tag == 'a' and e.get('href') and end > start:
            links.append(dict(start=start, end=end, url=e.get('href')))
    walk(el)
    # Preserve every explicit BR, including outer gaps such as the three breaks
    # before the closing BUT paragraph. Only collapse ordinary HTML space.
    left = len(text) - len(text.lstrip(' '))
    right = len(text.rstrip(' '))
    text = text[left:right]
    for arr in (marks, notes, links):
        for m in arr:
            m['start'] = max(0, m['start']-left)
            m['end'] = min(len(text), m['end']-left)
        arr[:] = [m for m in arr if m['end'] > m['start']]
    for p in pages: p['offset'] = min(len(text), max(0, p['offset']-left))
    result = dict(text=text, marks=marks)
    if notes: result['sourceNotes'] = notes
    if pages: result['pages'] = pages
    if links: result['links'] = links
    if verse:
        # BR layout per source line, including the unscaled "nothing" line and
        # repeated tale21 class. Do not silently regularize source anomalies.
        original = styles + [dict(indent=line_indent, scale=line_scale)]
        line_count = len(text.split('\n'))
        result['lines'] = original[:line_count]
        assert len(result['lines']) == line_count
        result['layout'] = 'fixed' if any(x['scale'] != 1 for x in result['lines']) else 'reflow'
    return result

def add(kind, data, node=None, **extra):
    current = sections[-1]
    ident = f"{current['id']}-b{len(current['blocks'])+1:03}"
    b = dict(id=ident, kind=kind, text=data.pop('text', ''), after='\n\n', marks=data.pop('marks', []), **data, **extra)
    if pending_pages:
        b['pages'] = [dict(offset=0, label=p) for p in pending_pages] + b.get('pages', [])
        pending_pages.clear()
    for p in b.get('pages', []): page_map[p['label']] = dict(section=current['id'], block=ident, offset=p['offset'])
    current['blocks'].append(b)
    mappings.append(dict(section=current['id'], block=ident, sourceLine=node.sourceline if node is not None else None,
                         kind=kind, chars=len(b['text']), textSha256=sha(b['text'].encode()),
                         sourceNotes=len(b.get('sourceNotes', []))))
    for field in ('figure', 'initial'):
        if field in b:
            next(a for a in inventory if a['id'] == b[field]['asset'])['uses'].append(dict(section=current['id'], block=ident, role=field))
    return b

def figure(img):
    info = asset_by_path[img.get('src')]
    return add('figure', {}, img, figure=dict(asset=info['id']))

def table(el):
    # Only the source's simple contents/list-of-plates/comparison tables enter
    # here. Plate-caption/image and rabbit-hole layout tables are handled below.
    rows = el.xpath('./tbody/tr | ./tr')
    for row in rows:
        combined = dict(text='', marks=[])
        for i, cell in enumerate(row.xpath('./td | ./th')):
            d = inline(cell)
            if i: combined['text'] += '\t'
            offset = len(combined['text'])
            combined['text'] += d['text']
            for key in ('marks', 'sourceNotes', 'pages', 'links'):
                for item in d.get(key, []):
                    item = item.copy()
                    for k in ('start', 'end', 'offset'):
                        if k in item: item[k] += offset
                    combined.setdefault(key, []).append(item)
        add('prose', combined, row, layout='fixed')

def visit(el):
    global pending_initial, chapter_count, front_poems
    if not isinstance(el.tag, str): return
    cls = el.get('class', '').split()
    if el.tag in ('header', 'footer') and 'pg-boilerplate' in cls: return
    if el.tag == 'pre' and not ''.join(el.itertext()).strip(): return
    if el.tag == 'hr':
        if sections[-1]['blocks']: add('rule', {}, el)
        return
    if 'chapter' in cls:
        chapter_count += 1
        nxt = el.getnext()
        assert nxt is not None and 'sidenote' in nxt.get('class', '')
        title = collapse(''.join(nxt.itertext())).strip()
        section(f'chapter-{chapter_count:02}', f'{collapse(el.text_content()).strip()} · {title}')
        add('heading', inline(el), el)
        return
    if 'poem' in cls or 'poem2' in cls:
        if chapter_count == 0:
            front_poems += 1
            section('proem' if front_poems == 1 else 'golden-afternoon', 'Proem · Austin Dobson' if front_poems == 1 else 'All in the golden afternoon')
        add('verse', inline(el, True), el)
        return
    if el.tag == 'h2' and el.text_content() in ('CONTENTS', 'LIST OF THE PLATES'):
        section('contents' if el.text_content() == 'CONTENTS' else 'plates', el.text_content().title())
    if 'copyright' in cls and chapter_count == 12:
        section('colophon', 'Printing and transcriber’s note')
    if 'figleft' in cls and el.xpath('.//img') and len(el.xpath('.//img')) == 1:
        img = el.xpath('.//img')[0]
        if Path(img.get('src')).name in ('a.png', 'c-quote.png', 't.png', 'i.png', 'f.png', 'y-quote.png', 'h-quote.png'):
            assert pending_initial is None
            pending_initial = dict(asset=asset_by_path[img.get('src')]['id'], characters=img.get('alt'))
            return
    if 'unindent' in cls and pending_initial:
        d = inline(el)
        prefix = pending_initial['characters']
        # Chapter VIII separates its decorated A from LARGE with NBSPs; retain
        # those meaningful characters rather than changing this to "ALARGE".
        d['text'] = prefix + d['text']
        for key in ('marks', 'sourceNotes', 'links', 'pages'):
            for m in d.get(key, []):
                for k in ('start', 'end', 'offset'):
                    if k in m: m[k] += len(prefix)
        add('prose', d, el, initial=pending_initial)
        pending_initial = None
        return
    if 'center' in cls and not el.xpath('.//table | .//img | .//p'):
        add('verse', inline(el, True), el); return
    if el.tag == 'img': figure(el); return
    if el.tag == 'table':
        if 'rabbithole' in cls:
            for p in el.xpath('.//p'): visit(p)
            fake = html.Element('img', src='images/p0003-rabbithole.png')
            figure(fake)
            return
        if not el.xpath('.//img'):
            table(el); return
    if el.tag in ('p', 'h1', 'h2', 'h3', 'h4') or any(c in cls for c in ('sidenote', 'unindent', 'sig', 'copyright')):
        d = inline(el)
        if not d['text']:
            pending_pages.extend(p['label'] for p in d.get('pages', []))
            return
        add('heading' if el.tag.startswith('h') or 'sidenote' in cls else 'prose', d, el)
        return
    if el.tag in ('td', 'th') and not el.xpath('.//img | .//table'):
        d = inline(el)
        if d['text']: add('prose', d, el)
        return
    if el.tag == 'span' and any(c in cls for c in ('caption', 'smcap')):
        add('prose', inline(el), el); return
    assert el.tag in ('div', 'table', 'tbody', 'tr', 'td', 'th', 'span', 'a', 'br'), f'Unhandled block {el.tag}'
    assert not (el.text or '').strip(), f'Unhandled direct text in {el.tag}: {el.text}'
    for child in el:
        visit(child)
        assert not (child.tail or '').strip(), f'Unhandled tail in {el.tag}: {child.tail}'

for child in body: visit(child)
assert chapter_count == 12 and pending_initial is None

# Keep the PG notice and licence complete, in a secondary end section, together
# with attribution. Not part of Carroll's narrative or a replacement workflow.
section('source-notice', 'Project Gutenberg notice and licence')
def terms(el):
    if not isinstance(el.tag, str): return
    if el.tag in ('p', 'h2', 'li') or (el.tag in ('div', 'pre') and not any(c.tag in ('div', 'p', 'h2', 'ul') for c in el)):
        d = inline(el)
        if d['text']: add('heading' if el.tag == 'h2' else 'note', d, el)
    else:
        assert not (el.text or '').strip()
        for c in el:
            terms(c)
            assert not (c.tail or '').strip()
for el in body.xpath('./header | ./footer'): terms(el)

book = dict(schema=1, id='alice-rackham-28885', title="Alice’s Adventures in Wonderland", author='Lewis Carroll',
            edition='Arthur Rackham illustrations · Austin Dobson proem · Project Gutenberg 28885, updated 5 January 2021. Undated Heinemann / Doubleday, Page printing in the source.',
            language='en', source=dict(sha256=PIN, format='application/zip', description='Reviewed local adaptation of the complete PG 28885 HTML archive; accessed 16 October 2026. Original image bytes retained. HTML formatting whitespace collapsed; verse lineation, source corrections and source page markers retained. See edition receipt.'),
            assets=assets, sections=sections, context=[
                dict(label='This illustrated edition',kind='source',through=None,url='https://www.gutenberg.org/ebooks/28885',text='Lewis Carroll’s text, with Arthur Rackham’s illustrations and a proem by Austin Dobson. Project Gutenberg credits Jana Srna, Emmy and the Online Distributed Proofreading Team, working from images supplied by the University of Florida Digital Collections. The title-page image names William Heinemann, London, and Doubleday, Page & Co., New York; it shows no date.'),
                dict(label='Source edition for an e-reader',kind='source',through=None,url='https://www.gutenberg.org/ebooks/28885.epub3.images',text='Download Project Gutenberg’s source-edition EPUB with illustrations for an e-reader. This is a separate source file, not an export from this reader. Web notes and reading position do not synchronize with it.'),
                dict(label='Source and reading choices',kind='editorial',through=None,text='The complete source sequence is retained, including front matter, verse, plates and transcriber notes. Images may be opened for a closer look. The mouse’s tail follows the source HTML’s indentation and shrinking type; Uniform type keeps its words and line breaks at your chosen size. The rabbit-hole background drawing is placed after its two associated paragraphs for legibility. Transcriber corrections are underlined and open their source explanations. These are reading adaptations, not a facsimile or a newly proofread print edition.'),
                dict(label='Rights and source terms',kind='source',through=None,url='https://www.gutenberg.org/policy/license.html',text='The catalogue marks this eBook public domain in the USA. Rights in other jurisdictions have not been cleared by this project. Project Gutenberg is a registered trademark; its notice, credits and full licence are retained in the final section. This reader is an independent, free local adaptation. No publication destination has yet been approved.'),
            ])
for s in sections:
    for b in s['blocks']:
        for link in b.get('links', []):
            url = link['url']
            if url.startswith('#Page_'):
                target = page_map[url[6:]]
                link['url'] = f"#read/{book['id']}/{target['section']}"
            elif url == '#front': link['url'] = f"#read/{book['id']}/front"
            elif url.startswith('/'):
                link['url'] = 'https://www.gutenberg.org/ebooks/28885'
            elif url.startswith('http:'): link['url'] = 'https:' + url[5:]
            assert link['url'].startswith(('https://', '#read/')), url

assert all(a['uses'] for a in inventory), 'Every original image must be used'
assert len(inventory) == 38
out = ROOT / 'edition'
out.mkdir(exist_ok=True)
encoded = (json.dumps([book], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
(out / 'library.json').write_bytes(encoded)
receipt = dict(schema=1, source=dict(url=BASE+'pg28885-h.zip', accessed='2026-10-16', sha256=PIN, bytes=len(raw), htmlSha256=sha(source_html)),
               librarySha256=sha(encoded), images=inventory,
               counts=dict(sections=len(sections), chapters=chapter_count, blocks=sum(len(s['blocks']) for s in sections),
                           imageAssets=len(assets), imageUses=sum(len(a['uses']) for a in inventory),
                           transcriberNotes=sum(len(b.get('sourceNotes', [])) for s in sections for b in s['blocks']),
                           sourcePageMarkers=len(page_map), verseBlocks=sum(b['kind']=='verse' for s in sections for b in s['blocks'])))
(out / 'assets.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
(ROOT / '.reader/reports/element-mapping.json').write_text(json.dumps(dict(blocks=mappings, pages=page_map), ensure_ascii=False, indent=2)+'\n')
print(json.dumps(receipt['counts']))
print('Candidate library SHA-256:', receipt['librarySha256'])
