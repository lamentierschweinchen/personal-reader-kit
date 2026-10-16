"""Independent source coverage checks; requires retained original ZIP and lxml.
This is a coverage/typography receipt, not print-edition proofreading.
"""
from pathlib import Path
from zipfile import ZipFile
from collections import Counter
import base64, hashlib, json, re
from lxml import html
root=Path(__file__).resolve().parents[1]
digest=lambda b:hashlib.sha256(b).hexdigest()
with ZipFile(root/'.reader/private/pg28885-h.zip') as z:
    data=z.read('pg28885-images.html')
    source_images={n:z.read(n) for n in z.namelist() if n.startswith('images/')}
body=html.fromstring(data).find('body')
book=json.loads((root/'edition/library.json').read_text())[0]
blocks=[b for s in book['sections'] if s['id']!='source-notice' for b in s['blocks']]
initials=('a.png','c-quote.png','t.png','i.png','f.png','y-quote.png','h-quote.png')
def chars(e):
    if not isinstance(e.tag,str) or e.tag in ('header','footer') or 'pagenum' in e.get('class','').split():return ''
    if e.tag=='img':return e.get('alt','') if e.get('src','').split('/')[-1] in initials else ''
    return (e.text or '')+''.join(chars(c)+(c.tail or '') for c in e)
compact=lambda t:re.sub(r'\s','',t)
source=compact(chars(body));prepared=compact(''.join(b['text'] for b in blocks))
assert source==prepared, 'Literary character sequence differs'
source_terms=compact(''.join(''.join(e.itertext()) for e in body.xpath('./header | ./footer')))
prepared_terms=compact(''.join(b['text'] for s in book['sections'] if s['id']=='source-notice' for b in s['blocks']))
assert source_terms==prepared_terms,'Source header, credit or licence text differs'
# Independently reconstruct explicit verse breaks, including blank lines.
def verse(e):
    if not isinstance(e.tag,str) or 'pagenum' in e.get('class','').split():return ''
    if e.tag=='br':return '\x01'
    return (e.text or '')+''.join(verse(c)+(c.tail or '') for c in e)
poems=body.xpath('.//div[@class="poem" or @class="poem2"]')
poems += [e for e in body.xpath('.//div[@class="center"]') if not e.xpath('.//img | .//table | .//p')]
poems.sort(key=lambda e:e.sourceline)
verse_blocks=[b for b in blocks if b['kind']=='verse']
assert len(poems)==len(verse_blocks)==19
for e,b in zip(poems,verse_blocks):
    lines=[re.sub(r'[\t\r\n ]+',' ',t).strip(' ') for t in verse(e).split('\x01')]
    assert '\n'.join(lines)==b['text'],f"Verse lineation differs: {b['id']}"
    assert len(b['lines'])==len(lines)
notes=[(compact(e.text_content()),e.get('title')) for e in body.xpath('.//ins')]
adapted=[(compact(b['text'][n['start']:n['end']]),n['text']) for b in blocks for n in b.get('sourceNotes',[])]
assert notes==adapted and len(notes)==13
# Compare actual emphasis strings and multiplicity, including nested smallcaps.
source_marks=[]
for e in body.iter():
    if not isinstance(e.tag,str) or e.xpath('ancestor::header | ancestor::footer'):continue
    kind={'i':'em','b':'strong','em':'em','strong':'strong','sup':'sup','sub':'sub'}.get(e.tag)
    if 'smcap' in e.get('class','').split():kind='smallcaps'
    if kind and compact(chars(e)):source_marks.append((kind,compact(chars(e))))
    if 'caption' in e.get('class','').split():source_marks.append(('strong',compact(chars(e))))
prepared_marks=[(m['kind'],compact(b['text'][m['start']:m['end']])) for b in blocks for m in b['marks']]
assert Counter(source_marks)==Counter(prepared_marks),'Emphasis strings or multiplicity differ'
for a in book['assets']:
    raw=next(data for name,data in source_images.items() if Path(name).name.replace('.','-')==a['id'])
    assert base64.b64decode(a['data'])==raw and digest(raw)==a['sha256']
assert len(source_images)==len(book['assets'])==38
source_pages=[e.text_content().strip('[] \n') for e in body.xpath('.//span[@class="pagenum"]')]
prepared_pages=[p['label'] for b in blocks for p in b.get('pages',[])]
assert source_pages==prepared_pages
# This pinned edition contains BMP characters only, making Python offsets and
# JS UTF-16 offsets identical. A source with astral text needs an offset adapter.
assert all(ord(c)<=0xffff for b in blocks for c in b['text'])
final=next(b for b in blocks if 'BUT her sister sat still' in b['text'])
assert final['text'].startswith('\n\n\nBUT'), 'Closing thematic gap lost'
result=dict(passed=True,rawHtmlSha256=digest(data),literaryNonWhitespaceCharacters=len(source),
            characterSequenceAgreement=True,completeSourceNoticeAgreement=True,explicitVerseBlocks=len(poems),
            sourceNotes=len(notes),emphasisRanges=len(source_marks),unchangedImageAssets=len(source_images),
            sourcePageMarkers=len(source_pages),closingThreeBreakGap=True,utf16OffsetsVerified=True,
            limits='HTML formatting whitespace is collapsed and structural separators are explicit. This verifies the supplied digital edition, not its print/scanning accuracy. It is not whole-book human proofreading.')
(root/'.reader/reports/fidelity.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
