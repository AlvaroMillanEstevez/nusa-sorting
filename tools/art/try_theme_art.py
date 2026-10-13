#!/usr/bin/env python3
"""
Prepares themed art being tried (not yet part of the game) for the development trial ?themeArt: the themed
level's backgrounds and its map island, from the originals in art-source/pilot. Writes src/dev/themeart/ (not in
git: generate it before opening ?themeArt).

    python3 tools/art/try_theme_art.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'art-source/pilot'
OUT = ROOT / 'src/dev/themeart'
TRIALS = {
    'budaya-jawa': {
        'portrait': 'budaya-jawa-portrait.png',
        'landscape': 'budaya-jawa-landscape.png',
        'island': 'budaya-jawa-island.png',
    },
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for theme, files in TRIALS.items():
        for part, name in files.items():
            image = Image.open(SRC / name)
            if part == 'island':
                # Trimmed to the island itself; the map shows it at most about 300 CSS px wide.
                image = image.convert('RGBA')
                image = image.crop(image.getbbox())
                scale = min(1, 640 / max(image.size))
            else:
                image = image.convert('RGB')
                scale = min(1, (1536 if part == 'portrait' else 1920) / max(image.size))
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
            path = OUT / f'{theme}-{part}.webp'
            image.save(path, 'WEBP', quality=80, method=6)
            print(f'{path.name}: {image.size[0]}x{image.size[1]}, {path.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
