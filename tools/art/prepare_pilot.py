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

# The sheets and their six objects, left to right and top to bottom. The second sheet (made with new rules: one
# object per cell, more saturated colours, distinct silhouettes) redoes three kinds: they get a '-2'.
SHEETS = {
    'objects-sheet.png': ['sate', 'es-teh-manis', 'rambutan', 'ketupat', 'bakso', 'klepon'],
    'objects-sheet-2.png': ['klepon-2', 'ketupat-2', 'rambutan-2', 'nasi-goreng', 'kerupuk-udang', 'onde-onde'],
    # Sheets 3-5 (13 October, same rules): the other eighteen foods, and klepon once more.
    'objects-sheet-3.png': ['mie-goreng', 'rendang', 'gado-gado', 'ayam-goreng', 'ikan-bakar', 'martabak-manis'],
    'objects-sheet-4.png': ['tempe', 'tahu-goreng', 'pisang-goreng', 'dadar-gulung', 'es-cendol', 'es-kelapa-muda'],
    'objects-sheet-5.png': ['jamu', 'durian', 'manggis', 'salak', 'cabai', 'klepon-3'],
}

# How colour-blind players see a colour: Viénot, Brettel & Mollon (1999) in linear RGB, as the game's own
# simulation (src/ui/icons/color.ts).
CVD = {
    'deut': np.array([[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]]),
    'prot': np.array([[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]]),
}


def to_linear(c: np.ndarray) -> np.ndarray:
    c = c / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(v: np.ndarray) -> np.ndarray:
    v = np.clip(v, 0, 1)
    return 255 * np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


def simulate(image: Image.Image, vision: str) -> Image.Image:
    """The image as seen with a colour vision deficiency ('deut', 'prot') or without colour ('grey')."""
    a = np.array(image).astype(float)
    lin = to_linear(a[..., :3])
    if vision == 'grey':
        y = lin @ np.array([0.2126, 0.7152, 0.0722])
        out = np.repeat(to_srgb(y)[..., None], 3, axis=2)
    else:
        out = to_srgb(lin @ CVD[vision].T)
    return Image.fromarray(np.dstack([out, a[..., 3]]).round().astype(np.uint8))

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


def objects(file: str, names: list) -> dict:
    sheet = Image.open(SRC / file).convert('RGBA')
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
    for name, (label, (ys, xs)) in zip(names, ordered):
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
        for vision in ('grey', 'deut', 'prot'):
            save_webp(simulate(square, vision), f'{name}-{vision}.webp')
        info[name] = {'bounds': bounds, 'bytes': size, 'backBytes': size_back}
    return info


def runs(profile: np.ndarray, bright: float) -> list:
    """Spans [start, end) where the profile is at least `bright`."""
    on = profile >= bright
    edges = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(int), [0]])))
    return list(zip(edges[::2], edges[1::2]))


def shelf_pieces(file: str):
    """The shelf cropped to itself, and its columns (posts, compartments, dividers) and rows (beam, back, plank)."""
    image = Image.open(SRC / file).convert('RGBA')
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
    top_end, bottom_start = max(runs(-down, -DARK[file]), key=lambda r: r[1] - r[0])
    rows = [(0, top_end), (top_end, bottom_start), (bottom_start, h)]
    return image, cols, rows


# Below this brightness is a compartment's back wall (the second shelf's is lighter).
DARK = {'shelf-3.png': 60, 'shelf-3-v2.png': 75}


def shelf() -> dict:
    """The first shelf (thick frame), rebuilt from its pieces at the game's geometry."""
    image, cols, rows = shelf_pieces('shelf-3.png')
    w, h = image.size
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
        'kind': 'rebuilt',
        'geometry': SHELF,
        'source': {'columns': [list(map(int, c)) for c in cols], 'rows': [list(map(int, r)) for r in rows], 'size': [w, h]},
        'image': [out_w, out_h],
        'bytes': size,
    }


def shelf_as_is() -> dict:
    """
    The second shelf (thin frame) as it is: only cropped and scaled uniformly, so that one compartment plus one
    divider is UNIT pixels. Its measures (in those units) say how it lines up with the game's slots.
    """
    image, cols, rows = shelf_pieces('shelf-3-v2.png')
    w, h = image.size
    pitch = (cols[5][0] - cols[1][0]) / 2  # from one compartment's start to the next one's
    scale = UNIT / pitch
    out = image.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    size = save_webp(out, 'shelf-v2.webp')
    unit = lambda px: round(px / pitch, 3)  # noqa: E731
    centres = [unit((cols[i][0] + cols[i][1]) / 2) for i in (1, 3, 5)]
    return {
        'kind': 'asIs',
        'image': list(out.size),
        'bytes': size,
        # In units of one compartment plus divider (the game's slot width): where things are in the picture.
        'units': {
            'width': unit(w),
            'height': unit(h),
            'post': [unit(cols[0][1] - cols[0][0]), unit(cols[6][1] - cols[6][0])],
            'divider': [unit(cols[2][1] - cols[2][0]), unit(cols[4][1] - cols[4][0])],
            'interior': [unit(cols[i][1] - cols[i][0]) for i in (1, 3, 5)],
            'centres': centres,
            'beam': unit(rows[0][1]),
            'back': unit(rows[1][1] - rows[1][0]),
            'floor': unit(rows[1][1]),
            'plank': unit(h - rows[1][1]),
        },
    }


def shelf_fitted() -> dict:
    """
    The second shelf with its width as it is and only its height fitted to the game's slots (which are 1.2 times
    taller than wide, where its compartments are square): the back wall is stretched to the slot's height and the
    beam and plank brought to the game's (beam a little over the shelf's box, as for the first shelf).
    """
    image, cols, rows = shelf_pieces('shelf-3-v2.png')
    w, _ = image.size
    pitch = (cols[5][0] - cols[1][0]) / 2
    u = UNIT
    row_h = [SHELF['beam'], SHELF['slot'], SHELF['plank']]
    out_w = round(w / pitch * u)
    out = Image.new('RGBA', (out_w, round(sum(row_h) * u)), (0, 0, 0, 0))
    y = 0
    for (r0, r1), rh in zip(rows, row_h):
        th = round(rh * u)
        out.alpha_composite(image.crop((0, r0, w, r1)).resize((out_w, th), Image.LANCZOS), (0, y))
        y += th
    size = save_webp(out, 'shelf-v2-fit.webp')
    centre = ((cols[1][0] + cols[1][1]) / 2) / pitch
    return {'kind': 'fitted', 'image': list(out.size), 'bytes': size, 'units': {'width': round(w / pitch, 3), 'firstCentre': round(centre, 3)}}


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
    info = {'objects': {k: v for file, names in SHEETS.items() for k, v in objects(file, names).items()}, 'shelf': shelf(),  'shelfV2': shelf_as_is(), 'shelfV2Fit': shelf_fitted(), 'backgrounds': backgrounds()}
    (OUT / 'pilot.json').write_text(json.dumps(info, indent=1) + '\n')
    total = sum(p.stat().st_size for p in OUT.glob('*.webp'))
    print(json.dumps(info, indent=1))
    print(f'total {total / 1024:.0f} KB in {len(list(OUT.glob("*.webp")))} WebP files')


if __name__ == '__main__':
    main()
