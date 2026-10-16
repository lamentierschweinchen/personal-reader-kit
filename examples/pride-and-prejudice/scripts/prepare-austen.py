"""Source-specific, fail-closed adapter for the inspected Gutenberg 1342 HTML ZIP.

Needs Python, lxml and Pillow. Inputs stay ignored. No network or active HTML output.
The prepared contract and unchanged images are reviewed separately before staging.
"""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from hashlib import sha256
from collections import Counter
from io import BytesIO
import json, re, stat
from lxml import html
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / '.reader/private/source/pg1342-h.zip'
EXPECTED = '932b4622c5bd15df8c1559ff8426991cb3f1632b8d3629f712c64bdd38129939'
OUT = ROOT / 'edition'
REPORT = ROOT / '.reader/reports'
digest = lambda b: sha256(b).hexdigest()
assert digest(RAW.read_bytes()) == EXPECTED, 'Changed source: inspect it before adapting.'
OUT.mkdir(exist_ok=True)
REPORT.mkdir(exist_ok=True)

with ZipFile(RAW) as archive:
    entries = archive.infolist()
    assert len(entries) <= 2048 and sum(i.file_size for i in entries) <= 64*1024*1024
    assert len({i.filename for i in entries}) == len(entries)
    for item in entries:
        p = PurePosixPath(item.filename)
        assert not p.is_absolute() and '..' not in p.parts and '\\' not in item.filename
        assert not stat.S_ISLNK(item.external_attr >> 16) and not item.flag_bits & 1
        assert item.file_size <= 8*1024*1024 and item.file_size/max(1,item.compress_size) < 150
    raw = archive.read('pg1342-images.html')
    assert b'<!ENTITY' not in raw and b'<script' not in raw.lower()
    tree = html.fromstring(raw)
    body = tree.find('body')
    image_nodes = body.xpath('.//img')
    image_paths = {i.get('src') for i in image_nodes}
    assert image_paths == {i.filename for i in entries if i.filename != 'pg1342-images.html'}
    media = {}
    assets = []
    for source in sorted(image_paths):
        data = archive.read(source)
        with Image.open(BytesIO(data)) as im:
            width, height = im.size
            assert im.format in ('JPEG', 'PNG')
            im.verify()
        name = 'austen-' + PurePosixPath(source).name
        (OUT / name).write_bytes(data)
        media[source] = dict(src='/'+name, sha256=digest(data), width=width, height=height)
        assets.append(dict(path='edition/'+name, output=name, sourceMember=source,
                           sha256=digest(data), bytes=len(data), width=width, height=height,
                           rights='Gutenberg 1342: public domain in the USA; no worldwide clearance',
                           attribution='Hugh Thomson / George Allen, 1894 illustrated edition'))

allowed_tags = {'body','header','footer','h1','h2','h3','p','div','span','i','strong','small','sup','br','a','img','hr','table','tbody','tr','td','blockquote','ul','li'}
assert set(e.tag for e in body.iter()) <= allowed_tags
sections = []
targets = {}
all_links = []
consumed = set()
mapping = []
image_uses = []
serial = 0

def section(key, title):
    sections.append(dict(id=key, title=title, blocks=[]))

section('edition-notice', 'Source notice & credits')

def norm(s):
    return re.sub(r'[\t\r\n\f ]+', ' ', s or '')

def slot(el, name):
    consumed.add((tree.getroottree().getpath(el), name))
    return getattr(el, name) or ''

