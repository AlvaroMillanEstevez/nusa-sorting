#!/usr/bin/env python3
"""
Prepares the game's illustrated art from the originals in art-source/pilot/ (generated with ChatGPT and reviewed
by Koke): an internal tool, run again whenever an original changes.

    python3 tools/art/build_game_art.py [--size 192]      (needs Pillow, numpy and scipy)

Writes src/assets/art/:
- items/<kind>.webp: every catalogue kind, cut from the latest sheet that draws it (see SHEETS), trimmed, centred
  and scaled into a square resting on the bottom margin, its soft shadow kept. Plain: the game adds the warm halo
  behind dark ones, the silhouettes of the layers behind and the colour variants itself (src/ui/art/itemPixels.ts).
- shelf.webp: the regenerated shelf (shelf-3-v2.png) with its width as drawn and its height fitted to the game's
  slots, so its three compartments fall on the three slots and it scales uniformly with the slot size.
- cubby.webp: one compartment of the same shelf between two posts, for fixed stacks.
- beam.webp, boards.webp, crate.webp, wall.webp: wood cut from the same shelf for the rest of the board (rails,
  plates, lock shutters, nailed planks, the roaming crate, conveyor beds).
- background-portrait.webp, background-landscape.webp: the backgrounds of levels without a theme; themes/<theme>-
  portrait.webp and -landscape.webp for the themes whose pictures are ready (the others keep their drawn ones).
- art.json: each kind's bounds in its 100-unit box (for the item fit), whether it needs the halo, its main hue
  (for the colour variants), and the shelf's and cubby's measures in slot units.
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art-source/pilot'
OUT = ROOT / 'src/assets/art'
# Objects are cut and measured at this size, then saved at --size.
WORK = 256
MARGIN = 10
WEBP = dict(quality=82, method=6)

# The sheets and their six objects, left to right and top to bottom, by catalogue id. Each kind keeps only its
# latest drawing: cells drawn again on a later sheet are skipped (None) here; the earlier drawings stay in the
# sheets and in git.
SHEETS = {
    'objects-sheet.png': ['sate', 'es-teh-manis', None, None, None, None],
    'objects-sheet-2.png': [None, 'ketupat', 'rambutan', 'nasi-goreng', 'kerupuk-udang', None],
    'objects-sheet-3.png': ['mie-goreng', None, 'gado-gado', None, None, None],
    'objects-sheet-4.png': ['tempe', None, None, 'dadar-gulung', 'es-cendol', None],
    'objects-sheet-5.png': ['jamu', 'durian', None, None, 'cabai', None],
    # The themes' objects. The 17 Agustus sheet's last cell drew bunting, which is not in the catalogue.
    'objects-budaya-jawa.png': ['blangkon', None, None, 'kendang', 'gong', 'caping'],
    'objects-17-agustus.png': ['bendera', None, 'kelereng', None, None, None],
    'objects-pasar-malam.png': ['lampion', 'arum-manis', 'balon', None, 'kembang-api', None],
    'objects-laut-nusantara.png': [None, 'kerang', 'bintang-laut', 'jaring', 'layangan', None],
    'objects-olahraga.png': ['kok', None, None, None, 'piala', 'peluit'],
    'objects-permainan-tradisional.png': ['gasing', None, None, None, None, 'lompat-tali'],
    'objects-rempah-maluku.png': [None, None, 'kayu-manis', 'lada', None, 'karung-rempah'],
    'objects-sawah.png': ['padi', None, 'orang-orangan', None, 'bakul', 'gubuk'],
    'objects-fauna-nusantara.png': [None, 'orangutan', 'rangkong', None, 'cendrawasih', 'tarsius'],
    # Correction sheets A-G (13 and 14 October).
    'objects-fix-a.png': [None, 'es-kelapa-muda', 'onde-onde', 'tahu-goreng', None, 'ayam-goreng'],
    'objects-fix-b.png': ['martabak-manis', 'ikan-bakar', 'rendang', 'bakso', 'manggis', 'salak'],
    'objects-fix-c.png': ['kipas', 'terompet', 'peci', 'wayang-kulit', 'batik', 'panjat-pinang'],
    'objects-fix-d.png': ['topeng', 'bianglala', 'pinisi', 'kelapa', None, 'sepak-takraw'],
    'objects-fix-e.png': ['yoyo', 'bekel', 'congklak', 'egrang', 'karung', 'sepatu'],
    'objects-fix-f.png': [None, 'pala', 'cobek', 'cangkul', 'kerbau', None],
    'objects-fix-g.png': ['pisang-goreng', 'klepon', 'cengkeh', 'raket', 'komodo', 'penyu'],
}

CATALOGUE = re.findall(r"\{ id: '([a-z0-9-]+)'", (ROOT / 'src/data/itemCatalog.ts').read_text())

# Only objects whose outline is darker than this (CIE L*, seen at about 48 px) get the warm halo in the game:
# lighter ones already stand out from the shelves' dark back wall.
HALO_BELOW = 45

# The game's shelf in slot units (see ui/boardLayout: TOP_PAD, slot aspect 1.2, PLANK): the drawn shelf keeps its
# width, its back wall is stretched to the slot's height and its top beam and front board brought to the game's
# (the beam sticks out a little above the shelf's box, into the gap between rows).
SHELF = {'beam': 0.14, 'slot': 1.2, 'plank': 0.18, 'overhangTop': 0.06}
UNIT = 280  # pixels per slot in the shelf picture (a slot shows at up to about 110 CSS px)
# Below this brightness is a compartment's back wall.
DARK_WALL = 75


def to_linear(c: np.ndarray) -> np.ndarray:
    c = c / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lightness(rgb: np.ndarray) -> np.ndarray:
    y = to_linear(rgb) @ np.array([0.2126, 0.7152, 0.0722])
    return np.where(y > 216 / 24389, 116 * np.cbrt(y) - 16, 24389 / 27 * y)


def save_webp(image: Image.Image, path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', **WEBP)
    return path.stat().st_size


def cut(file: str, names: list) -> dict:
    """The sheet's named objects, each in a WORK-px square resting on the bottom margin."""
    a = np.array(Image.open(SRC / file).convert('RGBA'))
    h, w = a.shape[:2]
    # A grid of three columns and two rows, one object per cell. An object is the solid parts (alpha > 200) whose
    # centre falls in its cell, grown a little; soft shadows can touch between cells, so they never tell objects
    # apart.
    core = a[..., 3] > 200
    labels, count = ndimage.label(core)
    sizes = ndimage.sum(core, labels, range(1, count + 1))
    centres = ndimage.center_of_mass(core, labels, range(1, count + 1))
    cells = [(row, col) for row in range(2) for col in range(3)]
    members = {cell: [] for cell in cells}
    for i, ((cy, cx), size) in enumerate(zip(centres, sizes)):
        if size >= 300:
            members[(min(1, int(cy * 2 / h)), min(2, int(cx * 3 / w)))].append(i + 1)
    others_all = np.isin(labels, [i for cell in cells for i in members[cell]])
    squares = {}
    for name, cell in zip(names, cells):
        if name is None:
            continue
        mine = np.isin(labels, members[cell])
        own = ndimage.binary_dilation(mine, iterations=8)
        ys, xs = np.nonzero(mine)
        others = ndimage.binary_dilation(others_all & ~mine, iterations=12)
        # The soft shadow (faint alpha) under and around the object belongs to it too, away from its neighbours.
        shadow_zone = np.zeros_like(own)
        shadow_zone[ys.min() : min(h, ys.max() + 41), max(0, xs.min() - 30) : xs.max() + 31] = True
        keep = (own | (shadow_zone & (a[..., 3] <= 200))) & ~others
        part = a.copy()
        part[..., 3] = np.where(keep, part[..., 3], 0)
        # Nearly opaque in the sheet: fully opaque here.
        part[..., 3] = np.where(part[..., 3] >= 240, 255, part[..., 3])
        image = Image.fromarray(part)
        image = image.crop(image.getbbox())
        room = WORK - 2 * MARGIN
        scale = min(room / image.width, room / image.height)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        square = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
        square.alpha_composite(image, ((WORK - image.width) // 2, WORK - MARGIN - image.height))
        squares[name] = square
    return squares


def edge_lightness(square: Image.Image) -> float:
    """Median CIE L* of an object's outline (its outer ring of pixels), seen at about 48 px."""
    a = np.array(square.resize((48, 48), Image.LANCZOS)).astype(float)
    body = a[..., 3] > 160
    ring = body & ~ndimage.binary_erosion(body, iterations=2)
    return float(np.median(lightness(a[..., :3])[ring]))


def rgb_to_hsv(rgb: np.ndarray) -> np.ndarray:
    """Hue (0-1), saturation and value of an array of RGB colours in 0-1."""
    mx, mn = rgb.max(axis=1), rgb.min(axis=1)
    d = mx - mn
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    safe = np.where(d == 0, 1, d)
    h = np.where(mx == r, ((g - b) / safe) % 6, np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4)) / 6
    h = np.where(d == 0, 0, h)
    s = np.where(mx == 0, 0, d / np.where(mx == 0, 1, mx))
    return np.stack([h, s, mx], axis=1)


def main_hue(square: Image.Image) -> dict:
    """
    The object's main colour, for the colour variants: the peak of the hue histogram of its clearly coloured
    pixels, and how much of the object it covers. The game recolours the pixels around that hue.
    """
    a = np.array(square).astype(float) / 255
    solid = a[..., 3] > 0.8
    hsv = rgb_to_hsv(a[..., :3][solid])
    coloured = (hsv[:, 1] > 0.3) & (hsv[:, 2] > 0.2)
    bins = np.histogram(hsv[coloured, 0] * 360, bins=36, range=(0, 360), weights=hsv[coloured, 1])[0]
    # Circular smoothing, so a hue split between two bins still makes one peak.
    smooth = bins + 0.6 * (np.roll(bins, 1) + np.roll(bins, -1))
    peak = int(np.argmax(smooth))
    centre = peak * 10 + 5
    near = np.abs(((hsv[:, 0] * 360 - centre) + 180) % 360 - 180) <= 30
    share = float((coloured & near).sum() / max(1, len(hsv)))
    return {'hue': centre, 'share': round(share, 3)}


def runs(profile: np.ndarray, bright: float) -> list:
    """Spans [start, end) where the profile is at least `bright`."""
    on = profile >= bright
    edges = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(int), [0]])))
    return list(zip(edges[::2], edges[1::2]))


