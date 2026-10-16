"""Bounded, local EPUB inspection. Called by import-epub.mjs; no extraction/network.

Only unstyled, text-only XHTML with explicit paragraphs, headings, preformatted
verse, br and em/strong/sup/sub is supported. A candidate still needs proofreading.
"""
import hashlib
import io
import json
import posixpath
import re
import stat
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter

MAX_ARCHIVE = 64 * 1024 * 1024
MAX_MEMBER = 8 * 1024 * 1024
XHTML = "http://www.w3.org/1999/xhtml"
OPF = "http://www.idpf.org/2007/opf"
DC = "http://purl.org/dc/elements/1.1/"
CONTAINER = "urn:oasis:names:tc:opendocument:xmlns:container"
EPUB = "http://www.idpf.org/2007/ops"
XML = "http://www.w3.org/XML/1998/namespace"


class Unsupported(Exception):
    def __init__(self, code, detail):
        self.code, self.detail = code, detail
        super().__init__(detail)


def require(condition, code, detail):
    if not condition:
        raise Unsupported(code, detail)


def safe_path(name):
    require(isinstance(name, str) and name and "\\" not in name and "\x00" not in name
            and not name.startswith("/") and not re.match(r"^[A-Za-z]:", name)
            and all(p not in ("", ".", "..") for p in name.rstrip("/").split("/")),
            "unsafe-path", "Unsafe or ambiguous archive path.")
    return name


def referenced(base, href):
    parsed = urllib.parse.urlsplit(href)
    require(not (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment),
            "external-reference", "Manifest/package references must be local archive paths without queries or fragments.")
    decoded = urllib.parse.unquote(parsed.path, errors="strict")
    safe_path(decoded)  # Parent traversal is outside this initial adapter, even inside the archive.
    return safe_path(posixpath.join(posixpath.dirname(base), decoded))


def parse_xml(data):
    # Reject every declaration/DTD before parsing, including UTF-16/32 encodings.
    # EPUB XML is Unicode; the narrow adapter accepts UTF-8 only to keep this check explicit.
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise Unsupported("xml-encoding", "This adapter requires UTF-8 XML; preserve and inspect other encodings separately.")
    require("\x00" not in text and not re.search(r"<!\s*(?:DOCTYPE|ENTITY)", text, re.I),
            "xml-declaration", "DTDs/entities require separate review; no entity resolution is attempted.")
    declaration = re.match(r"\s*<\?xml[^?]*encoding\s*=\s*['\"]([^'\"]+)", text, re.I)
    require(not declaration or declaration.group(1).lower().replace("-", "") == "utf8",
            "xml-encoding", "The XML encoding declaration must agree with UTF-8.")
    return ET.fromstring(text)


def utf16(value):
    return len(value.encode("utf-16-le")) // 2


