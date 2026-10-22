import * as Phaser from 'phaser';
import { drawCounter } from '../scenes/FreshLooks';
import { loadUiFonts } from '../scenes/kit';
import { loadShelfArt, placeShelf, SHELF_TEXTURE } from '../scenes/art/shelfArt';
import { fadeToScene } from '../scenes/transitions';
import { fitCamera, RENDER_RATIO, viewSize } from '../scenes/view';
import { shelfLayoutAt } from '../ui/boardLayout';
import { FONTS, SKIN } from '../ui/design/tokens';
import { ITEM_FILL } from '../ui/levelLayout';

/**
 * Development only (`?cover=landscape|portrait|square&v=a|b`): the store covers, made from the game's illustrated
 * art rather than a screenshot: the warung at dusk behind, the food and objects cut at 512 px from the original
 * sheets (`python3 tools/art/build_game_art.py --hires art-source/hires-items`, outside git), the shelf, a fresh
 * food's price tag and the Fredoka title. Only the title as text, no borders, nothing important in the top left
 * corner (where the site puts its labels). Two compositions:
 * - a: the counter. A shelf with a finished, glowing triple of satay in front of the stall, food heaped beside it.
 * - b: the triple. Three alike come together in a burst of light under the title, food floating round it.
 * tools/covers/render.mjs opens the page in a headless browser at the exact size and saves the PNG.
 */

export type CoverShape = 'landscape' | 'portrait' | 'square';
export type CoverVariant = 'a' | 'b';

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

export const parseCoverVariant = (search: string): CoverVariant => (new URLSearchParams(search).get('v') === 'b' ? 'b' : 'a');

const HIRES = (kind: string) => `/art-source/hires-items/${kind}.png`;
const BACKDROP = { landscape: '/art-source/pilot/background-landscape.png', portrait: '/art-source/pilot/warung-sunset.png' } as const;

/** An object on the cover: kind, centre (shares of width and height), size (share of the shorter side), angle. */
interface Piece {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly angle?: number;
  /** A fresh food's price tag with this many moves left. */
  readonly tag?: number;
  /** Drawn a little blurred and darker, further back. */
  readonly far?: boolean;
}

/** Composition a: the shelf (centre x, base y as shares; width as a share of the cover's width) and the heaps. */
const COUNTER: Readonly<Record<CoverShape, { title: { y: number; size: number; lines: 1 | 2 }; shelf: { x: number; bottom: number; width: number }; pieces: readonly Piece[] }>> = {
  landscape: {
    title: { y: 0.19, size: 0.2, lines: 1 },
    shelf: { x: 0.5, bottom: 0.97, width: 0.4 },
    pieces: [
      { kind: 'es-teh-manis', x: 0.2, y: 0.66, size: 0.34, angle: -4 },
      { kind: 'nasi-goreng', x: 0.12, y: 0.84, size: 0.36 },
      { kind: 'ketupat', x: 0.28, y: 0.87, size: 0.3, angle: 6 },
      { kind: 'durian', x: 0.82, y: 0.66, size: 0.32 },
      { kind: 'rambutan', x: 0.74, y: 0.86, size: 0.3, tag: 5 },
      { kind: 'martabak-manis', x: 0.9, y: 0.86, size: 0.32 },
    ],
  },
  portrait: {
    title: { y: 0.15, size: 0.21, lines: 2 },
    shelf: { x: 0.5, bottom: 0.74, width: 0.86 },
    pieces: [
      { kind: 'es-teh-manis', x: 0.17, y: 0.45, size: 0.3, angle: -6 },
      { kind: 'durian', x: 0.83, y: 0.46, size: 0.28, angle: 6 },
      { kind: 'nasi-goreng', x: 0.22, y: 0.87, size: 0.38 },
      { kind: 'rambutan', x: 0.55, y: 0.89, size: 0.3, tag: 5 },
      { kind: 'ketupat', x: 0.84, y: 0.86, size: 0.32, angle: 6 },
    ],
  },
  square: {
    title: { y: 0.18, size: 0.15, lines: 2 },
    shelf: { x: 0.5, bottom: 0.8, width: 0.66 },
    pieces: [
      { kind: 'es-teh-manis', x: 0.1, y: 0.62, size: 0.24, angle: -6 },
      { kind: 'nasi-goreng', x: 0.15, y: 0.88, size: 0.27 },
      { kind: 'rambutan', x: 0.86, y: 0.86, size: 0.24, tag: 5 },
      { kind: 'durian', x: 0.87, y: 0.58, size: 0.2 },
    ],
  },
};