def make_block(el, inherited=()):
    global serial
    serial += 1
    block = dict(id=f'b{serial:04d}', kind='heading' if el.tag in ('h1','h2','h3') else 'prose', text='', after='\n\n', marks=[])
    text = ''
    ranges = []
    local_targets = []
    figures = []
    initial = None
    links = []
    classes = set(el.get('class','').split())
    ancestors = list(el.iterancestors())
    styles = []
    if classes & {'c','cbig250','fint'} or el.tag in ('h1','h2','h3'): styles.append('center')
    if classes & {'r','rt','rtb'}: styles.append('right')
    if any('blockquot' in a.get('class','').split() or a.tag=='blockquote' for a in ancestors): styles.append('letter')
    if any('caption' in a.get('class','').split() for a in ancestors): styles.append('caption')
    if el.tag=='td': styles.append('table-cell')
    if el.tag=='td':
        row=el.getparent()
        table=next(a for a in ancestors if a.tag=='table')
        block['table']=dict(group='title-page' if table.get('style') else 'illustration-index',row=list(table.xpath('.//tr')).index(row),column=list(row).index(el),span=int(el.get('colspan','1')))

    def walk(n, active=()):
        nonlocal text, initial
        if n.get('id'): local_targets.append((n.get('id'), len(text)))
        cls = set(n.get('class','').split())
        marks = list(active)
        if n.tag=='i' or 'font-style:italic' in n.get('style',''): marks.append('em')
        if n.tag=='strong': marks.append('strong')
        if n.tag=='sup': marks.append('sup')
        if 'smcap' in cls: marks.append('smallcaps')
        if 'pagenum' in cls: marks.append('page')
        if 'lftspc' in cls: marks.append('spaced')
        begin = len(text)
        if n.tag=='br': text = text.rstrip(' ')+'\n'
        elif n.tag=='img':
            info = dict(media[n.get('src')], alt=n.get('alt',''))
            image_uses.append(n.get('src'))
            if 'letra' in n.getparent().get('class','').split():
                alt = n.get('alt','')
                assert len(alt) <= 2
                start = len(text)
                text += alt
                initial = dict(info, start=start, end=start+len(alt))
            else:
                figures.append(dict(info, at=len(text)))
        else:
            text += norm(slot(n,'text'))
            for child in n:
                walk(child, tuple(marks))
                text += norm(slot(child,'tail'))
        end = len(text)
        for mark in set(marks)-set(active):
            if end>begin: ranges.append(dict(kind=mark,start=begin,end=end))
        if n.tag=='a' and n.get('href') and end>begin:
            links.append(dict(start=begin,end=end, href=n.get('href')))

    walk(el,inherited)
    # HTML source line wrapping is ordinary collapsible whitespace. Keep explicit
    # br, NBSP, punctuation and Unicode. Map offsets through collapsed spaces.
    output = ''
    old_to_new = [0]
    for char in text:
        if char==' ' and (not output or output.endswith((' ','\n'))): pass
        else: output += char
        old_to_new.append(len(output))
    output = output.strip(' \n')
    # Blocks may begin with explicit br; record stripping only decorative edge
    # breaks. Interior br counts remain exact.
    collapsed = ''
    for c in text:
        if c==' ' and (not collapsed or collapsed.endswith((' ','\n'))): continue
        collapsed += c
    leading = len(collapsed)-len(collapsed.lstrip(' \n'))
    remap = lambda x: max(0,min(len(output),old_to_new[x]-leading))
    block['text'] = output
    for m in ranges:
        a,b=remap(m['start']),remap(m['end'])
        if b>a: block['marks'].append(dict(kind=m['kind'],start=a,end=b))
    if 'em' in inherited and output: block['marks'].append(dict(kind='em',start=0,end=len(output)))
    if styles: block['styles']=styles
    if initial:
        initial['start'],initial['end']=remap(initial['start']),remap(initial['end'])
        if initial['end']==initial['start']:
            # Chapter XXXVI has blank alt but already spells ELIZABETH in text.
            assert initial['src']=='/austen-i_282_b.png' and output.startswith('ELIZABETH')
            initial['end']=1
        block['initial']=initial
    if figures:
        for figure in figures: figure['at']=remap(figure['at'])
        block['figures']=figures
    for link in links:
        link['start'],link['end']=remap(link['start']),remap(link['end'])
    links=[link for link in links if link['end']>link['start']]
    if links: block['links']=links; all_links.extend(links)
    if output or figures or initial:
        sections[-1]['blocks'].append(block)
        mapping.append(dict(section=sections[-1]['id'],block=block['id'],xpath=tree.getroottree().getpath(el),sourceLine=el.sourceline))
        for key,at in local_targets: targets[key]=dict(section=sections[-1]['id'],block=block['id'],offset=remap(at))
    return block

def visit(el, inherited=()):
    # Section order follows the source; source contents and index stay intact.
    if el.tag=='header': pass
    elif el.tag=='footer': section('license','Project Gutenberg license')
    elif el.tag=='h2':
        ids = el.xpath('.//a/@id')
        if 'PREFACE' in ids: section('preface','Preface · George Saintsbury (spoilers)')
        elif 'LIST_OF_ILLUSTRATIONS' in ids: section('illustrations','List of illustrations (spoilers)')
        elif any(x.lower().startswith('chapter_') for x in ids):
            number = len([s for s in sections if s['id'].startswith('chapter-')])+1
            section(f'chapter-{number}',f'Chapter {number}')
    if el.tag=='div' and 'blk' in el.get('class','').split() and len(sections)==1:
        section('front-matter','Cover, title & dedication (includes frontispiece)')
    inline_tags={'span','i','strong','small','sup','br','a','img'}
    if el.tag in {'p','h1','h2','h3','td','li'} or all(c.tag in inline_tags for c in el):
        make_block(el,inherited)
        return
    assert not (el.text or '').strip(), f'Unmapped container text at {el.sourceline}'
    consumed.add((tree.getroottree().getpath(el),'text'))
    if el.get('id'):
        targets[el.get('id')]=dict(section=sections[-1]['id'],block=None,offset=0)
    if 'font-style:italic' in el.get('style',''): inherited=(*inherited,'em')
    for child in el:
        visit(child,inherited)
        assert not (child.tail or '').strip(), f'Unmapped tail at {child.sourceline}'
        consumed.add((tree.getroottree().getpath(child),'tail'))