def content_blocks(body, section_index):
    blocks = []
    containers = {"body", "section", "article", "div"}
    block_tags = {"p", "pre", "h1", "h2", "h3", "h4", "h5", "h6"}
    inline = {"em", "strong", "sup", "sub", "span", "br"}
    # Unknown structural/semantic attributes can carry layout or source-note behavior.
    allowed_attributes = {"id"}

    def tag(element):
        require(element.tag.startswith("{" + XHTML + "}"), "foreign-content", "Foreign-namespace content needs a renderer extension.")
        name = element.tag.split("}")[-1]
        require(name in containers | block_tags | inline, "block-structure", "Unsupported source element requires a renderer extension; no content was dropped.")
        require(set(element.attrib) <= allowed_attributes, "content-attributes", "CSS, links, directionality and semantic attributes need a reviewed adapter.")
        return name

    def block(element, name):
        pieces, marks = [], []

        def walk(node):
            current = tag(node)
            require(node is element or current in inline, "inline-structure", "Unsupported nested source structure; no content was flattened.")
            start = utf16("".join(pieces))
            if current == "br":
                require(not len(node) and not (node.text or ""), "line-break", "Invalid line-break content.")
                pieces.append("\n")
            else:
                pieces.append(node.text or "")
                for child in node:
                    walk(child)
                    pieces.append(child.tail or "")
            end = utf16("".join(pieces))
            if current in {"em", "strong", "sup", "sub"} and end > start:
                marks.append({"kind": current, "start": start, "end": end})

        walk(element)
        text = "".join(pieces)
        # XHTML normally collapses whitespace; guessing which spaces/line breaks
        # are meaningful would violate the reader's preservation contract.
        if name != "pre":
            for node in element.iter():
                for value in (node.text, node.tail if node is not element else None):
                    require(value is None or not re.search(r"[\n\r\t]| {2,}", value),
                            "ambiguous-whitespace", "Ordinary XHTML has wrapped or repeated whitespace. Review its rendered source before preparing exact text.")
        require(utf16(text) <= 200000, "block-limit", "A source block exceeds the reader limit; split it with an explicit fidelity review.")
        blocks.append({"id": f"s{section_index}-b{len(blocks)+1}", "kind": "verse" if name == "pre" else "heading" if name.startswith("h") else "prose",
                       "text": text, "after": "\n\n", "marks": marks,
                       **({"layout": "fixed"} if name == "pre" else {})})

    def visit(element):
        name = tag(element)
        if name in block_tags:
            block(element, name)
        else:
            require(name in containers, "block-structure", "Images, tables, lists, links, notes and other unsupported structures require a reviewed adapter.")
            require(not (element.text or "").strip(), "unwrapped-text", "Text outside explicit blocks needs a source-aware structural review.")
            for child in element:
                visit(child)
                require(not (child.tail or "").strip(), "unwrapped-text", "Text outside explicit blocks needs a source-aware structural review.")

    visit(body)
    require(blocks and any(b["text"] for b in blocks), "empty-section", "A spine section has no supported text; it was not silently omitted.")
    blocks[-1]["after"] = ""
    return blocks