/** Composition b: where the triple meets (shares), the size of each of its three, and what floats round it. */
const TRIPLE_KIND = 'rambutan';
const BURST: Readonly<Record<CoverShape, { title: { y: number; size: number; lines: 1 | 2 }; triple: { x: number; y: number; size: number }; pieces: readonly Piece[] }>> = {
  landscape: {
    title: { y: 0.2, size: 0.2, lines: 1 },
    triple: { x: 0.5, y: 0.68, size: 0.3 },
    pieces: [
      { kind: 'sate', x: 0.12, y: 0.62, size: 0.3, angle: -18 },
      { kind: 'nasi-goreng', x: 0.2, y: 0.88, size: 0.32, angle: 8 },
      { kind: 'es-teh-manis', x: 0.9, y: 0.58, size: 0.3, angle: 12 },
      { kind: 'ketupat', x: 0.82, y: 0.86, size: 0.28, tag: 2 },
      { kind: 'klepon', x: 0.95, y: 0.2, size: 0.18, angle: 14, far: true },
      { kind: 'onde-onde', x: 0.06, y: 0.36, size: 0.15, angle: -8, far: true },
      { kind: 'es-kelapa-muda', x: 0.34, y: 0.94, size: 0.2, angle: -6, far: true },
      { kind: 'kerupuk-udang', x: 0.66, y: 0.95, size: 0.2, angle: 10, far: true },
    ],
  },
  portrait: {
    title: { y: 0.15, size: 0.21, lines: 2 },
    triple: { x: 0.5, y: 0.52, size: 0.27 },
    pieces: [
      { kind: 'sate', x: 0.2, y: 0.75, size: 0.36, angle: -16 },
      { kind: 'es-teh-manis', x: 0.8, y: 0.74, size: 0.34, angle: 10 },
      { kind: 'nasi-goreng', x: 0.5, y: 0.9, size: 0.38 },
      { kind: 'ketupat', x: 0.86, y: 0.42, size: 0.22, angle: 8, tag: 2 },
      { kind: 'klepon', x: 0.1, y: 0.4, size: 0.18, angle: -10, far: true },
    ],
  },
  square: {
    title: { y: 0.17, size: 0.15, lines: 2 },
    triple: { x: 0.5, y: 0.56, size: 0.23 },
    pieces: [
      { kind: 'sate', x: 0.15, y: 0.84, size: 0.28, angle: -16 },
      { kind: 'es-teh-manis', x: 0.85, y: 0.83, size: 0.27, angle: 10 },
      { kind: 'ketupat', x: 0.88, y: 0.4, size: 0.18, angle: 8, tag: 2 },
      { kind: 'nasi-goreng', x: 0.5, y: 0.93, size: 0.24, far: true },
    ],
  },
};

/** The satay triple on the counter's shelf. */
const SHELF_KINDS = ['sate', 'sate', 'sate'];

export class CoverScene extends Phaser.Scene {
  private readonly variant: CoverVariant;

  /** `then`: for the preview video, the scene the cover hands over to (with a fade) after `holdMs`. */
  constructor(
    private readonly shape: CoverShape,
    private readonly then?: { readonly next: string; readonly holdMs: number },
  ) {
    super('Cover');
    this.variant = parseCoverVariant(window.location.search);
  }

  create(): void {
    fitCamera(this);
    void this.draw();
  }

