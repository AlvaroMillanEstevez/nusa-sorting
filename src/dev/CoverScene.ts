import * as Phaser from 'phaser';
import { loadUiFonts } from '../scenes/kit';
import { makeWoodArt } from '../scenes/art/woodArt';
import { addSvgTexture } from '../scenes/svgTexture';
import { fitCamera, RENDER_RATIO, viewSize } from '../scenes/view';
import { shelfLayoutAt, type ShelfLayout } from '../ui/boardLayout';
import { FONTS, SKIN } from '../ui/design/tokens';
import { WOOD } from '../ui/art/wood';
import { renderItemSvg } from '../ui/icons/icons';
import { ITEM_FILL } from '../ui/levelLayout';

/**
 * Development only (`?cover=landscape|portrait|square`): the store covers, drawn with the game's own art (the
 * wooden wall, the warung shelves, the food and object icons, the Fredoka title) rather than a screenshot. The
 * page is the cover: tools/covers/render.sh opens it in a headless browser at the exact size and saves the PNG.
 * Only the title as text, no borders, the same composition across the three shapes.
 */

export type CoverShape = 'landscape' | 'portrait' | 'square';

/** The CSS size a cover is laid out at; rendered at 2 device pixels per CSS pixel, so 1920×1080 and so on. */
export const COVER_SIZES: Readonly<Record<CoverShape, { width: number; height: number }>> = {
  landscape: { width: 960, height: 540 },
  portrait: { width: 400, height: 600 },
  square: { width: 400, height: 400 },
};

export function parseCoverParam(search: string): CoverShape | null {
  const value = new URLSearchParams(search).get('cover');
  return value === 'landscape' || value === 'portrait' || value === 'square' ? value : value === null ? null : 'landscape';
}

/** The shelves the covers draw from; every shape includes the finished triple (with sparkles). */
const SHELVES: readonly (readonly string[])[] = [
  ['rambutan', 'es-teh-manis', 'wayang-kulit'],
  ['sate', 'sate', 'sate'],
  ['layangan', 'nasi-goreng', 'ketupat'],
  ['klepon', 'batik', 'es-kelapa-muda'],
  ['durian', 'pinisi', 'rendang'],
  ['topeng', 'manggis', 'kelapa'],
];
const TRIPLE = 1;
/** Which shelves each shape shows, row by row. */
const GRID: Readonly<Record<CoverShape, readonly (readonly number[])[]>> = {
  landscape: [
    [0, 1, 2],
    [3, 4, 5],
  ],
  portrait: [[0], [1], [2]],
  square: [
    [0, 1],
    [3, 5],
  ],
};
/** The title on one line, or two on the narrower shapes. */
const TITLE: Readonly<Record<CoverShape, string>> = { landscape: 'Nusa Sorting', portrait: 'Nusa\nSorting', square: 'Nusa\nSorting' };
/** Objects floating beside the title, as if on their way to a shelf: [type, x, y, size, angle] in cover units. */
type Floater = readonly [string, number, number, number, number];
const FLOATERS: Readonly<Record<CoverShape, readonly Floater[]>> = {
  landscape: [
    ['lampion', 0.1, 0.26, 1.0, -10],
    ['kembang-api', 0.9, 0.24, 1.0, 10],
  ],
  portrait: [
    ['lampion', 0.12, 0.25, 0.95, -10],
    ['kembang-api', 0.88, 0.25, 0.95, 10],
  ],
  square: [
    ['lampion', 0.12, 0.29, 1.05, -10],
    ['kembang-api', 0.88, 0.29, 1.05, 10],
  ],
};
/** Bunting colours: the islands' accents (red and white, turquoise sea, turmeric, rice green, festival pink). */
const BUNTING = ['#e8443a', '#fff4e0', '#2fb5a8', '#ffc95a', '#7cc44a', '#f06aa0'];

export class CoverScene extends Phaser.Scene {
  constructor(private readonly shape: CoverShape) {
    super('Cover');
  }

  create(): void {
    fitCamera(this);
    void this.draw();
  }