def inspect_package(archive, package_path, metadata, manifest, spine, report):
    """Inventory safe local resources even when conversion will be refused.

    This is evidence for choosing an adapter, not a second conversion path. It
    never extracts files, follows links, executes content or relaxes ZIP/XML checks.
    """
    features, errors, documents = [], [], []
    names = set(archive.namelist())

    def feature(code, path, count=1, **detail):
        features.append({"code": code, "path": path, "count": count, **detail})

    for item in manifest:
        record = {"id": item.get("id", ""), "href": item.get("href", ""),
                  "type": item.get("media-type", ""), "properties": item.get("properties", "").split()}
        try:
            record["path"] = referenced(package_path, record["href"])
            record["present"] = record["path"] in names
            if not record["present"]:
                errors.append({"path": record["path"], "code": "manifest", "detail": "A listed resource is missing from the archive."})
        except (Unsupported, ValueError, UnicodeError) as error:
            errors.append({"path": package_path, "code": getattr(error, "code", "invalid-reference"),
                           "detail": "A manifest path could not be safely inspected."})
        for key in ("fallback", "media-overlay"):
            if item.get(key):
                record[key] = item.get(key)
        report["resources"].append(record)
        path = record.get("path", package_path)
        if set(record["properties"]) - {"nav"} or record.get("fallback") or record.get("media-overlay"):
            feature("manifest-feature", path, properties=record["properties"],
                    fallback=record.get("fallback"), mediaOverlay=record.get("media-overlay"))
        kind = record["type"]
        if kind == "text/css":
            feature("stylesheet-resource", path)
        elif kind.startswith("image/"):
            feature("image-resource", path)
        elif "font" in kind:
            feature("font-resource", path)
        elif kind.startswith(("audio/", "video/")):
            feature("media-resource", path)

    by_id = {r["id"]: r for r in report["resources"]}
    for index, ref in enumerate(spine):
        record = {"index": index, "idref": ref.get("idref", ""), "linear": ref.get("linear", "yes"),
                  "properties": ref.get("properties", "").split(), "path": by_id.get(ref.get("idref"), {}).get("path")}
        report["spine"].append(record)
        if record["linear"] != "yes" or record["properties"]:
            feature("nonlinear-spine", record["path"] or package_path)
    if spine.get("page-progression-direction") not in (None, "default"):
        feature("directionality", package_path)
    if any("rendition:" in (el.get("property", "") + (el.text or "")) or
           el.get("name") in ("fixed-layout", "original-resolution", "orientation-lock") for el in metadata):
        feature("specialized-rendition", package_path)

    ids = {r["idref"] for r in report["spine"]}
    for record in report["resources"]:
        record["coverage"] = ("spine-source; not yet converted" if record["id"] in ids else
                              "navigation-only; source navigation needs manual comparison" if
                              record["type"] == "application/x-dtbncx+xml" or record["properties"] == ["nav"] else
                              "requires adapter review")
        if not record.get("present") or record["type"] not in ("application/xhtml+xml", "image/svg+xml", "application/x-dtbncx+xml"):
            continue
        try:
            root = parse_xml(archive.read(record["path"]))
            elements = list(root.iter())
            tags = Counter(el.tag.rsplit("}", 1)[-1] for el in elements)
            documents.append({"path": record["path"], "elements": len(elements), "tags": dict(sorted(tags.items()))})
            for code, tag_names in {
                "images": ("img", "image"), "svg": ("svg",), "tables": ("table",),
                "links": ("a",), "preformatted-text": ("pre",), "scripts": ("script",),
                "embedded-styles": ("style",), "media": ("audio", "video", "object", "iframe")
            }.items():
                count = sum(tags[name] for name in tag_names)
                if count:
                    feature(code, record["path"], count)
            for code, predicate in {
                "styled-elements": lambda el: "style" in el.attrib or "class" in el.attrib,
                "source-note-semantics": lambda el: bool(set(el.get(f"{{{EPUB}}}type", "").split()) & {"noteref", "footnote", "endnote", "footnotes", "endnotes"}) or el.get("role") in {"doc-noteref", "doc-footnote", "doc-endnote"},
                "directional-elements": lambda el: "dir" in el.attrib,
            }.items():
                count = sum(bool(predicate(el)) for el in elements)
                if count:
                    feature(code, record["path"], count)
        except (Unsupported, ET.ParseError, UnicodeError, ValueError, KeyError, RuntimeError, RecursionError) as error:
            errors.append({"path": record["path"], "code": getattr(error, "code", "invalid-xml"),
                           "detail": "This resource could not be safely inspected; preserve it for local review."})
    report["inspection"] = {"packageInventoried": True, "xmlDocuments": documents, "errors": errors,
                            "safeXmlScanComplete": not errors,
                            "scope": "Manifest, spine and safe XML element/attribute counts. CSS semantics, image meaning, rendered layout and proofreading are not inspected."}
    report["features"] = features
    expected = {r["path"] for r in report["resources"] if r.get("path")} | {"mimetype", "META-INF/container.xml", package_path}
    report["unlistedResources"] = sorted(m.filename for m in archive.infolist() if not m.is_dir() and m.filename not in expected)