  private async draw(): Promise<void> {
    const { width, height } = viewSize(this);
    const plan = this.variant === 'a' ? COUNTER[this.shape] : BURST[this.shape];
    const kinds = new Set([...plan.pieces.map((p) => p.kind), ...(this.variant === 'a' ? SHELF_KINDS : [TRIPLE_KIND])]);
    const [backdrop, ...pictures] = await Promise.all([
      image(BACKDROP[this.shape === 'landscape' ? 'landscape' : 'portrait']),
      ...[...kinds].map((kind) => image(HIRES(kind))),
      loadUiFonts(),
      loadShelfArt(this.textures),
    ]);
    const picture = new Map([...kinds].map((kind, i) => [kind, pictures[i] as HTMLImageElement]));
    this.backdrop(backdrop as HTMLImageElement, width, height);
    const unit = Math.min(width, height);
    const pieces = [...plan.pieces].sort((a, b) => Number(Boolean(b.far)) - Number(Boolean(a.far)));
    const behind = pieces.filter((p) => p.far);
    const front = pieces.filter((p) => !p.far);
    for (const piece of behind) this.piece(piece, picture.get(piece.kind)!, width, height, unit);
    if (this.variant === 'a') this.counterShelf(picture.get('sate')!, width, height);
    else this.burst(picture.get(TRIPLE_KIND)!, width, height, unit);
    for (const piece of front) this.piece(piece, picture.get(piece.kind)!, width, height, unit);
    this.title(plan.title.lines === 2 ? 'Nusa\nSorting' : 'Nusa Sorting', width / 2, plan.title.y * height, plan.title.size * (plan.title.lines === 2 ? width : height), width);
    // For tools/covers/render.mjs: everything is drawn.
    (window as unknown as { __coverReady?: boolean }).__coverReady = true;
    const then = this.then;
    if (then) this.time.delayedCall(then.holdMs, () => fadeToScene(this, then.next));
  }

