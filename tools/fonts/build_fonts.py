"""
Builds the game's web fonts from the OFL originals (outside the game build; needs `pip install fonttools brotli`).

    python3 tools/fonts/build_fonts.py <folder with the originals>

The originals are the variable fonts from https://github.com/google/fonts (ofl/fredoka, ofl/plusjakartasans).
Each weight the game uses becomes a static WOFF2 cut down to Basic Latin and Latin-1 plus a few punctuation marks:
every letter Indonesian and English need. Fredoka's digits are made tabular (every digit as wide as the widest,
centred), so a running clock does not shift. Output: src/assets/fonts.
"""
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).resolve().parents[2] / 'src' / 'assets' / 'fonts'
# Basic Latin, Latin-1, en/em dash, quotes, bullet, ellipsis, minus, multiplication sign.
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2212]
CUTS = [
    # (source, output, axes, tabular digits)
    ('Fredoka[wdth,wght].ttf', 'nusa-display-600.woff2', {'wght': 600, 'wdth': 100}, True),
    ('PlusJakartaSans[wght].ttf', 'nusa-text-500.woff2', {'wght': 500}, False),
    ('PlusJakartaSans[wght].ttf', 'nusa-text-700.woff2', {'wght': 700}, False),
]


def tabular_digits(font: TTFont) -> None:
    """Gives the digits one advance width (the widest), shifting each outline to stay centred."""
    cmap = font.getBestCmap()
    names = [cmap[ord(c)] for c in '0123456789']
    hmtx = font['hmtx']
    glyf = font['glyf']
    width = max(hmtx[n][0] for n in names)
    for name in names:
        advance, lsb = hmtx[name]
        dx = (width - advance) // 2
        glyph = glyf[name]
        if glyph.isComposite():
            for component in glyph.components:
                component.x += dx
        elif glyph.numberOfContours > 0:
            glyph.coordinates.translate((dx, 0))
        glyph.recalcBounds(glyf)
        hmtx[name] = (width, lsb + dx)


def build(source_dir: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source, output, axes, tabular in CUTS:
        font = TTFont(source_dir / source)
        font = instantiateVariableFont(font, axes)
        if tabular:
            tabular_digits(font)
        options = Options()
        options.flavor = 'woff2'
        options.layout_features = ['kern', 'liga', 'ccmp', 'locl', 'mark', 'mkmk']
        options.name_IDs = ['*']
        options.notdef_outline = True
        subsetter = Subsetter(options)
        subsetter.populate(unicodes=UNICODES)
        subsetter.subset(font)
        font.flavor = 'woff2'
        font.save(OUT / output)
        print(f'{output}: {(OUT / output).stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    build(Path(sys.argv[1] if len(sys.argv) > 1 else '.'))