visit(body)
assert len([s for s in sections if s['id'].startswith('chapter-')])==61
assert len(image_uses)==164 and set(image_uses)==image_paths
unmapped=[]
for el in body.iter():
    for name in ('text','tail'):
        if (getattr(el,name) or '').strip() and (tree.getroottree().getpath(el),name) not in consumed:
            unmapped.append((el.sourceline,name))
assert not unmapped, unmapped
for target in targets.values():
    if target['block'] is None: target['block']=next(s for s in sections if s['id']==target['section'])['blocks'][0]['id']
for link in all_links:
    href=link.pop('href')
    if href.startswith('#'):
        assert href[1:] in targets, href
        link.update(targets[href[1:]])
    elif href.startswith('https://'): link['url']=href
    elif href.startswith('images/'):
        link['url']=media[href]['src']
    else: raise ValueError('Unsupported source link: '+href)
assert all(s['blocks'] for s in sections)
# An independent whole-body traversal checks character order, not just coverage.
def logical_source(el):
    out=el.text or ''
    for c in el:
        if c.tag=='img' and 'letra' in c.getparent().get('class','').split(): out+=c.get('alt','')
        else: out+=logical_source(c)
        out+=c.tail or ''
    return out
strip_layout=lambda text: re.sub(r'[\t\r\n\f ]','',text)
source_characters=strip_layout(logical_source(body))
prepared_characters=strip_layout(''.join(b['text'] for s in sections for b in s['blocks']))
assert source_characters==prepared_characters, 'Source character sequence changed.'
assert all(ord(c)<=0xffff for c in prepared_characters), 'Add UTF-16 offset conversion before handling astral source characters.'
book=dict(schema=1,id='austen-pride-1894',title='Pride and Prejudice',author='Jane Austen',
          edition='Illustrated 1894 edition · Hugh Thomson · preface by George Saintsbury. Gutenberg 1342, updated 29 September 2026.',language='en',
          source=dict(sha256=EXPECTED,format='text/html; austen-adapter-v1',description='From the complete Gutenberg 1342 HTML archive. All 164 source images retained byte-for-byte. HTML whitespace reflowed; explicit line breaks, page markers, small capitals and emphasis retained. Source image initials supply selectable letters. No claim of worldwide clearance or full proofreading.'),
          sections=sections,context=[
              dict(label='This illustrated edition',text='The title page credits George Saintsbury for the preface and Hugh Thomson for the illustrations, with George Allen, London, as publisher. The illustration copyright notices give 1894. This reader follows Gutenberg’s digital edition, not a claim of an exact print facsimile.',kind='source',through=None,url='https://www.gutenberg.org/ebooks/1342'),
              dict(label='Before the story',text='Saintsbury’s preface and the illustration index discuss later events. They remain in their source position and open only after a visible warning. Start with Chapter 1 if you want to meet the story first.',kind='editorial',through=None),
              dict(label='Source edition EPUB for an e-reader',text='Open the source catalogue and choose “EPUB3” with images. This is Gutenberg’s source-edition download. This web reader does not export EPUB or synchronize notes with an e-reader.',kind='source',through=None,url='https://www.gutenberg.org/ebooks/1342'),
              dict(label='Rights & source credits',text='The source declares public domain in the USA. Other jurisdictions are not cleared by this receipt. Gutenberg credits Chuck Greif and the Online Distributed Proofreading Team, from images available at the Internet Archive. Its full notice and license travel with this edition; this independent example is free and is not endorsed by Gutenberg.',kind='source',through=None,url='https://www.gutenberg.org/policy/permission.html')])
library=(json.dumps([book],ensure_ascii=False,indent=2)+'\n').encode()
(OUT/'library.json').write_bytes(library)
assets.insert(0,dict(path='edition/library.json',output='library.json',sha256=digest(library),bytes=len(library),sourceMember='pg1342-images.html',rights='Reformatted complete Gutenberg 1342; full license retained',attribution='Jane Austen; George Saintsbury; Hugh Thomson; Gutenberg production credits retained'))
inventory=dict(schema=1,accessed='2026-10-16',source='https://www.gutenberg.org/ebooks/1342',rawSha256=EXPECTED,sourceHtmlSha256=digest(raw),assets=assets)
(OUT/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
receipt=dict(sourceSha256=EXPECTED,htmlSha256=digest(raw),sections=len(sections),chapters=61,blocks=serial,images=len(image_uses),initials=60,links=len(all_links),textCharacters=sum(len(b['text']) for s in sections for b in s['blocks']),characterSequenceSha256=digest(prepared_characters.encode()),characterAgreement=True,emphasisMarks=dict(Counter(m['kind'] for s in sections for b in s['blocks'] for m in b['marks'])),unmappedTextNodes=unmapped,proofread=False,method='Every non-whitespace body text/tail node consumed; HTML ASCII whitespace collapsed, br retained inside blocks, decorative edge breaks trimmed; no Unicode normalization. Image alt initials included as selectable text. Independent source traversal matches every non-layout character in sequence. Rendered layout and difficult passages require separate QA.',mapping=mapping,targets=targets)
(REPORT/'austen-conversion.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ('mapping','targets')},indent=2))