  private async draw(): Promise<void> {
    const { width, height } = viewSize(this);
    const unit = Math.min(width, height);
    const layout = this.layout(width, height);
    const types = new Set([...SHELVES.flat(), ...FLOATERS[this.shape].map(([type]) => type)]);
    const itemPx = layout.s * ITEM_FILL;
    await Promise.all([
      loadUiFonts(),
      ...[...types].map((type) => addSvgTexture(this.textures, `cover:${type}`, renderItemSvg(type), Math.ceil(itemPx * 1.4 * RENDER_RATIO))),
    ]);

    this.backdrop(width, height);
    this.bunting(width, unit);

    // The shelves, with the finished triple glowing.
    const art = makeWoodArt();
    for (const { index, shelf } of layout.shelves) {
      if (index === TRIPLE) this.glow(shelf);
      const g = this.add.graphics();
      art.drawShelf(g, shelf, layout.s);
      SHELVES[index]!.forEach((type, slot) => {
        const at = shelf.slots[slot]!;
        this.add.image(at.x, at.y, `cover:${type}`).setDisplaySize(itemPx, itemPx);
      });
      if (index === TRIPLE) this.sparkles(shelf, layout.s);
    }

    for (const [type, fx, fy, size, angle] of FLOATERS[this.shape]) {
      const px = itemPx * size;
      this.add.image(fx * width + px * 0.06, fy * height + px * 0.1, `cover:${type}`).setDisplaySize(px, px).setAngle(angle).setTint(0x000000).setAlpha(0.28);
      this.add.image(fx * width, fy * height, `cover:${type}`).setDisplaySize(px, px).setAngle(angle);
    }

    this.title(TITLE[this.shape], width / 2, layout.titleY, layout.titleSize, width);
  }

  /** Where the shelves and the title go for this shape, and the item cell size `s`. */
  private layout(width: number, height: number): { s: number; shelves: { index: number; shelf: ShelfLayout }[]; titleY: number; titleSize: number } {
    const unit = shelfLayoutAt(0, 0, 1).rect;
    const grid = GRID[this.shape];
    const columns = Math.max(...grid.map((row) => row.length));
    const gapX = 0.4;
    const gapY = 0.12;
    // The shelves fill the lower part of the cover, as wide as they can.
    const area = { landscape: { w: 0.9, top: 0.43, bottom: 0.98 }, portrait: { w: 0.9, top: 0.43, bottom: 0.97 }, square: { w: 0.94, top: 0.53, bottom: 0.98 } }[this.shape];
    const s = Math.min(
      (width * area.w) / (columns * unit.width + (columns - 1) * gapX),
      ((area.bottom - area.top) * height) / (grid.length * unit.height + (grid.length - 1) * gapY),
    );
    const blockH = (grid.length * unit.height + (grid.length - 1) * gapY) * s;
    const top = area.top * height + ((area.bottom - area.top) * height - blockH) / 2;
    const shelves = grid.flatMap((row, r) => {
      const rowW = (row.length * unit.width + (row.length - 1) * gapX) * s;
      return row.map((index, c) => ({ index, shelf: shelfLayoutAt((width - rowW) / 2 + c * (unit.width + gapX) * s, top + r * (unit.height + gapY) * s, s) }));
    });
    const title = { landscape: { y: 0.24, size: height * 0.21 }, portrait: { y: 0.245, size: width * 0.2 }, square: { y: 0.285, size: width * 0.15 } }[this.shape];
    return { s, shelves, titleY: title.y * height, titleSize: title.size };
  }

