# Build a tiny supplemental font with ə (U+0259) and Ə (U+018F) in Press Start 2P's 8x8 pixel style.
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset

src, out = sys.argv[1], sys.argv[2]
PX = 125
GLYPHS = {
    'uni0259': (0x0259, [   # schwa: Press Start 2P "e" rotated 180°
        '........',
        '........',
        '.#####..',
        '.....##.',
        '#######.',
        '##...##.',
        '.#####..',
        '........']),
    'uni018F': (0x018F, [   # capital schwa, matching O/E stroke weights
        '.#####..',
        '##...##.',
        '.....##.',
        '#######.',
        '##...##.',
        '##...##.',
        '.#####..',
        '........']),
}

f = TTFont(src)
glyf, hmtx = f['glyf'], f['hmtx']
order = f.getGlyphOrder()
for name, (cp, rows) in GLYPHS.items():
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        top = 1000 - r * PX
        c = 0
        while c < 8:                       # one rectangle per horizontal run of pixels
            if row[c] != '#':
                c += 1; continue
            start = c
            while c < 8 and row[c] == '#': c += 1
            x0, x1, y0, y1 = start * PX, c * PX, top - PX, top
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    glyf[name] = pen.glyph()
    hmtx[name] = (1000, 0)
    if name not in order: order.append(name)
    for t in f['cmap'].tables:
        if t.isUnicode(): t.cmap[cp] = name
f.setGlyphOrder(order)
f['maxp'].numGlyphs = len(order)

opts = subset.Options(); opts.flavor = 'woff2' if out.endswith('woff2') else 'woff'; opts.name_IDs = []
sub = subset.Subsetter(opts); sub.populate(unicodes=[0x0259, 0x018F]); sub.subset(f)
# Modified font must not use the Reserved Font Name "Press Start 2P" (OFL).
name = f['name']
name.names = []
for nid, val in [(1, 'Mafia Pixel AZ'), (2, 'Regular'), (4, 'Mafia Pixel AZ Regular'), (6, 'MafiaPixelAZ-Regular'),
                 (0, 'Glyphs derived from Press Start 2P, Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net).'),
                 (13, 'Licensed under the SIL Open Font License 1.1, https://openfontlicense.org')]:
    name.setName(val, nid, 3, 1, 0x409)
f.flavor = opts.flavor
f.save(out)
print('wrote', out)
