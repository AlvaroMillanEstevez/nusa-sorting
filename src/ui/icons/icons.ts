import { ITEM_KINDS, parseItemType, VARIANTS, type ColorFamily, type ItemKind, type Variant } from '../../data/itemCatalog';
import { darken, hexToRgb, lighten, mix, rotateHue } from './color';

/**
 * Item icons as SVG templates (viewBox 0 0 100 100). Each template paints named MATERIALS (e.g. 'meat',
 * 'stick'); a palette gives each material a base colour and the template derives its light and dark shades.
 * Colour variants are alternative palettes (tinted materials change hue, neutral ones keep theirs), plus a
 * corner badge that does not rely on colour. Two candidate styles share the same geometry.
 */

export type IconStyle = 'outlined' | 'soft';
export const ICON_STYLES: readonly IconStyle[] = ['outlined', 'soft'];

export type Palette = Readonly<Record<string, string>>;

/** Drawing helpers handed to a template: fills and outlines for a material, in the current style. */
export interface Paint {
  /** Shaded fill (gradient) for a material. */
  fill(material: string): string;
  flat(material: string): string;
  light(material: string): string;
  dark(material: string): string;
  /** Outline attributes for a material in this style (` stroke="..." stroke-width="..."`). */
  edge(material: string, scale?: number): string;
  /** A glossy highlight. */
  shine(cx: number, cy: number, rx: number, ry: number, rotate?: number): string;
}