  /** The wooden wall of the stall, lit warmly from above the title, darker at the edges. */
  private backdrop(width: number, height: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * RENDER_RATIO);
    canvas.height = Math.round(height * RENDER_RATIO);
    const c = canvas.getContext('2d')!;
    c.scale(RENDER_RATIO, RENDER_RATIO);
    // Planks, each a little different.
    const plank = Math.max(28, Math.min(width, height) / 9);
    const tones = [WOOD.wall, WOOD.wallSlat, '#52331e', WOOD.wall, '#5a3a22'];
    for (let x = 0, i = 0; x < width; x += plank, i++) {
      c.fillStyle = tones[(i * 3) % tones.length]!;
      c.fillRect(x, 0, plank, height);
      c.fillStyle = WOOD.wallShade;
      c.fillRect(x, 0, 2, height);
      // Grain.
      c.strokeStyle = 'rgba(30, 16, 6, 0.25)';
      c.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        c.beginPath();
        const gx = x + (plank * k) / 4 + ((i * 7 + k * 3) % 5) - 2;
        c.moveTo(gx, 0);
        c.bezierCurveTo(gx + 3, height * 0.3, gx - 3, height * 0.6, gx + 1, height);
        c.stroke();
      }
    }
    // Warm light from above the title, and a vignette.
    const light = c.createRadialGradient(width / 2, height * 0.22, 0, width / 2, height * 0.22, Math.max(width, height) * 0.7);
    light.addColorStop(0, 'rgba(255, 196, 110, 0.42)');
    light.addColorStop(0.45, 'rgba(255, 170, 80, 0.12)');
    light.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = light;
    c.fillRect(0, 0, width, height);
    const vignette = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.hypot(width, height) * 0.6);
    vignette.addColorStop(0, 'rgba(10, 4, 0, 0)');
    vignette.addColorStop(1, 'rgba(10, 4, 0, 0.6)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, width, height);
    this.textures.addCanvas('cover:backdrop', canvas);
    this.add.image(0, 0, 'cover:backdrop').setOrigin(0).setDisplaySize(width, height);
  }

  /** A string of festival flags sagging across the top. */
  private bunting(width: number, unit: number): void {
    const g = this.add.graphics();
    const top = unit * 0.02;
    const sag = unit * 0.06;
    const at = (x: number) => top + sag * Math.sin((Math.PI * x) / width);
    g.lineStyle(Math.max(1.5, unit * 0.005), 0x2e1b0d, 0.9);
    g.beginPath();
    g.moveTo(-4, at(-4));
    for (let x = 0; x <= width + 4; x += 8) g.lineTo(x, at(x));
    g.strokePath();
    const flag = unit * 0.045;
    const count = Math.round(width / (flag * 1.7));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * width) / count;
      const y = at(x);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(BUNTING[i % BUNTING.length]!).color, 1);
      g.fillTriangle(x - flag * 0.5, y, x + flag * 0.5, y, x, y + flag * 1.15);
      g.lineStyle(1, 0x2e1b0d, 0.5);
      g.strokeTriangle(x - flag * 0.5, y, x + flag * 0.5, y, x, y + flag * 1.15);
    }
  }

  /** A soft golden glow behind the finished triple. */
  private glow(shelf: ShelfLayout): void {
    const { x, y, width, height } = shelf.rect;
    const g = this.add.graphics();
    for (let i = 6; i >= 1; i--) {
      const pad = i * Math.max(3, width * 0.022);
      g.fillStyle(0xffc95a, 0.06);
      g.fillRoundedRect(x - pad, y - pad, width + pad * 2, height + pad * 2, pad + 6);
    }
  }

  /** Four-pointed sparkles around the finished triple. */
  private sparkles(shelf: ShelfLayout, s: number): void {
    const { x, y, width, height } = shelf.rect;
    const spots: readonly [number, number, number][] = [
      [0.06, 0.08, 0.22],
      [0.95, 0.12, 0.28],
      [0.5, -0.06, 0.18],
      [0.98, 0.86, 0.16],
      [0.02, 0.9, 0.18],
    ];
    const g = this.add.graphics();
    for (const [fx, fy, size] of spots) {
      const cx = x + fx * width;
      const cy = y + fy * height;
      const r = s * size;
      g.fillStyle(0xfff4e0, 0.95);
      g.fillPoints(
        [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const angle = (k * Math.PI) / 4 - Math.PI / 2;
          const len = k % 2 === 0 ? r : r * 0.28;
          return new Phaser.Math.Vector2(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        }),
        true,
      );
      g.fillStyle(0xffc95a, 0.35);
      g.fillCircle(cx, cy, r * 0.45);
    }
  }

  /** "Nusa Sorting" in Fredoka, cream to turmeric, with the dark wooden outline and a drop shadow. */
  private title(value: string, x: number, y: number, size: number, width: number): void {
    const text = this.add
      .text(x, y, value, { fontFamily: FONTS.display, fontStyle: '600', fontSize: `${Math.round(size)}px`, color: SKIN.text.primary, align: 'center', lineSpacing: -size * 0.18, padding: { x: 16, y: 16 } })
      .setOrigin(0.5)
      .setResolution(RENDER_RATIO)
      .setStroke(SKIN.surface.border, Math.round(size * 0.16))
      .setShadow(0, Math.round(size * 0.08), '#000000', 0.45, true, true);
    // Cream to turmeric down each line.
    const lines = value.split('\n').length;
    const gradient = text.context.createLinearGradient(0, 0, 0, text.height);
    for (let i = 0; i < lines; i++) {
      gradient.addColorStop((i + 0.3) / lines, '#fff7e6');
      gradient.addColorStop((i + 0.85) / lines, SKIN.text.accent);
    }
    text.setFill(gradient);
    const room = width * 0.86;
    if (text.width > room) text.setScale(room / text.width);
  }
}