  /** The warung at dusk, cover-cropped, softly out of focus, darker towards the foot so the objects stand out. */
  private backdrop(picture: HTMLImageElement, width: number, height: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * RENDER_RATIO);
    canvas.height = Math.round(height * RENDER_RATIO);
    const c = canvas.getContext('2d')!;
    const k = Math.max(canvas.width / picture.width, canvas.height / picture.height);
    const w = picture.width * k;
    const h = picture.height * k;
    // The square shows the stall's upper part, its lights and awning; the others are centred.
    const top = this.shape === 'square' ? 0 : (canvas.height - h) / 2;
    c.filter = `blur(${Math.round(canvas.width * 0.0035)}px) saturate(1.1)`;
    c.drawImage(picture, (canvas.width - w) / 2, top, w, h);
    c.filter = 'none';
    const foot = c.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height);
    foot.addColorStop(0, 'rgba(20, 8, 2, 0)');
    foot.addColorStop(1, 'rgba(20, 8, 2, 0.55)');
    c.fillStyle = foot;
    c.fillRect(0, 0, canvas.width, canvas.height);
    // Warm light where the title is.
    const light = c.createRadialGradient(canvas.width / 2, canvas.height * 0.2, 0, canvas.width / 2, canvas.height * 0.2, canvas.width * 0.55);
    light.addColorStop(0, 'rgba(255, 190, 110, 0.28)');
    light.addColorStop(1, 'rgba(255, 190, 110, 0)');
    c.fillStyle = light;
    c.fillRect(0, 0, canvas.width, canvas.height);
    const vignette = c.createRadialGradient(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.4, canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.62);
    vignette.addColorStop(0, 'rgba(10, 4, 0, 0)');
    vignette.addColorStop(1, 'rgba(10, 4, 0, 0.5)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, canvas.width, canvas.height);
    this.textures.addCanvas('cover:backdrop', canvas);
    this.add.image(0, 0, 'cover:backdrop').setOrigin(0).setDisplaySize(width, height);
  }

  /** An object with a soft shadow under it (and its price tag, if it is fresh), sharp at the cover's resolution. */
  private piece(piece: Piece, picture: HTMLImageElement, width: number, height: number, unit: number): void {
    const px = piece.size * unit;
    const key = `cover:${piece.kind}:${piece.tag ?? 0}:${piece.far ? 'far' : 'near'}`;
    if (!this.textures.exists(key)) {
      const side = picture.width;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = side;
      const c = canvas.getContext('2d')!;
      if (piece.far) c.filter = `blur(${Math.round(side * 0.006)}px) brightness(0.8)`;
      c.drawImage(picture, 0, 0);
      c.filter = 'none';
      if (piece.tag !== undefined) drawCounter(c, side, { moves: piece.tag, warn: piece.tag <= 3, big: false });
      this.textures.addCanvas(key, canvas);
    }
    const x = piece.x * width;
    const y = piece.y * height;
    this.add.image(x + px * 0.04, y + px * 0.06, key).setDisplaySize(px, px).setAngle(piece.angle ?? 0).setTint(0x000000).setAlpha(0.35);
    this.add.image(x, y, key).setDisplaySize(px, px).setAngle(piece.angle ?? 0);
  }

  /** Composition a: the illustrated shelf with a finished triple of satay, glowing and sparkling. */
  private counterShelf(sate: HTMLImageElement, width: number, height: number): void {
    const plan = COUNTER[this.shape].shelf;
    const unit = shelfLayoutAt(0, 0, 1).rect;
    const s = (plan.width * width) / unit.width;
    const shelf = shelfLayoutAt(plan.x * width - (unit.width * s) / 2, plan.bottom * height - unit.height * s, s);
    this.glow(shelf.rect);
    placeShelf(this.add.image(0, 0, SHELF_TEXTURE), shelf, s);
    const key = 'cover:shelf-item';
    if (!this.textures.exists(key)) this.textures.addImage(key, sate);
    const px = s * ITEM_FILL * 1.05;
    for (const at of shelf.slots) this.add.image(at.x, at.y + s * 0.04, key).setDisplaySize(px, px);
    this.sparkles(shelf.rect, s);
  }

  /** Composition b: three alike come together in a burst of light, with sparkles and motion lines. */
  private burst(picture: HTMLImageElement, width: number, height: number, unit: number): void {
    const plan = BURST[this.shape].triple;
    const cx = plan.x * width;
    const cy = plan.y * height;
    const px = plan.size * unit;
    // The light: rays and a warm core.
    const g = this.add.graphics();
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const spread = Math.PI / rays / 1.6;
      const r = px * (i % 2 === 0 ? 2.1 : 1.6);
      g.fillStyle(0xffd27e, i % 2 === 0 ? 0.22 : 0.14);
      g.fillTriangle(cx, cy, cx + Math.cos(a - spread) * r, cy + Math.sin(a - spread) * r, cx + Math.cos(a + spread) * r, cy + Math.sin(a + spread) * r);
    }
    for (let i = 8; i >= 1; i--) g.fillStyle(0xffc95a, 0.07).fillCircle(cx, cy, px * (0.35 + i * 0.12));
    const key = 'cover:triple';
    if (!this.textures.exists(key)) this.textures.addImage(key, picture);
    // Motion lines behind the outer two, coming in from the sides.
    const lines = this.add.graphics();
    lines.lineStyle(Math.max(2, px * 0.03), 0xfff4e0, 0.55);
    for (const side of [-1, 1]) {
      for (const dy of [-0.18, 0, 0.18]) {
        const x0 = cx + side * px * 1.55;
        lines.lineBetween(x0, cy + dy * px, x0 + side * px * (0.45 - Math.abs(dy)), cy + dy * px);
      }
    }
    const step = px * 0.86;
    for (const [i, angle] of [
      [-1, -12],
      [1, 12],
      [0, 0],
    ] as const) {
      const x = cx + i * step;
      const y = cy + Math.abs(i) * px * 0.06;
      this.add.image(x + px * 0.04, y + px * 0.06, key).setDisplaySize(px, px).setAngle(angle).setTint(0x000000).setAlpha(0.3);
      this.add.image(x, y, key).setDisplaySize(px, px).setAngle(angle);
    }
    this.sparkles({ x: cx - px * 1.4, y: cy - px * 0.7, width: px * 2.8, height: px * 1.4 }, px * 0.9);
  }

  /** A soft golden glow behind something. */
  private glow(rect: { x: number; y: number; width: number; height: number }): void {
    const { x, y, width, height } = rect;
    const g = this.add.graphics();
    for (let i = 6; i >= 1; i--) {
      const pad = i * Math.max(3, width * 0.022);
      g.fillStyle(0xffc95a, 0.07);
      g.fillRoundedRect(x - pad, y - pad, width + pad * 2, height + pad * 2, pad + 6);
    }
  }

  /** Four-pointed sparkles round a rectangle. */
  private sparkles(rect: { x: number; y: number; width: number; height: number }, s: number): void {
    const { x, y, width, height } = rect;
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
      .setShadow(0, Math.round(size * 0.08), '#000000', 0.5, true, true);
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

/** An image from the dev server, decoded. */
function image(url: string): Promise<HTMLImageElement> {
  const picture = new Image();
  picture.src = url;
  return picture.decode().then(() => picture);
}