export interface IconTemplate {
  readonly palette: Palette;
  /** Materials whose hue changes in the alternative variants; the rest (sticks, glass, seeds) stay as they are. */
  readonly tinted: readonly string[];
  draw(p: Paint): string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A spiky outline: alternating outer and inner points around (cx, cy). */
function spikes(cx: number, cy: number, outer: number, inner: number, count: number): string {
  return Array.from({ length: count * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / count - Math.PI / 2;
    return `${r1(cx + Math.cos(a) * r)},${r1(cy + Math.sin(a) * r)}`;
  }).join(' ');
}

export const ICON_TEMPLATES: Readonly<Record<string, IconTemplate>> = {
  // Three glazed chunks on a skewer, corner to corner.
  sate: {
    palette: { meat: '#8a4a26', stick: '#e6c48c' },
    tinted: ['meat'],
    draw: (p) => `
      <rect x="-3.5" y="-46" width="7" height="92" rx="3.5" transform="translate(50 50) rotate(45)" fill="${p.fill('stick')}"${p.edge('stick', 0.6)}/>
      ${[
        [31, 69],
        [50, 50],
        [69, 31],
      ]
        .map(
          ([x, y]) =>
            `<rect x="-13" y="-11" width="26" height="22" rx="8" transform="translate(${x} ${y}) rotate(45)" fill="${p.fill('meat')}"${p.edge('meat')}/>` +
            p.shine(x! - 4, y! - 5, 5, 2.6, -45),
        )
        .join('')}`,
  },
  // A diamond of woven palm leaves with a leaf tail on top.
  ketupat: {
    palette: { leaf: '#5fa83a' },
    tinted: ['leaf'],
    draw: (p) => `
      <path d="M50 14 Q60 3 74 6" fill="none" stroke="${p.dark('leaf')}" stroke-width="5" stroke-linecap="round"/>
      <polygon points="50,12 88,50 50,88 12,50" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
      <polygon points="50,24 76,50 50,76 24,50" fill="none" stroke="${p.light('leaf')}" stroke-width="3" opacity="0.8"/>
      <path d="M31 31 L69 69 M69 31 L31 69" stroke="${p.dark('leaf')}" stroke-width="3.5" opacity="0.55"/>
      ${p.shine(38, 34, 8, 3.5, -45)}`,
  },
  // A round red fruit with a spiky skin.
  rambutan: {
    palette: { skin: '#d83a32' },
    tinted: ['skin'],
    draw: (p) => `
      <polygon points="${spikes(50, 52, 40, 32, 16)}" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <circle cx="50" cy="52" r="27" fill="${p.light('skin')}" opacity="0.35"/>
      ${p.shine(40, 40, 9, 5, -30)}`,
  },
  // A tall glass of amber tea with ice and a straw.
  'es-teh-manis': {
    palette: { tea: '#d9822b', glass: '#dcefff', straw: '#e8453c' },
    tinted: ['tea'],
    draw: (p) => `
      <rect x="57" y="4" width="7" height="50" rx="3" transform="rotate(12 60 30)" fill="${p.fill('straw')}"${p.edge('straw', 0.6)}/>
      <path d="M26 16 L74 16 L67 88 L33 88 Z" fill="${p.flat('glass')}" opacity="0.75"${p.edge('glass', 0.8)}/>
      <path d="M29 34 L71 34 L66.5 84 L33.5 84 Z" fill="${p.fill('tea')}"/>
      <rect x="35" y="30" width="14" height="13" rx="3" transform="rotate(-12 42 36)" fill="#f4fbff" opacity="0.85"/>
      <rect x="51" y="33" width="13" height="12" rx="3" transform="rotate(14 57 39)" fill="#f4fbff" opacity="0.75"/>
      <ellipse cx="50" cy="16" rx="24" ry="4" fill="${p.light('glass')}" opacity="0.9"/>
      ${p.shine(33, 56, 3, 16, 4)}`,
  },
  // A golden fried ball covered in sesame seeds.
  'onde-onde': {
    palette: { dough: '#e3a334', seed: '#fff4d6' },
    tinted: ['dough'],
    draw: (p) => `
      <circle cx="50" cy="52" r="36" fill="${p.fill('dough')}"${p.edge('dough')}/>
      ${[
        [36, 36, -30],
        [55, 30, 10],
        [70, 44, 50],
        [30, 56, -60],
        [47, 50, 20],
        [64, 62, -20],
        [42, 70, 70],
        [58, 76, 0],
        [74, 58, 80],
      ]
        .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2" transform="rotate(${a} ${x} ${y})" fill="${p.flat('seed')}"/>`)
        .join('')}
      ${p.shine(38, 38, 10, 5, -35)}`,
  },
  // A deep purple fruit with a green crown of four sepals and a short stem.
  manggis: {
    palette: { skin: '#5a2468', calyx: '#4e9a3a', stem: '#7a4a24' },
    tinted: ['skin'],
    draw: (p) => `
      <circle cx="50" cy="56" r="34" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <rect x="47" y="10" width="6" height="14" rx="3" fill="${p.fill('stem')}"/>
      ${[-60, -20, 20, 60]
        .map((a) => `<ellipse cx="50" cy="28" rx="7" ry="12" transform="rotate(${a} 50 32)" fill="${p.fill('calyx')}"${p.edge('calyx', 0.7)}/>`)
        .join('')}
      ${p.shine(38, 48, 9, 5, -30)}`,
  },
};

/** Kinds that have a drawn icon; the rest use a placeholder for now. */
export const DRAWN_KINDS: readonly string[] = Object.keys(ICON_TEMPLATES);

// ---------------------------------------------------------------- variants

const ALT_TINTS = ['#2f7fe0', '#2aa36a'];

/**
 * Colour of a tinted material in a variant. Saturated colours rotate their hue (+120°, +240°); greyish ones
 * (creams, browns) are pulled towards a strong colour instead, since rotating their hue would barely show.
 */
export function variantColor(base: string, variant: Variant): string {
  const index = VARIANTS.indexOf(variant);
  if (index === 0) return base;
  const [r, g, b] = hexToRgb(base);
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
  return saturation < 0.3 ? mix(base, ALT_TINTS[index - 1]!, 0.6) : rotateHue(base, 120 * index);
}

export function variantPalette(template: IconTemplate, variant: Variant): Palette {
  return Object.fromEntries(
    Object.entries(template.palette).map(([material, color]) => [
      material,
      template.tinted.includes(material) ? variantColor(color, variant) : color,
    ]),
  );
}

/** Colour-free badge in the bottom-right corner: none for the original, a dot for alt1, a triangle for alt2. */
function variantBadge(variant: Variant): string {
  if (variant === 'original') return '';
  const mark =
    variant === 'alt1'
      ? '<circle cx="80" cy="80" r="5" fill="#1d2630"/>'
      : '<polygon points="80,73.5 86.5,85 73.5,85" fill="#1d2630"/>';
  return `<circle cx="80" cy="80" r="13" fill="#ffffff" stroke="#1d2630" stroke-width="3"/>${mark}`;
}

// ---------------------------------------------------------------- rendering

function paintFor(palette: Palette, style: IconStyle, defs: string[]): Paint {
  const color = (m: string) => palette[m] ?? '#888888';
  const gradients = new Set<string>();
  const fill = (m: string) => {
    const id = `g-${m}`;
    if (!gradients.has(id)) {
      gradients.add(id);
      const base = color(m);
      defs.push(
        style === 'outlined'
          ? `<linearGradient id="${id}" x1="0" y1="0" x2="0.3" y2="1">` +
              `<stop offset="0" stop-color="${lighten(base, 0.45)}"/><stop offset="0.5" stop-color="${base}"/>` +
              `<stop offset="1" stop-color="${darken(base, 0.35)}"/></linearGradient>`
          : `<radialGradient id="${id}" cx="0.35" cy="0.3" r="0.8">` +
              `<stop offset="0" stop-color="${lighten(base, 0.5)}"/><stop offset="0.55" stop-color="${base}"/>` +
              `<stop offset="1" stop-color="${darken(base, 0.22)}"/></radialGradient>`,
      );
    }
    return `url(#${id})`;
  };
  return {
    fill,
    flat: color,
    light: (m) => lighten(color(m), 0.45),
    dark: (m) => darken(color(m), 0.4),
    edge: (m, scale = 1) =>
      style === 'outlined'
        ? ` stroke="${darken(color(m), 0.62)}" stroke-width="${r1(3.4 * scale)}" stroke-linejoin="round"`
        : ` stroke="${darken(color(m), 0.25)}" stroke-width="${r1(1.4 * scale)}" stroke-opacity="0.55" stroke-linejoin="round"`,
    shine: (cx, cy, rx, ry, rotate = 0) =>
      style === 'outlined'
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})" fill="#ffffff" opacity="0.75"/>`
        : `<ellipse cx="${cx}" cy="${cy}" rx="${r1(rx * 1.3)}" ry="${r1(ry * 1.3)}" transform="rotate(${rotate} ${cx} ${cy})" fill="url(#shine)"/>`,
  };
}

