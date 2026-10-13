/**
 * What the game derives from each item's picture (src/assets/art/items, see tools/art/build_game_art.py), on raw
 * RGBA pixels: the warm halo behind dark items, the silhouette of an item seen behind another one, and the colour
 * variants. Pure functions on square `size` × `size` pixel arrays (no canvas), so they are tested directly.
 */

export type Pixels = Uint8ClampedArray;

/** Where a pixel counts as part of the item (its soft shadow does not). */
const SOLID = 128;

/**
 * Approximate Euclidean distance (in px) from every pixel to the nearest solid one, 0 inside: a two-pass chamfer
 * transform (3-4 weights), enough for soft edges a few pixels wide.
 */
export function distanceOutside(px: Pixels, size: number): Float32Array {
  const far = 1e6;
  const d = new Float32Array(size * size);
  for (let i = 0; i < d.length; i++) d[i] = px[i * 4 + 3]! >= SOLID ? 0 : far;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= size || y >= size ? far : d[y * size + x]!);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  for (let y = size - 1; y >= 0; y--) {
    for (let x = size - 1; x >= 0; x--) {
      const i = y * size + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i]! / 3;
  return d;
}

/** Smooth step from 0 (at `a`) to 1 (at `b`). */
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Puts `top` over `bottom` (straight alpha), in place in `bottom`. */
function over(bottom: Pixels, top: Pixels): void {
  for (let i = 0; i < bottom.length; i += 4) {
    const ta = top[i + 3]! / 255;
    if (ta === 0) continue;
    const ba = bottom[i + 3]! / 255;
    const a = ta + ba * (1 - ta);
    for (let c = 0; c < 3; c++) bottom[i + c] = (top[i + c]! * ta + bottom[i + c]! * ba * (1 - ta)) / a;
    bottom[i + 3] = a * 255;
  }
}

/**
 * The warm halo of dark items: a soft light just behind the outline, following the silhouette, so a dark item
 * stands out from the shelf's dark back wall without lightening the wall (which would take contrast from every
 * mid-tone item). Sizes are for a 256 px picture and scale with `size`.
 */
export const HALO = { color: [0xff, 0xd2, 0x94] as const, radius: 8, softness: 2.8, alpha: 0.85 };

export function withHalo(px: Pixels, size: number): Pixels {
  const k = size / 256;
  const d = distanceOutside(px, size);
  const glow = new Uint8ClampedArray(px.length);
  const r = HALO.radius * k;
  const soft = HALO.softness * k;
  for (let i = 0; i < d.length; i++) {
    const a = HALO.alpha * (1 - smooth(r - 2 * soft, r + 2 * soft, d[i]!));
    if (a <= 0) continue;
    glow[i * 4] = HALO.color[0];
    glow[i * 4 + 1] = HALO.color[1];
    glow[i * 4 + 2] = HALO.color[2];
    glow[i * 4 + 3] = a * 255;
  }
  over(glow, px);
  return glow;
}

/** Flat colour of a silhouette, and of the thin rim that lifts it off the dark wood (as the drawn icons had). */
export const SILHOUETTE_FILL = [0x1e, 0x13, 0x0b] as const;
export const SILHOUETTE_RIM = [0x8c, 0x6a, 0x48] as const;
/** Width of the rim, in px of a 256 px picture. */
const RIM = 5;

/**
 * What an item looks like from behind another one: its exact shape in one flat dark tone, without colour or inner
 * detail or its soft shadow, with a thin lighter rim so it stands out on the shelf's dark wood. The shape is shown
 * on purpose, so players can plan.
 */
export function silhouette(px: Pixels, size: number): Pixels {
  const rim = RIM * (size / 256);
  const d = distanceOutside(px, size);
  const out = new Uint8ClampedArray(px.length);
  for (let i = 0; i < d.length; i++) {
    // Inside, the shape's own edge stays soft; the rim fades out over its last pixel.
    const inside = smooth(64, 192, px[i * 4 + 3]!);
    const ring = 1 - smooth(rim - 1, rim, d[i]!);
    const a = Math.max(inside, ring);
    if (a <= 0) continue;
    const c = inside >= ring ? SILHOUETTE_FILL : SILHOUETTE_RIM;
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = a * 255;
  }
  return out;
}

