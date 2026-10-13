import { describe, expect, it } from 'vitest';
import { ITEM_KINDS } from '../src/data/itemCatalog';
import { WOOD } from '../src/ui/art/wood';
import {
  colorDistance,
  contrastRatio,
  hexToRgb,
  lightness,
  rotateHue,
  simulateSvg,
  simulateVision,
} from '../src/ui/icons/color';
import { ITEM_ART, ITEM_PICTURE_SIZE } from '../src/ui/art/itemArt';
import { recolour, silhouette, SILHOUETTE_FILL, SILHOUETTE_RIM, simulatePixels, variantShifts, withHalo, type Pixels } from '../src/ui/art/itemPixels';

describe('colour helpers', () => {
  it('rotates hues and keeps greys', () => {
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00');
    expect(rotateHue('#ff0000', 240)).toBe('#0000ff');
    expect(rotateHue('#808080', 120)).toBe('#808080');
  });

  it('simulates colour blindness: greys stay, red and green collapse', () => {
    for (const vision of ['deuteranopia', 'protanopia'] as const) {
      expect(colorDistance(simulateVision('#ffffff', vision), '#ffffff')).toBeLessThan(3);
      expect(colorDistance(simulateVision('#808080', vision), '#808080')).toBeLessThan(3);
      const red = simulateVision('#d83a32', vision);
      const green = simulateVision('#4e9a3a', vision);
      expect(colorDistance(red, green)).toBeLessThan(colorDistance('#d83a32', '#4e9a3a') / 2);
    }
    expect(simulateVision('#d83a32', 'normal')).toBe('#d83a32');
  });

  it('turns colours into greys of the same luminance', () => {
    const [r, g, b] = hexToRgb(simulateVision('#d83a32', 'grayscale'));
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(Math.abs(lightness(simulateVision('#d83a32', 'grayscale')) - lightness('#d83a32'))).toBeLessThan(1);
    expect(simulateVision('#ffffff', 'grayscale')).toBe('#ffffff');
  });

  it('measures lightness and contrast', () => {
    expect(lightness('#000000')).toBe(0);
    expect(lightness('#ffffff')).toBeCloseTo(100);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('rewrites every colour of an SVG', () => {
    const svg = '<svg><circle fill="#FF0000"/><rect stroke="#00ff00"/></svg>';
    const out = simulateSvg(svg, 'deuteranopia');
    expect(out).not.toContain('#FF0000');
    expect(out).not.toContain('#00ff00');
    expect(out.match(/#[0-9a-f]{6}/g)).toHaveLength(2);
  });
});

const hex = (c: readonly [number, number, number]) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** A test picture: `size` px, a disc of `color` in the middle (radius `r`), and a faint shadow strip under it. */
function disc(size: number, r: number, color: readonly [number, number, number]): Pixels {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (Math.hypot(x - size / 2, y - size / 2) <= r) {
        px.set([...color, 255], i);
      } else if (y > size * 0.9) {
        px.set([0, 0, 0, 60], i);
      }
    }
  return px;
}
const at = (px: Pixels, size: number, x: number, y: number) => Array.from(px.slice((y * size + x) * 4, (y * size + x) * 4 + 4));

/** The pictures in the assets folder. */
const PICTURES = Object.keys(import.meta.glob('../src/assets/art/items/*.webp'));

describe('the illustrated items', () => {
  it('has a picture and its measures for every kind of the catalogue', () => {
    expect(Object.keys(ITEM_ART).sort()).toEqual(ITEM_KINDS.map((k) => k.id).sort());
    for (const [kind, art] of Object.entries(ITEM_ART)) {
      expect(PICTURES, kind).toContain(`../src/assets/art/items/${kind}.webp`);
      const [left, top, right, bottom] = art.bounds;
      expect(left, kind).toBeGreaterThanOrEqual(0);
      expect(right, kind).toBeLessThanOrEqual(100);
      expect(right - left, kind).toBeGreaterThan(20);
      expect(bottom - top, kind).toBeGreaterThan(20);
      // Every picture rests near the same bottom margin (its soft shadow, left out of the bounds, sits on it).
      expect(bottom, kind).toBeGreaterThan(85);
      expect(art.hue).toBeGreaterThanOrEqual(0);
      expect(art.hue).toBeLessThan(360);
    }
    expect(ITEM_PICTURE_SIZE).toBeGreaterThanOrEqual(128);
  });

  it('gives the warm halo to the dark items of the review, and only to them', () => {
    const dark = Object.entries(ITEM_ART)
      .filter(([, art]) => art.halo)
      .map(([kind]) => kind)
      .sort();
    expect(dark).toEqual(
      ['batik', 'blangkon', 'cengkeh', 'gado-gado', 'gong', 'gubuk', 'ikan-bakar', 'kayu-manis', 'komodo', 'lada', 'manggis', 'mie-goreng', 'panjat-pinang', 'peci', 'peluit', 'raket', 'salak', 'yoyo'].sort(),
    );
  });
});

describe('item pixels', () => {
  const size = 64;
  const dark: [number, number, number] = [40, 30, 25];

  it('puts the halo just outside the outline, warm and fading, and leaves the item as it was', () => {
    const plain = disc(size, 16, dark);
    const lit = withHalo(plain, size);
    // The item itself is untouched.
    expect(at(lit, size, 32, 32)).toEqual([...dark, 255]);
    // Right outside it, a warm light; far away, nothing.
    const near = at(lit, size, 32 + 17, 32);
    expect(near[3]).toBeGreaterThan(100);
    expect(near[0]).toBeGreaterThan(near[2]!);
    expect(at(lit, size, 2, 2)[3]).toBe(0);
  });

  it('turns an item into its flat dark shape with a lighter rim, without its colours or its soft shadow', () => {
    const shape = silhouette(disc(size, 16, [220, 60, 40]), size);
    expect(at(shape, size, 32, 32)).toEqual([...SILHOUETTE_FILL, 255]);
    // A rim right outside the outline (rims are about 5 px at 256, so about 1 px here).
    const rim = at(shape, size, 32 + 17, 32);
    expect(rim.slice(0, 3)).toEqual([...SILHOUETTE_RIM]);
    expect(rim[3]).toBeGreaterThan(0);
    // The faint shadow under the item is gone.
    expect(at(shape, size, 32, 62)[3]).toBe(0);
    // Dark, but its rim stands out from the shelf wall.
    expect(lightness(hex(SILHOUETTE_FILL))).toBeLessThan(lightness(WOOD.wall));
    expect(contrastRatio(hex(SILHOUETTE_RIM), WOOD.wall)).toBeGreaterThan(2);
  });

  it('makes variants bluer (alt1) and yellower and lighter (alt2), keeping greys and the shape', () => {
    const red = disc(size, 16, [200, 50, 40]);
    // A grey corner, outside the main colour.
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) red.set([128, 128, 128, 255], (y * size + x) * 4);
    const shifts = variantShifts(5);
    const alt1 = recolour(red, 5, 0.8, shifts.alt1);
    const alt2 = recolour(red, 5, 0.8, shifts.alt2);
    const [r1, , b1] = at(alt1, size, 32, 32);
    const [, g2] = at(alt2, size, 32, 32);
    expect(b1!).toBeGreaterThan(r1!);
    expect(g2!).toBeGreaterThan(150);
    expect(lightness(hex(at(alt2, size, 32, 32).slice(0, 3) as [number, number, number]))).toBeGreaterThan(lightness('#c83228'));
    expect(at(alt1, size, 2, 2)).toEqual([128, 128, 128, 255]);
    expect(at(alt1, size, 32, 32)[3]).toBe(255);
    expect(at(alt1, size, 32, 62)).toEqual(at(red, size, 32, 62));
  });

  it('picks other directions for items already blue or yellow', () => {
    expect(variantShifts(220).alt1.hue).toBeLessThan(60);
    expect(variantShifts(55).alt2.hue).toBeGreaterThan(300);
    expect(variantShifts(5).alt1.hue).toBeGreaterThan(180);
  });

  it('simulates colour blindness on pictures as on single colours', () => {
    const px = disc(8, 3, [216, 58, 50]);
    for (const vision of ['deuteranopia', 'protanopia', 'grayscale'] as const) {
      const seen = at(simulatePixels(px, vision), 8, 4, 4).slice(0, 3) as [number, number, number];
      expect(colorDistance(hex(seen), simulateVision('#d83a32', vision))).toBeLessThan(3);
    }
  });
});