function svgDocument(defs: string[], body: string): string {
  const base =
    '<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.35"/>' +
    '<stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="shine" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/>' +
    '<stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<defs>${base}${defs.join('')}</defs>` +
    // Soft shadow underneath.
    `<ellipse cx="50" cy="91" rx="34" ry="6" fill="url(#shadow)"/>` +
    `${body}</svg>`
  );
}

/** SVG for a drawn kind in a variant and style. */
export function renderIcon(kindId: string, variant: Variant, style: IconStyle): string {
  const template = ICON_TEMPLATES[kindId];
  if (!template) throw new Error(`no icon for ${kindId}`);
  const defs: string[] = [];
  const paint = paintFor(variantPalette(template, variant), style, defs);
  const body = template.draw(paint).replace(/\s*\n\s*/g, '');
  return svgDocument(defs, body + variantBadge(variant));
}

// ---------------------------------------------------------------- placeholders

/** Base colour of each colour family, for placeholders. */
const FAMILY_COLORS: Readonly<Record<ColorFamily, string>> = {
  red: '#d83a32',
  orange: '#e8832a',
  yellow: '#e8c22a',
  green: '#4e9a3a',
  brown: '#8a5a32',
  cream: '#e6d2a6',
  purple: '#7a3a9a',
  pink: '#e98aa8',
  white: '#eef2f4',
};