def shelf_pieces():
    """The regenerated shelf cropped to itself, and its columns (posts, compartments, dividers) and rows."""
    image = Image.open(SRC / 'shelf-3-v2.png').convert('RGBA')
    opaque = np.array(image)[..., 3] > 128
    ys, xs = np.nonzero(opaque)
    image = image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    a = np.array(image).astype(float)
    a[..., 3] = np.where(a[..., 3] > 128, 255, 0)
    image = Image.fromarray(a.astype(np.uint8))
    lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    h, w = lum.shape
    # Across the middle: bright posts and dividers, dark compartments.
    wood = [r for r in runs(lum[h // 2 - 40 : h // 2 + 40].mean(axis=0), 85) if r[1] - r[0] > 8]
    left_post, d1, d2, right_post = wood[0], wood[1], wood[2], wood[-1]
    cols = [(0, left_post[1]), (left_post[1], d1[0]), d1, (d1[1], d2[0]), d2, (d2[1], right_post[0]), (right_post[0], w)]
    # Down the first compartment: the bright top beam, the dark back wall (the longest dark stretch), the plank.
    mid = (cols[1][0] + cols[1][1]) // 2
    top_end, bottom_start = max(runs(-lum[:, mid - 10 : mid + 10].mean(axis=1), -DARK_WALL), key=lambda r: r[1] - r[0])
    rows = [(0, top_end), (top_end, bottom_start), (bottom_start, h)]
    return image, cols, rows


def fit_rows(image: Image.Image, rows: list, width: int) -> Image.Image:
    """The picture with its three rows (beam, back wall, plank) brought to the game's heights."""
    heights = [round(SHELF[k] * UNIT) for k in ('beam', 'slot', 'plank')]
    out = Image.new('RGBA', (width, sum(heights)), (0, 0, 0, 0))
    y = 0
    for (r0, r1), th in zip(rows, heights):
        out.alpha_composite(image.crop((0, r0, image.width, r1)).resize((width, th), Image.LANCZOS), (0, y))
        y += th
    return out


def shelf() -> dict:
    image, cols, rows = shelf_pieces()
    pitch = (cols[5][0] - cols[1][0]) / 2  # from one compartment's start to the next one's: one slot
    out = fit_rows(image, rows, round(image.width / pitch * UNIT))
    size = save_webp(out, OUT / 'shelf.webp')
    return {
        'bytes': size,
        'image': list(out.size),
        # In slot units: the picture's width and its first compartment's centre (the game's is at 0.55).
        'width': round(image.width / pitch, 4),
        'firstCentre': round((cols[1][0] + cols[1][1]) / 2 / pitch, 4),
        **{k: SHELF[k] for k in ('beam', 'slot', 'plank', 'overhangTop')},
    }


def cubby() -> dict:
    """One compartment between two posts, for fixed stacks: the shelf's left end up to the middle of its first
    compartment, and the same mirrored, so both ends keep the beam's and the board's rounded caps."""
    image, cols, rows = shelf_pieces()
    half = image.crop((0, 0, (cols[1][0] + cols[1][1]) // 2, image.height))
    one = Image.new('RGBA', (half.width * 2, image.height), (0, 0, 0, 0))
    one.alpha_composite(half, (0, 0))
    one.alpha_composite(half.transpose(Image.FLIP_LEFT_RIGHT), (half.width, 0))
    pitch = (cols[5][0] - cols[1][0]) / 2
    out = fit_rows(one, rows, round(one.width / pitch * UNIT))
    size = save_webp(out, OUT / 'cubby.webp')
    return {'bytes': size, 'image': list(out.size), 'width': round(one.width / pitch, 4), **{k: SHELF[k] for k in ('beam', 'slot', 'plank', 'overhangTop')}}


def pieces() -> dict:
    """
    Wood for everything else on the board, cut from the same shelf so it all matches: the top beam's straight
    middle (rails, poles, nailed planks), a panel of boards made of it (lock shutters, the plates under stacks),
    a crate (the roaming blocker) and a compartment's dark back wall (the bed of a conveyor).
    """
    image, cols, rows = shelf_pieces()
    pitch = (cols[5][0] - cols[1][0]) / 2
    scale = UNIT / pitch
    big = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    c = [(round(a * scale), round(b * scale)) for a, b in cols]
    r = [(round(a * scale), round(b * scale)) for a, b in rows]
    info = {}
    # The beam between the end posts, without its rounded caps; its outline rows top and bottom are kept.
    beam = big.crop((c[1][0] + 40, r[0][0], c[5][1] - 40, r[0][1]))
    info['beam'] = {'bytes': save_webp(beam, OUT / 'beam.webp'), 'image': list(beam.size)}
    # Boards: five lengths of the beam, from different places along it, one under the other.
    side = 256
    count = 5
    board_h = side // count
    boards = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    for i in range(count):
        x0 = (i * 151) % max(1, beam.width - side * 2)
        piece = beam.crop((x0, 0, x0 + side * 2, beam.height)).resize((side, board_h), Image.LANCZOS)
        boards.alpha_composite(piece, (0, i * board_h))
    boards = boards.crop((0, 0, side, board_h * count))
    info['boards'] = {'bytes': save_webp(boards, OUT / 'boards.webp'), 'image': list(boards.size)}
    # A crate: boards in a frame of beam, braced with two crossed lengths of beam.
    crate = boards.resize((side, side), Image.LANCZOS).convert('RGBA')
    frame = max(10, side // 11)
    strip = beam.resize((side, frame), Image.LANCZOS)
    for edge in range(4):
        layer = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        layer.alpha_composite(strip, (0, 0))
        crate.alpha_composite(layer.rotate(90 * edge))
    brace = beam.resize((round(side * 1.25), round(frame * 1.25)), Image.LANCZOS)
    for angle in (45, -45):
        layer = Image.new('RGBA', (side * 2, side * 2), (0, 0, 0, 0))
        layer.alpha_composite(brace, ((side * 2 - brace.width) // 2, (side * 2 - brace.height) // 2))
        layer = layer.rotate(angle, resample=Image.BICUBIC).crop((side // 2, side // 2, side // 2 + side, side // 2 + side))
        inside = Image.new('L', (side, side), 0)
        inside.paste(255, (frame, frame, side - frame, side - frame))
        layer.putalpha(Image.fromarray(np.minimum(np.array(layer)[..., 3], np.array(inside))))
        crate.alpha_composite(layer)
    info['crate'] = {'bytes': save_webp(crate, OUT / 'crate.webp'), 'image': list(crate.size)}
    # A compartment's back wall, between the beam and the floor.
    wall = big.crop((c[3][0] + 6, r[1][0] + 6, c[3][1] - 6, r[1][1] - 6))
    info['wall'] = {'bytes': save_webp(wall, OUT / 'wall.webp'), 'image': list(wall.size)}
    return info


LONGEST = {'portrait': 1536, 'landscape': 1920}

THEMES = re.findall(r"\{ id: '([a-z0-9-]+)', level: \d+ \}", (ROOT / 'src/data/themes.ts').read_text())


def background(source: Path, shape: str, out: Path) -> dict:
    image = Image.open(source).convert('RGB')
    scale = min(1, LONGEST[shape] / max(image.size))
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    return {'size': list(image.size), 'bytes': save_webp(image, out)}


def backgrounds() -> dict:
    """The backgrounds of levels without a theme, and of every theme whose pictures are there (<theme>-portrait.png and
    <theme>-landscape.png in art-source/pilot): themes without them keep their drawn backdrop."""
    for old in (OUT / 'themes').glob('*.webp'):
        old.unlink()
    sizes = {name: background(SRC / f'{name}.png', name.split('-')[1], OUT / f'{name}.webp') for name in ('background-portrait', 'background-landscape')}
    themes = {}
    for theme in THEMES:
        files = {shape: SRC / f'{theme}-{shape}.png' for shape in LONGEST}
        if all(f.exists() for f in files.values()):
            themes[theme] = {shape: background(f, shape, OUT / 'themes' / f'{theme}-{shape}.webp') for shape, f in files.items()}
    return {**sizes, 'themes': themes}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--size', type=int, default=192, help='side of the item pictures, in px')
    args = parser.parse_args()
    for old in (OUT / 'items').glob('*.webp'):
        old.unlink()
    squares = {}
    for file, names in SHEETS.items():
        squares.update(cut(file, names))
    missing = [kind for kind in CATALOGUE if kind not in squares]
    extra = [kind for kind in squares if kind not in CATALOGUE]
    if missing or extra:
        raise SystemExit(f'kinds without a drawing: {missing}; drawings not in the catalogue: {extra}')
    items = {}
    total = 0
    for kind in CATALOGUE:
        square = squares[kind]
        # Bounds of the drawing without its soft shadow, in the game's 100-unit box (see ui/itemFit).
        body = np.array(square)[..., 3] > 128
        ys, xs = np.nonzero(body)
        bounds = [round(v * 100 / WORK, 1) for v in (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)]
        size = save_webp(square.resize((args.size, args.size), Image.LANCZOS), OUT / 'items' / f'{kind}.webp')
        total += size
        items[kind] = {'bounds': bounds, 'halo': bool(edge_lightness(square) < HALO_BELOW), **main_hue(square)}
    info = {'itemSize': args.size, 'items': items, 'shelf': shelf(), 'cubby': cubby(), 'pieces': pieces(), 'backgrounds': backgrounds()}
    (OUT / 'art.json').write_text(json.dumps(info, indent=1) + '\n')
    halo = [k for k, v in items.items() if v['halo']]
    print(f'{len(items)} items at {args.size} px: {total / 1024:.0f} KB; halo on {len(halo)}: {", ".join(halo)}')
    print(f'shelf {info["shelf"]["bytes"] / 1024:.0f} KB, cubby {info["cubby"]["bytes"] / 1024:.0f} KB, backgrounds', {k: f'{v["bytes"] / 1024:.0f} KB' for k, v in info['backgrounds'].items() if k != 'themes'})
    for theme, shapes in info['backgrounds']['themes'].items():
        print(f'theme {theme}:', {k: f'{v["size"][0]}x{v["size"][1]} {v["bytes"] / 1024:.0f} KB' for k, v in shapes.items()})


if __name__ == '__main__':
    main()
