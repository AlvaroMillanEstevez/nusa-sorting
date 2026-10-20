import type * as Phaser from 'phaser';
import { freshOf, type GameState } from '../core';
import { FONTS, FRESH } from '../ui/design/tokens';
import { spoil, type Pixels } from '../ui/art/itemPixels';
import { ITEM_TEXTURE_SIZE, itemTextureKey } from './itemTextures';

/** What a countdown shows: the moves left, the warning, and the warning's swollen half. */
export interface Countdown {
  readonly moves: number;
  readonly warn: boolean;
  readonly big: boolean;
}

/**
 * A fresh food's countdown, drawn on its picture (`size` px square): a paper price tag hung by a thread from near
 * the top left corner, the moves left written on it, tilted down to the right like a tag on a market stall. In its
 * last moves the card turns dark kraft with a light number and a brass edge (and swells and shrinks, see FreshLooks);
 * the states differ in lightness and shape, never by colour alone. The whole tag stays inside the picture, swollen
 * too, so nothing is cut off wherever the item shows.
 */
export function drawCounter(context: CanvasRenderingContext2D, size: number, { moves, warn, big }: Countdown): void {
  const u = size / 100;
  const digits = String(moves);
  const hole = { x: 9 * u, y: 19 * u };
  context.save();
  // The thread, from a pin near the top edge to the tag's hole.
  context.strokeStyle = FRESH.thread;
  context.lineWidth = 1.6 * u;
  context.beginPath();
  context.moveTo(15 * u, 2 * u);
  context.quadraticCurveTo(9 * u, 7 * u, hole.x, hole.y);
  context.stroke();
  context.translate(hole.x, hole.y);
  context.rotate(0.12);
  if (big) context.scale(1.1, 1.1);
  const w = 40 * u;
  const h = 26 * u;
  // The card: a point at the hole's end, a square end.
  context.beginPath();
  context.moveTo(-3 * u, 0);
  context.lineTo(7 * u, -h / 2);
  context.lineTo(w, -h / 2);
  context.lineTo(w, h / 2);
  context.lineTo(7 * u, h / 2);
  context.closePath();
  context.fillStyle = warn ? FRESH.tagWarn : FRESH.tag;
  context.fill();
  context.lineJoin = 'round';
  context.lineWidth = (warn ? 3.6 : 2.2) * u;
  context.strokeStyle = warn ? FRESH.warnRing : FRESH.tagEdge;
  context.stroke();
  // The hole, punched through.
  context.beginPath();
  context.arc(2.6 * u, 0, 2.2 * u, 0, Math.PI * 2);
  context.fillStyle = FRESH.thread;
  context.fill();
  context.fillStyle = warn ? FRESH.warnNumber : FRESH.number;
  context.font = `600 ${Math.round((digits.length > 1 ? 20 : 23) * u)}px ${FONTS.display}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // Written by hand: a touch askew against the card.
  context.rotate(-0.08);
  context.fillText(digits, 24 * u, 1.5 * u);
  context.restore();
}

/** Two small flies over a spoiled item's top: a dark body and two pale wings each. */
export function drawFlies(context: CanvasRenderingContext2D, size: number): void {
  const u = size / 100;
  for (const [x, y, tilt] of [
    [30, 14, -0.4],
    [62, 8, 0.5],
  ] as const) {
    context.save();
    context.translate(x * u, y * u);
    context.rotate(tilt);
    context.fillStyle = FRESH.wing;
    context.globalAlpha = 0.85;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(side * 3.4 * u, -2.6 * u, 3.6 * u, 2.2 * u, side * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.fillStyle = FRESH.fly;
    context.beginPath();
    context.ellipse(0, 0, 2.6 * u, 3.6 * u, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

/** A canvas with an item's picture (any drawable) at `size`, spoiled or with its countdown. */
export function freshCanvas(source: CanvasImageSource, size: number, look: { spoiled: true } | ({ spoiled: false } & Countdown)): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, size, size);
  if (look.spoiled) {
    const pixels = context.getImageData(0, 0, size, size);
    context.putImageData(new ImageData(spoil(pixels.data as Pixels) as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
    drawFlies(context, size);
  } else {
    drawCounter(context, size, look);
  }
  return canvas;
}

/**
 * How fresh foods look in a level: each item's own texture with its countdown (or spoiled), made when first needed
 * and dropped once nothing shows it.
 */
export class FreshLooks {
  /** Textures made, by key, and the type each one belongs to. */
  private readonly made = new Map<string, string>();

  constructor(private readonly textures: Phaser.Textures.TextureManager) {}

  /**
   * The texture an item of `type` shows in front, or null when its usual one is right (not a fresh food, or one
   * whose type is gone). `pulse` is the warning's phase (0 or 1).
   */
  frontKey(state: GameState, type: string, marks: boolean, pulse: 0 | 1): string | null {
    const fresh = freshOf(state, type);
    if (!fresh) return null;
    const base = itemTextureKey(type, marks);
    if (!this.textures.exists(base)) return null;
    const source = () => this.textures.get(base).getSourceImage() as CanvasImageSource;
    if (fresh.spoiled) return this.ensure(`${base}:spoiled`, type, () => freshCanvas(source(), ITEM_TEXTURE_SIZE, { spoiled: true }));
    const warn = fresh.movesLeft <= FRESH.warnFrom;
    const big = warn && pulse === 1;
    return this.ensure(`${base}:fresh:${fresh.movesLeft}${warn ? (big ? ':w1' : ':w0') : ''}`, type, () =>
      freshCanvas(source(), ITEM_TEXTURE_SIZE, { spoiled: false, moves: fresh.movesLeft, warn, big }),
    );
  }

  /** Drops the textures nothing shows any more (`inUse`: the keys on screen now). */
  purge(inUse: ReadonlySet<string>): void {
    for (const key of [...this.made.keys()]) {
      if (inUse.has(key)) continue;
      this.made.delete(key);
      if (this.textures.exists(key)) this.textures.remove(key);
    }
  }

  private ensure(key: string, type: string, make: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) {
      this.textures.addImage(key, make() as unknown as HTMLImageElement);
      this.made.set(key, type);
    }
    return key;
  }
}
