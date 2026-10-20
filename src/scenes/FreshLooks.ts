import type * as Phaser from 'phaser';
import { freshOf, type GameState } from '../core';
import { FONTS, FRESH } from '../ui/design/tokens';
import { spoil, type Pixels } from '../ui/art/itemPixels';
import { ITEM_TEXTURE_SIZE, itemTextureKey } from './itemTextures';

/**
 * How fresh foods look (the 'fresh' mechanic, "basi"): made in the game from each item's own texture. A fresh one
 * carries a round badge top left with the moves it has left (light with a dark number; in its last FRESH.warnFrom
 * moves dark with a light number and a brass ring, swelling and shrinking unless motion is reduced). A spoiled one
 * loses most of its colour to a dull olive and has two small flies over it. The colour-blind badge (bottom right)
 * stays on both. Textures are made when first needed and dropped once no item shows them.
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
    if (fresh.spoiled) return this.ensure(`${base}:spoiled`, type, () => this.spoiled(base));
    const warn = fresh.movesLeft <= FRESH.warnFrom;
    const big = warn && pulse === 1;
    return this.ensure(`${base}:fresh:${fresh.movesLeft}${warn ? (big ? ':w1' : ':w0') : ''}`, type, () => this.badged(base, fresh.movesLeft, warn, big));
  }

  /** Drops the textures no item shows any more (`inUse`: the keys sprites show now). */
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

  /** A canvas holding the item's usual front texture. */
  private copy(base: string): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ITEM_TEXTURE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(this.textures.get(base).getSourceImage() as CanvasImageSource, 0, 0, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE);
    return { canvas, context };
  }

  private badged(base: string, moves: number, warn: boolean, big: boolean): HTMLCanvasElement {
    const { canvas, context } = this.copy(base);
    const u = ITEM_TEXTURE_SIZE / 100;
    // Big enough to read at 36 px (about 15 px across there), clear of the colour-blind badge bottom right.
    const r = (big ? 23 : 20.5) * u;
    const cx = 22 * u;
    const cy = 22 * u;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.fillStyle = warn ? FRESH.warnFill : FRESH.fill;
    context.fill();
    context.lineWidth = 4.5 * u;
    context.strokeStyle = warn ? FRESH.warnRing : FRESH.ring;
    context.stroke();
    if (warn) {
      context.beginPath();
      context.arc(cx, cy, r + 3.2 * u, 0, Math.PI * 2);
      context.lineWidth = 2 * u;
      context.strokeStyle = FRESH.ring;
      context.stroke();
    }
    const digits = String(moves);
    context.fillStyle = warn ? FRESH.warnNumber : FRESH.number;
    context.font = `600 ${Math.round((digits.length > 1 ? 24 : 30) * u * (big ? 1.1 : 1))}px ${FONTS.display}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(digits, cx, cy + 1.5 * u);
    return canvas;
  }

  private spoiled(base: string): HTMLCanvasElement {
    const { canvas, context } = this.copy(base);
    const size = ITEM_TEXTURE_SIZE;
    const pixels = context.getImageData(0, 0, size, size);
    context.putImageData(new ImageData(spoil(pixels.data as Pixels) as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);
    // Two small flies over the top: a dark body and two pale wings.
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
    return canvas;
  }
}