export const PLACEHOLDER_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'pentagon', 'star', 'drop'] as const;
export type PlaceholderShape = (typeof PLACEHOLDER_SHAPES)[number];

/** Shape, colour family and initial of a kind's placeholder: together they tell all 26 kinds apart. */
export function placeholderLook(kind: ItemKind): { shape: PlaceholderShape; color: string; initial: string } {
  const index = ITEM_KINDS.findIndex((k) => k.id === kind.id);
  return {
    shape: PLACEHOLDER_SHAPES[index % PLACEHOLDER_SHAPES.length]!,
    color: FAMILY_COLORS[kind.colorFamily],
    initial: kind.name.id[0]!.toUpperCase(),
  };
}

function placeholderShape(shape: PlaceholderShape, fill: string, edge: string): string {
  const poly = (sides: number, rotation: number) =>
    Array.from({ length: sides }, (_, i) => {
      const a = rotation + (2 * Math.PI * i) / sides;
      return `${r1(50 + Math.cos(a) * 38)},${r1(50 + Math.sin(a) * 38)}`;
    }).join(' ');
  switch (shape) {
    case 'circle':
      return `<circle cx="50" cy="50" r="37" fill="${fill}"${edge}/>`;
    case 'square':
      return `<rect x="17" y="17" width="66" height="66" rx="12" fill="${fill}"${edge}/>`;
    case 'triangle':
      return `<polygon points="${poly(3, -Math.PI / 2)}" transform="translate(0 6)" fill="${fill}"${edge}/>`;
    case 'diamond':
      return `<polygon points="${poly(4, -Math.PI / 2)}" fill="${fill}"${edge}/>`;
    case 'hexagon':
      return `<polygon points="${poly(6, 0)}" fill="${fill}"${edge}/>`;
    case 'pentagon':
      return `<polygon points="${poly(5, -Math.PI / 2)}" fill="${fill}"${edge}/>`;
    case 'star':
      return `<polygon points="${spikes(50, 52, 40, 18, 5)}" fill="${fill}"${edge}/>`;
    case 'drop':
      return `<path d="M50 10 C64 32 80 46 80 62 A30 30 0 0 1 20 62 C20 46 36 32 50 10 Z" fill="${fill}"${edge}/>`;
  }
}

/** Provisional icon for kinds without art yet: shape + colour + initial, with the same variant badges. */
export function renderPlaceholder(kindId: string, variant: Variant): string {
  const kind = ITEM_KINDS.find((k) => k.id === kindId);
  if (!kind) throw new Error(`unknown kind ${kindId}`);
  const look = placeholderLook(kind);
  const color = variantColor(look.color, variant);
  const defs: string[] = [];
  const paint = paintFor({ body: color }, 'outlined', defs);
  const light = hexToRgb(color).reduce((a, b) => a + b, 0) > 520;
  const letter =
    `<text x="50" y="${look.shape === 'triangle' ? 66 : 62}" text-anchor="middle" font-family="Arial, sans-serif" ` +
    `font-weight="700" font-size="34" fill="${light ? '#1d2630' : '#ffffff'}">${look.initial}</text>`;
  return svgDocument(defs, placeholderShape(look.shape, paint.fill('body'), paint.edge('body')) + letter + variantBadge(variant));
}

/** SVG for any item type id: its drawn icon if there is one, otherwise its placeholder. */
export function renderItemSvg(type: string, style: IconStyle): string {
  const parsed = parseItemType(type);
  if (!parsed) throw new Error(`unknown item type ${type}`);
  return ICON_TEMPLATES[parsed.kind.id]
    ? renderIcon(parsed.kind.id, parsed.variant, style)
    : renderPlaceholder(parsed.kind.id, parsed.variant);
}