// ---------------------------------------------------------------- colour variants

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** Signed shortest turn from hue a to hue b, in degrees (-180 to 180). */
const turn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/** How a variant recolours an item: the hue its main colour moves to, and a lightness change (HSL, -1 to 1). */
export interface VariantShift {
  readonly hue: number;
  readonly lightness: number;
}

/**
 * The two variants of an item whose main colour is `hue` (degrees). Variants differ above all along the
 * blue-yellow axis and in lightness, what colour-blind players still see: alt1 goes blue (or orange, for items
 * already bluish), alt2 goes yellow and lighter (or deep red and darker, for items already yellow).
 */
export function variantShifts(hue: number): { alt1: VariantShift; alt2: VariantShift } {
  const h = ((hue % 360) + 360) % 360;
  const bluish = h >= 150 && h <= 270;
  const yellowish = h >= 30 && h <= 80;
  return {
    alt1: bluish ? { hue: 28, lightness: 0.04 } : { hue: 212, lightness: -0.04 },
    alt2: yellowish ? { hue: 352, lightness: -0.12 } : { hue: 52, lightness: 0.12 },
  };
}

/** Items with less than this share of their pixels in their main colour are recoloured all over, more gently. */
const MAIN_SHARE = 0.15;
/** Hues within this many degrees of the main one move fully; the effect fades out by twice as far. */
const ZONE = 22;

/**
 * An item's colour variant: the pixels around its main hue (`hue`, covering `share` of the item) turn towards the
 * variant's hue, keeping their own shading, and lighten or darken; greys, whites and other colours stay. Items
 * with no clear main colour (white, cream, grey) are tinted all over instead, more gently.
 */
export function recolour(px: Pixels, hue: number, share: number, shift: VariantShift): Pixels {
  const out = new Uint8ClampedArray(px);
  const all = share < MAIN_SHARE;
  const rotate = turn(hue, shift.hue);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(out[i]! / 255, out[i + 1]! / 255, out[i + 2]! / 255);
    let w: number;
    let nh: number;
    let ns = s;
    if (all) {
      // Tint: everything but the darkest and lightest tones takes the variant's hue, softly.
      w = 0.55 * smooth(0.08, 0.2, l) * (1 - smooth(0.85, 0.97, l));
      nh = shift.hue;
      ns = Math.max(s, 0.45);
    } else {
      w = smooth(0.12, 0.3, s) * (1 - smooth(ZONE, ZONE * 2, Math.abs(turn(hue, h))));
      nh = h + rotate;
    }
    if (w <= 0) continue;
    const nl = Math.min(1, Math.max(0, l + shift.lightness * w));
    const [r, g, b] = hslToRgb((((nh % 360) + 360) % 360), ns, nl);
    out[i] = (out[i]! / 255 + (r - out[i]! / 255) * w) * 255;
    out[i + 1] = (out[i + 1]! / 255 + (g - out[i + 1]! / 255) * w) * 255;
    out[i + 2] = (out[i + 2]! / 255 + (b - out[i + 2]! / 255) * w) * 255;
  }
  return out;
}

// ---------------------------------------------------------------- vision simulation (gallery)

// Viénot, Brettel & Mollon (1999), applied in linear RGB, as ui/icons/color.ts.
const CVD: Record<'deuteranopia' | 'protanopia', readonly number[]> = {
  protanopia: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
  deuteranopia: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1],
};
const lin = (v: number) => (v <= 0.04045 * 255 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const srgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);

/** How an item looks with a colour vision deficiency, or with no colour at all ('grayscale'). */
export function simulatePixels(px: Pixels, vision: 'deuteranopia' | 'protanopia' | 'grayscale'): Pixels {
  const out = new Uint8ClampedArray(px);
  for (let i = 0; i < out.length; i += 4) {
    const r = lin(out[i]!);
    const g = lin(out[i + 1]!);
    const b = lin(out[i + 2]!);
    if (vision === 'grayscale') {
      out[i] = out[i + 1] = out[i + 2] = srgb(0.2126 * r + 0.7152 * g + 0.0722 * b);
      continue;
    }
    const m = CVD[vision];
    out[i] = srgb(m[0]! * r + m[1]! * g + m[2]! * b);
    out[i + 1] = srgb(m[3]! * r + m[4]! * g + m[5]! * b);
    out[i + 2] = srgb(m[6]! * r + m[7]! * g + m[8]! * b);
  }
  return out;
}
