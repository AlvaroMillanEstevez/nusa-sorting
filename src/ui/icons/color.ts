/** Small colour helpers for icon palettes. Every colour is a '#rrggbb' string. */

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mixes two colours: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t);
export const darken = (hex: string, t: number) => mix(hex, '#000000', t);

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Rotates a colour's hue by `degrees`, keeping saturation and lightness. */
export function rotateHue(hex: string, degrees: number): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb((((h + degrees) % 360) + 360) % 360, s, l));
}

export type Vision = 'normal' | 'deuteranopia' | 'protanopia' | 'grayscale';

// Viénot, Brettel & Mollon (1999), applied in linear RGB: how dichromats see a colour.
const CVD: Record<'deuteranopia' | 'protanopia', readonly number[]> = {
  protanopia: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
  deuteranopia: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1],
};

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** Relative luminance (0-1) of a colour, as WCAG defines it. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** CIE L* lightness (0-100): how light a colour looks, in steps that look even. */
export function lightness(hex: string): number {
  const y = luminance(hex);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

/** WCAG contrast ratio between two colours (1-21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** How a colour looks with a colour vision deficiency, or with no colour at all ('grayscale'). */
export function simulateVision(hex: string, vision: Vision): string {
  if (vision === 'normal') return hex;
  if (vision === 'grayscale') {
    const grey = toSrgb(luminance(hex));
    return rgbToHex([grey, grey, grey]);
  }
  const m = CVD[vision];
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  return rgbToHex([
    toSrgb(Math.max(0, m[0]! * r + m[1]! * g + m[2]! * b)),
    toSrgb(Math.max(0, m[3]! * r + m[4]! * g + m[5]! * b)),
    toSrgb(Math.max(0, m[6]! * r + m[7]! * g + m[8]! * b)),
  ]);
}

/** Applies a vision simulation to every '#rrggbb' colour of an SVG document. */
export function simulateSvg(svg: string, vision: Vision): string {
  if (vision === 'normal') return svg;
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => simulateVision(hex.toLowerCase(), vision));
}

/** Euclidean distance between two colours in RGB (0-441): a rough "how different do they look" measure. */
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