def prepare(data):
    digest = hashlib.sha256(data).hexdigest()
    report = {"format": "epub-preparation-report", "schema": 1, "sourceSha256": digest,
              "status": "needs-adapter", "candidate": False, "issues": [], "resources": [], "spine": [], "features": [],
              "inspection": {"packageInventoried": False, "safeXmlScanComplete": False, "xmlDocuments": [], "errors": []},
              "fidelity": {"proofread": False, "sourceBytesUnchanged": True,
                           "method": "UTF-8 XML logical text in spine order. XML normalizes CRLF. Structural blocks receive two newlines; container indentation is not literary text. Explicit br and pre whitespace are preserved; emphasis offsets use UTF-16.",
                           "reviewRequired": "Compare the candidate with the rendered EPUB: coverage, emphasis, verse geometry, source notes, language/glyphs and order. A successful preparation is not proofreading."}}
    try:
        require(len(data) <= MAX_ARCHIVE, "archive-limit", "Maximum EPUB size is 64 MB.")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            require(0 < len(members) <= 2048, "member-count", "Archive member count exceeds this adapter's limit.")
            require(sum(m.file_size for m in members) <= MAX_ARCHIVE, "expanded-limit", "Expanded archive exceeds 64 MB.")
            names = set()
            for member in members:
                safe_path(member.filename)
                key = member.filename.casefold()
                require(key not in names, "duplicate-member", "Duplicate or case-ambiguous archive names.")
                names.add(key)
                require(not stat.S_ISLNK(member.external_attr >> 16), "archive-symlink", "Archive symlinks are unsupported.")
                require(not member.flag_bits & 1, "encryption", "Encrypted ZIP entries are unsupported; no decryption is attempted.")
                require(member.file_size <= MAX_MEMBER and member.file_size <= max(1, member.compress_size) * 150,
                        "member-limit", "An archive member exceeds size/compression limits.")
            require("meta-inf/encryption.xml" not in names, "encryption", "EPUB declares encrypted or obfuscated resources. This adapter does not distinguish or bypass them; request an authorized usable source.")
            require(archive.read("mimetype") == b"application/epub+zip", "mimetype", "Missing or invalid EPUB media type.")
            container = parse_xml(archive.read("META-INF/container.xml"))
            roots = container.findall(f"{{{CONTAINER}}}rootfiles/{{{CONTAINER}}}rootfile")
            require(len(roots) == 1, "renditions", "Multiple or missing renditions require an explicit edition choice.")
            package_path = safe_path(roots[0].get("full-path", ""))
            package = parse_xml(archive.read(package_path))
            require(package.tag == f"{{{OPF}}}package" and package.get("version", "").split(".")[0] in ("2", "3"), "package", "Expected an EPUB 2 or 3 package.")
            metadata, manifest, spine = (package.find(f"{{{OPF}}}{name}") for name in ("metadata", "manifest", "spine"))
            require(metadata is not None and manifest is not None and spine is not None, "package", "Missing metadata, manifest or spine.")
            inspect_package(archive, package_path, metadata, manifest, spine, report)
            require(not any("rendition:" in (el.get("property", "") + (el.text or "")) or el.get("name") in ("fixed-layout", "original-resolution", "orientation-lock") for el in metadata), "rendition", "Fixed or specialized rendition metadata needs an adapter.")
            items, paths = {}, set()
            for item in manifest:
                require(item.tag == f"{{{OPF}}}item", "manifest", "Unexpected manifest element.")
                identifier, href = item.get("id", ""), item.get("href", "")
                require(identifier and identifier not in items, "manifest", "Missing or duplicate manifest ID.")
                resource = referenced(package_path, href)
                require(resource not in paths and resource in archive.namelist(), "manifest", "Missing or duplicated manifest resource.")
                paths.add(resource)
                properties = item.get("properties", "").split()
                require(not (set(properties) - {"nav"}) and not item.get("fallback") and not item.get("media-overlay"), "manifest-feature", "Fallbacks, media overlays or manifest properties require a reviewed adapter. Properties: " + (", ".join(properties) or "none") + ". See the full private resource/feature inventory.")
                record = {"id": identifier, "path": resource, "type": item.get("media-type", ""), "properties": properties}
                items[identifier] = record
            require(not spine.get("page-progression-direction") or spine.get("page-progression-direction") == "default", "directionality", "Explicit page progression needs device and layout review.")
            refs = list(spine)
            require(0 < len(refs) <= 2000 and all(r.tag == f"{{{OPF}}}itemref" for r in refs), "spine", "Unsupported spine.")
            ids = [r.get("idref") for r in refs]
            require(len(set(ids)) == len(ids) and all(i in items for i in ids), "spine", "Duplicate or missing spine references.")
            require(all(r.get("linear", "yes") == "yes" and not r.get("properties") for r in refs), "nonlinear-spine", "Nonlinear/specialized spine items need a reviewed order; none will be dropped.")
            for record in report["resources"]:
                if record["id"] in ids:
                    require(record["type"] == "application/xhtml+xml", "spine-media", "Non-XHTML spine content needs a renderer extension.")
                    record["coverage"] = "spine-text"
                elif record["type"] == "application/x-dtbncx+xml" or record["properties"] == ["nav"]:
                    record["coverage"] = "navigation-only; source navigation needs manual comparison"
                else:
                    record["coverage"] = "unsupported"
                    raise Unsupported("unsupported-resource", "Stylesheets, images, fonts and non-spine content require a reviewed adapter; no partial candidate is written.")
            expected = paths | {"mimetype", "META-INF/container.xml", package_path}
            require(all(m.is_dir() or m.filename in expected for m in members), "unlisted-resource", "Unlisted archive resources require inspection; none are assumed irrelevant.")
            sections = []
            for index, identifier in enumerate(ids, 1):
                record = items[identifier]
                html = parse_xml(archive.read(record["path"]))
                require(html.tag == f"{{{XHTML}}}html", "xhtml", "Expected namespaced XHTML.")
                require(all(el.tag in (f"{{{XHTML}}}head", f"{{{XHTML}}}body") for el in html)
                        and len(html.findall(f"{{{XHTML}}}body")) == 1 and len(html.findall(f"{{{XHTML}}}head")) <= 1
                        and not (html.text or "").strip() and all(not (el.tail or "").strip() for el in html),
                        "xhtml", "Unexpected or duplicate document content must not be omitted.")
                # Head CSS/scripts/links can change meaning even when body text looks simple.
                head, body = html.find(f"{{{XHTML}}}head"), html.find(f"{{{XHTML}}}body")
                require(all(html.get(key) in (None, "".join(metadata.find(f"{{{DC}}}language").itertext()) if metadata.find(f"{{{DC}}}language") is not None else None) for key in ("lang", f"{{{XML}}}lang")), "language-change", "Document language differs from the book; preserve it with a reviewed adapter.")
                require(body is not None and not any(k not in ("lang", f"{{{XML}}}lang") for k in html.attrib), "xhtml", "Unsupported document attributes or missing body.")
                if head is not None:
                    require(all(child.tag in (f"{{{XHTML}}}title", f"{{{XHTML}}}meta") and not len(child) for child in head), "head-content", "Styles, scripts and linked resources need a reviewed adapter.")
                    require(all(not child.get("http-equiv") for child in head), "head-content", "Active document metadata is unsupported.")
                blocks = content_blocks(body, index)
                title = next((b["text"] for b in blocks if b["kind"] == "heading" and b["text"]), f"Section {index}")
                require(len(title) <= 1000, "heading-limit", "Full heading exceeds the current navigation contract; do not shorten it silently.")
                sections.append({"id": f"s{index}", "title": title, "blocks": blocks})
                report["spine"][index-1].update(sectionId=f"s{index}", blocks=len(blocks), utf16Characters=sum(utf16(b["text"]) for b in blocks))
            if report["inspection"]["errors"]:
                first = report["inspection"]["errors"][0]
                raise Unsupported(first["code"], first["detail"])
            values = lambda name: ["".join(el.itertext()) for el in metadata.findall(f"{{{DC}}}{name}")]
            titles, languages, creators = values("title"), values("language"), values("creator")
            require(len(titles) == 1 and titles[0] and len(languages) == 1, "metadata-choice", "Choose one supplied title and language explicitly before conversion.")
            book = {"schema": 1, "id": "epub-" + digest[:24], "title": titles[0], "author": "; ".join(creators) or "Unknown",
                    "edition": "Provisional EPUB preparation; compare with the original before reading.", "language": languages[0],
                    "source": {"sha256": digest, "format": "application/epub+zip", "description": "Local bounded EPUB preparation v1. Explicit text blocks, UTF-16 emphasis and source order retained. Structural separators are editorial. Proofreading is required; no external upload."},
                    "sections": sections, "context": []}
            report.update(status="candidate-needs-proofreading", candidate=True)
            return {"report": report, "book": book}
    except (Unsupported, zipfile.BadZipFile, KeyError, ET.ParseError, UnicodeError, ValueError, RuntimeError, NotImplementedError, OSError, RecursionError) as error:
        report["issues"].append({"code": error.code if isinstance(error, Unsupported) else "invalid-container", "detail": error.detail if isinstance(error, Unsupported) else "The container/XML could not be safely read. Preserve the original and inspect it locally."})
        return {"report": report, "book": None}


if __name__ == "__main__":
    with open(sys.argv[1], "rb") as source:
        data = source.read(MAX_ARCHIVE + 1)
    print(json.dumps(prepare(data), ensure_ascii=False))
