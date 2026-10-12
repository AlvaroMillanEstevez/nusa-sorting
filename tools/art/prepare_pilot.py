#!/usr/bin/env python3
"""
Prepares the pilot art (art-source/pilot/, generated with ChatGPT) for the development mock-up (?artpilot): an
internal tool, its output only reaches development pages, never the build.

    python3 tools/art/prepare_pilot.py      (needs Pillow, numpy and scipy)

Writes src/dev/artpilot/:
- objects: each of the six objects cut from the sheet, without its neighbours' bits, made opaque (the sheet's
  objects are 98 % opaque), trimmed, centred and scaled into a 256 px square resting on the bottom margin, its
  soft shadow kept. Also a dark silhouette of each (for the layers behind, as the game draws them) and a greyscale
  copy (for the gallery's check).
- shelf.webp: the empty shelf rebuilt from its pieces at the game's own shelf geometry (see SHELF below), so its
  three compartments fall on the three slots and it scales uniformly with the slot size.
- background-portrait.webp, background-landscape.webp: the game's backgrounds, resized.
- pilot.json: each object's bounds in its 100-unit box (for the game's item fit), the shelf's geometry, sizes.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art-source/pilot'
OUT = ROOT / 'src/dev/artpilot'
SIZE = 256
MARGIN = 10
WEBP = dict(quality=82, method=6)

# The sheet's six objects, left to right and top to bottom.
OBJECTS = ['sate', 'es-teh-manis', 'rambutan', 'ketupat', 'bakso', 'klepon']

# The game's shelf in slot units (see ui/boardLayout: SIDE_PAD, TOP_PAD, slot aspect 1.2, PLANK), with the art's
# pieces made thinner: posts and dividers fit inside the side pads (the slots keep their centres at 0.55, 1.55
# and 2.55), the top beam sticks out a little above the shelf's box into the gap between rows.
SHELF = {
    'post': 0.08,
    'divider': 0.06,
    'interior': 0.94,
    'beam': 0.14,
    'overhangTop': 0.06,
    'slot': 1.2,
    'plank': 0.18,
}
UNIT = 220  # pixels per slot in the shelf image


def save_webp(image: Image.Image, name: str) -> int:
    path = OUT / name
    image.save(path, 'WEBP', **WEBP)
    return path.stat().st_size


def objects() -> dict:
    sheet = Image.open(SRC / 'objects-sheet.png').convert('RGBA')
    a = np.array(sheet)
    solid = a[..., 3] > 20
    labels, count = ndimage.label(solid)
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    big = sorted((i + 1 for i, s in enumerate(sizes) if s > 2000), key=lambda i: ndimage.find_objects(labels == i)[0][0].start)
    # Two rows of three, each row sorted left to right.
    boxes = [(i, ndimage.find_objects(labels == i)[0]) for i in big]
    rows = sorted(boxes, key=lambda b: b[1][0].start)
    ordered = sorted(rows[:3], key=lambda b: b[1][1].start) + sorted(rows[3:], key=lambda b: b[1][1].start)
    info = {}
    for name, (label, (ys, xs)) in zip(OBJECTS, ordered):
        own = ndimage.binary_dilation(labels == label, iterations=6)
        # The soft shadow (faint alpha) under and around the object belongs to it too.
        shadow_zone = np.zeros_like(own)
        shadow_zone[ys.start : min(a.shape[0], ys.stop + 40), max(0, xs.start - 30) : xs.stop + 30] = True
        keep = own | (shadow_zone & (a[..., 3] <= 20) & ~ndimage.binary_dilation(solid & ~(labels == label), iterations=12))
        part = a.copy()
        part[..., 3] = np.where(keep, part[..., 3], 0)
        # Nearly opaque in the sheet: fully opaque here.
        part[..., 3] = np.where(part[..., 3] >= 240, 255, part[..., 3])
        image = Image.fromarray(part)
        bbox = image.getbbox()
        image = image.crop(bbox)
        # Fit into the square, resting on the bottom margin, centred across.
        room = SIZE - 2 * MARGIN
        scale = min(room / image.width, room / image.height)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        square = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        x = (SIZE - image.width) // 2
        y = SIZE - MARGIN - image.height
        square.alpha_composite(image, (x, y))
        size = save_webp(square, f'{name}.webp')
        # Bounds of the drawing without its soft shadow, in the game's 100-unit box (see ui/itemFit ITEM_BOUNDS).
        body = np.array(square)[..., 3] > 128
        ys2, xs2 = np.nonzero(body)
        bounds = [round(v * 100 / SIZE, 1) for v in (xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1)]
        # The layer behind: the shape in the game's silhouette colours (dark fill, lighter rim), softened.
        alpha = Image.fromarray((body * 255).astype(np.uint8))
        rim = alpha.filter(ImageFilter.MaxFilter(5))
        sil = Image.new('RGBA', (SIZE, SIZE), (0x8C, 0x6A, 0x48, 0))
        sil.putalpha(rim)
        fill = Image.new('RGBA', (SIZE, SIZE), (0x1E, 0x13, 0x0B, 0))
        fill.putalpha(alpha)
        sil.alpha_composite(fill)
        sil = sil.filter(ImageFilter.GaussianBlur(1.2))
        size_back = save_webp(sil, f'{name}-back.webp')
        grey = square.convert('LA').convert('RGBA')
        save_webp(grey, f'{name}-grey.webp')
        info[name] = {'bounds': bounds, 'bytes': size, 'backBytes': size_back}
    return info


def runs(profile: np.ndarray, bright: float) -> list:
    """Spans [start, end) where the profile is at least `bright`."""
    on = profile >= bright
    edges = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(int), [0]])))
    return list(zip(edges[::2], edges[1::2]))


def shelf() -> dict:
    image = Image.open(SRC / 'shelf-3.png').convert('RGBA')
    # The shelf itself (its faint glow around is left out).
    opaque = np.array(image)[..., 3] > 128
    ys, xs = np.nonzero(opaque)
    image = image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    a = np.array(image).astype(float)
    a[..., 3] = np.where(a[..., 3] > 128, 255, 0)
    image = Image.fromarray(a.astype(np.uint8))
    lum = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    h, w = lum.shape
    # Across the middle: bright posts and dividers, dark compartments.
    across = lum[h // 2 - 40 : h // 2 + 40].mean(axis=0)
    wood = [r for r in runs(across, 85) if r[1] - r[0] > 8]
    left_post, d1, d2, right_post = wood[0], wood[1], wood[2], wood[-1]
    cols = [(0, left_post[1]), (left_post[1], d1[0]), d1, (d1[1], d2[0]), d2, (d2[1], right_post[0]), (right_post[0], w)]
    # Down the first compartment: the bright top beam, the dark back wall, then the floor and the front plank.
    down = lum[:, (cols[1][0] + cols[1][1]) // 2 - 10 : (cols[1][0] + cols[1][1]) // 2 + 10].mean(axis=1)
    # The back wall is the longest dark stretch (the outline at the very bottom is dark too, but thin).
    top_end, bottom_start = max(runs(-down, -60), key=lambda r: r[1] - r[0])
    rows = [(0, top_end), (top_end, bottom_start), (bottom_start, h)]
    # Target sizes (px) of each column and row of pieces.
    u = UNIT
    col_w = [SHELF['post'], SHELF['interior'], SHELF['divider'], SHELF['interior'], SHELF['divider'], SHELF['interior'], SHELF['post']]
    row_h = [SHELF['beam'], SHELF['slot'], SHELF['plank']]
    out_w = round(sum(col_w) * u)
    out_h = round(sum(row_h) * u)
    out = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    y = 0
    for (r0, r1), rh in zip(rows, row_h):
        x = 0
        th = round(rh * u)
        for (c0, c1), cw in zip(cols, col_w):
            tw = round(cw * u)
            piece = image.crop((c0, r0, c1, r1)).resize((max(1, tw), max(1, th)), Image.LANCZOS)
            out.alpha_composite(piece, (x, y))
            x += tw
        y += th
    out = out.resize((out_w, out_h))
    size = save_webp(out, 'shelf.webp')
    return {
        'geometry': SHELF,
        'source': {'columns': [list(map(int, c)) for c in cols], 'rows': [list(map(int, r)) for r in rows], 'size': [w, h]},
        'image': [out_w, out_h],
        'bytes': size,
    }


def backgrounds() -> dict:
    sizes = {}
    for name, longest in (('background-portrait', 1536), ('background-landscape', 1920)):
        image = Image.open(SRC / f'{name}.png').convert('RGB')
        scale = min(1, longest / max(image.size))
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        sizes[name] = {'size': list(image.size), 'bytes': save_webp(image, f'{name}.webp')}
    return sizes


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    info = {'objects': objects(), 'shelf': shelf(), 'backgrounds': backgrounds()}
    (OUT / 'pilot.json').write_text(json.dumps(info, indent=1) + '\n')
    total = sum(p.stat().st_size for p in OUT.glob('*.webp'))
    print(json.dumps(info, indent=1))
    print(f'total {total / 1024:.0f} KB in {len(list(OUT.glob("*.webp")))} WebP files')


if __name__ == '__main__':
    main()
