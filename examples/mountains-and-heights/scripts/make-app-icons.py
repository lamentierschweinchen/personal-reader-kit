"""Rasterize this reader's original M monogram; no book/image input."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
# Same angular M as site/icon.svg. The solid square lets the OS apply its mask.
points = [(37,148),(37,46),(53,46),(96,115),(139,46),(155,46),
          (155,148),(138,148),(138,78),(96,144),(54,78),(54,148)]
for name, size in [('apple-touch-icon.png',180),('icon-192.png',192),('icon-512.png',512)]:
    scale = size * 4 / 192
    canvas = Image.new('RGB', (size * 4, size * 4), '#263d36')
    ImageDraw.Draw(canvas).polygon([(round(x*scale),round(y*scale)) for x,y in points],fill='#f2efe6')
    canvas.resize((size,size),Image.Resampling.LANCZOS).save(root/'site'/name,optimize=True)
