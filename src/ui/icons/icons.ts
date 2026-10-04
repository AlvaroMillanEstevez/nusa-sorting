import { ITEM_KINDS, parseItemType, type ColorFamily, type ItemKind, type Variant } from '../../data/itemCatalog';
import { darken, hexToRgb, lighten, mix } from './color';

/**
 * Item icons as SVG templates (viewBox 0 0 100 100). Each template paints named MATERIALS (e.g. 'meat',
 * 'stick'); a palette gives each material a base colour and the template derives three shading tones, a fine
 * outline in a dark tone of the material itself and a specular highlight from it.
 *
 * Colour variants are hand-picked alternative colours for a few materials, chosen to differ above all in
 * lightness and along the blue-yellow axis (what colour-blind players still see), plus a corner badge that
 * does not rely on colour at all.
 */

export type Palette = Readonly<Record<string, string>>;

/** Drawing helpers handed to a template. */
export interface Paint {
  /** Three-tone linear shading (light top-left, base, shade bottom-right). */
  fill(material: string): string;
  /** Three-tone radial shading, for round things. */
  ball(material: string): string;
  flat(material: string): string;
  light(material: string): string;
  shade(material: string): string;
  /** The material's outline colour: a dark tone of the material, never black. */
  line(material: string): string;
  /** Outline attributes (` stroke="…" stroke-width="…"`). */
  edge(material: string, width?: number): string;
  /** A specular highlight: a bright core in a soft halo. */
  spec(cx: number, cy: number, rx: number, ry: number, rotate?: number): string;
}

export interface IconTemplate {
  readonly palette: Palette;
  /** Hand-picked colours of the alternative variants; materials not listed keep their colour. */
  readonly variants: { readonly alt1: Palette; readonly alt2: Palette };
  draw(p: Paint): string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const OUTLINE = 2.4;

/** A star-like outline around an ellipse: `count` points pushed out by `spike` (a fraction of the radius). */
function spikyEllipse(cx: number, cy: number, rx: number, ry: number, count: number, spike: number): string {
  return Array.from({ length: count * 2 }, (_, i) => {
    const k = i % 2 === 0 ? 1 + spike : 1;
    const a = (Math.PI * i) / count - Math.PI / 2;
    return `${r1(cx + Math.cos(a) * rx * k)},${r1(cy + Math.sin(a) * ry * k)}`;
  }).join(' ');
}

/** An oval with a scalloped, irregular edge (a puffed cracker seen slightly from above). */
function wavyDisc(cx: number, cy: number, rx: number, ry: number, bumps: number, amp: number): string {
  const at = (k: number, a: number) => `${r1(cx + Math.cos(a) * rx * k)} ${r1(cy + Math.sin(a) * ry * k)}`;
  const parts = [`M${at(1 - amp, 0)}`];
  for (let i = 0; i < bumps; i++) {
    const wobble = 1 + 0.09 * Math.sin(i * 2.3) + 0.05 * Math.cos(i * 4.1);
    const mid = ((i + 0.5) / bumps) * 2 * Math.PI;
    const end = ((i + 1) / bumps) * 2 * Math.PI;
    parts.push(`Q${at((1 + amp) * wobble, mid)} ${at(1 - amp * (0.6 + 0.4 * Math.sin(i * 1.7)), end)}`);
  }
  return parts.join(' ') + 'Z';
}

export const ICON_TEMPLATES: Readonly<Record<string, IconTemplate>> = {
  // Two skewers of grilled chunks with grill marks, under a drizzle of peanut sauce.
  sate: {
    palette: { meat: '#a65d2c', stick: '#e2c48e', sauce: '#c98a3a' },
    variants: { alt1: { meat: '#86a3dc' }, alt2: { meat: '#f2d47e' } },
    draw: (p) => {
      const skewer = (y: number, xs: number[]) =>
        `<rect x="-38" y="${y - 2.4}" width="74" height="4.8" rx="2.4" fill="${p.fill('stick')}"${p.edge('stick', 1.6)}/>` +
        `<polygon points="36,${y - 2.4} 43,${y} 36,${y + 2.4}" fill="${p.flat('stick')}"${p.edge('stick', 1.4)}/>` +
        xs
          .map(
            (x) =>
              `<rect x="${x - 8.5}" y="${y - 11}" width="17" height="22" rx="6.5" fill="${p.fill('meat')}"${p.edge('meat')}/>` +
              `<path d="M${x - 4} ${y - 7} L${x - 1} ${y + 7} M${x + 3} ${y - 8} L${x + 6} ${y + 4}" stroke="${p.line('meat')}" stroke-width="2.8" stroke-linecap="round" opacity="0.75"/>` +
              p.spec(x - 3.5, y - 6, 2.4, 1.5),
          )
          .join('');
      const drizzle = 'M-26 7 Q-12 2 2 7 T28 6';
      return `<g transform="translate(50 50) rotate(-30)">
        ${skewer(-11, [-20, -2, 16])}
        ${skewer(12, [-14, 4, 22])}
        <path d="${drizzle}" fill="none" stroke="${p.line('sauce')}" stroke-width="9.5" stroke-linecap="round"/>
        <path d="${drizzle}" fill="none" stroke="${p.flat('sauce')}" stroke-width="6.8" stroke-linecap="round"/>
        <path d="M-23 5.5 Q-12 1.5 -2 5" fill="none" stroke="${p.light('sauce')}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M-9 8 q1 6 0 9 M15 8 q1 5 0 7" fill="none" stroke="${p.line('sauce')}" stroke-width="5.6" stroke-linecap="round"/>
        <path d="M-9 8 q1 6 0 9 M15 8 q1 5 0 7" fill="none" stroke="${p.flat('sauce')}" stroke-width="3.2" stroke-linecap="round"/>
      </g>`;
    },
  },
  // A porcelain bowl: meatballs and noodles in broth, spring onion on top.
  bakso: {
    palette: { bowl: '#eef0f1', band: '#cf4a36', broth: '#d9a865', ball: '#8c7461', noodle: '#f0d27a', onion: '#58a83a' },
    variants: { alt1: { bowl: '#4a78bd' }, alt2: { bowl: '#d9a62a' } },
    draw: (p) => `
      <rect x="36" y="82" width="28" height="7" rx="2.5" fill="${p.shade('bowl')}"${p.edge('bowl', 1.8)}/>
      <ellipse cx="50" cy="52" rx="38" ry="10" fill="${p.light('bowl')}"${p.edge('bowl')}/>
      <ellipse cx="50" cy="52.5" rx="33" ry="7.2" fill="${p.fill('broth')}"/>
      <path d="M22 53 q5 -5 10 0 t10 0 M56 55 q5 -5 10 0 t10 0" fill="none" stroke="${p.flat('noodle')}" stroke-width="2.6" stroke-linecap="round"/>
      ${[
        [33, 47, 10],
        [51, 43.5, 11],
        [68, 48, 9.5],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.ball('ball')}"${p.edge('ball')}/>${p.spec(x! - r! * 0.35, y! - r! * 0.4, 2.6, 1.8, -30)}`)
        .join('')}
      <circle cx="42" cy="54" r="2.3" fill="${p.flat('onion')}"/><circle cx="60" cy="52" r="2.1" fill="${p.flat('onion')}"/><circle cx="25" cy="51" r="2" fill="${p.flat('onion')}"/>
      <path d="M12 52 A38 10 0 0 0 88 52 Q86 82 64 86 L36 86 Q14 82 12 52 Z" fill="${p.fill('bowl')}"${p.edge('bowl')}/>
      <path d="M17 66 Q50 79 83 66" fill="none" stroke="${p.flat('band')}" stroke-width="3.4" stroke-linecap="round"/>
      ${p.spec(23, 69, 2.6, 7, 20)}`,
  },
  // A dome of fried rice on a plate, a fried egg on top and a slice of cucumber.
  'nasi-goreng': {
    palette: { plate: '#eceeee', rice: '#c9803a', egg: '#fbf9f0', yolk: '#f4a91c', cucumber: '#bcdf86', herb: '#4e9a3a' },
    variants: { alt1: { rice: '#3f63a8' }, alt2: { rice: '#f4dc80' } },
    draw: (p) => `
      <ellipse cx="50" cy="73" rx="44" ry="14" fill="${p.fill('plate')}"${p.edge('plate')}/>
      <ellipse cx="50" cy="73" rx="34" ry="9.5" fill="none" stroke="${p.shade('plate')}" stroke-width="1.5"/>
      <path d="M17 73 C17 47 32 31 50 31 C68 31 83 47 83 73 Q50 83 17 73 Z" fill="${p.fill('rice')}"${p.edge('rice')}/>
      ${[
        [30, 58, 20],
        [40, 49, -30],
        [62, 52, 40],
        [71, 62, -10],
        [33, 69, 60],
        [50, 62, 0],
        [64, 70, -50],
        [24, 66, 30],
        [47, 74, 10],
        [57, 45, 70],
      ]
        .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="2.8" ry="1.6" transform="rotate(${a} ${x} ${y})" fill="${p.light('rice')}"/>`)
        .join('')}
      <circle cx="38" cy="62" r="2.2" fill="${p.flat('herb')}"/><circle cx="66" cy="60" r="2.2" fill="${p.flat('herb')}"/>
      <circle cx="17" cy="77" r="7" fill="${p.light('cucumber')}"${p.edge('cucumber', 1.8)}/><circle cx="17" cy="77" r="3.6" fill="${p.flat('cucumber')}"/>
      <path d="M33 36 C30 28 40 24 48 26 C56 22 68 25 70 32 C73 39 64 43 54 42 C44 45 35 42 33 36 Z" fill="${p.fill('egg')}"${p.edge('egg', 2)}/>
      <circle cx="52" cy="33.5" r="7.5" fill="${p.ball('yolk')}"${p.edge('yolk', 1.8)}/>
      ${p.spec(49.5, 31, 2.4, 1.6, -30)}`,
  },
  // Rice cake in a diamond of woven palm leaves, two leaf ends sticking out on top.
  ketupat: {
    palette: { leaf: '#6aaa3a' },
    variants: { alt1: { leaf: '#3d62a6' }, alt2: { leaf: '#f1de84' } },
    draw: (p) => {
      const cells: string[] = [];
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const x = -22.5 + 15 * i;
          const y = -22.5 + 15 * j;
          const up = (i + j) % 2 === 0;
          cells.push(
            `<rect x="${x}" y="${y}" width="15" height="15" fill="${up ? p.light('leaf') : p.flat('leaf')}"/>` +
              (up
                ? `<rect x="${x}" y="${y + 11}" width="15" height="4" fill="${p.shade('leaf')}" opacity="0.7"/>`
                : `<rect x="${x + 11}" y="${y}" width="4" height="15" fill="${p.shade('leaf')}" opacity="0.7"/>`),
          );
        }
      const tail = (d: string) =>
        `<path d="${d}" fill="none" stroke="${p.line('leaf')}" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${p.flat('leaf')}" stroke-width="4.6" stroke-linecap="round"/>`;
      return `${tail('M50 22 Q56 9 72 7')}${tail('M48 22 Q42 11 28 10')}
        <g transform="translate(50 54) rotate(45)">
          <rect x="-24" y="-24" width="48" height="48" rx="4" fill="${p.flat('leaf')}"/>
          ${cells.join('')}
          <path d="M-7.5 -22.5 V22.5 M7.5 -22.5 V22.5 M-22.5 -7.5 H22.5 M-22.5 7.5 H22.5" stroke="${p.line('leaf')}" stroke-width="1.3" opacity="0.6"/>
          <rect x="-24" y="-24" width="48" height="48" rx="4" fill="none"${p.edge('leaf', 2.6)}/>
        </g>
        ${p.spec(38, 40, 6, 2.4, -45)}`;
    },
  },
  // Two thin, puffed prawn crackers with curly irregular edges, flecks of prawn and air bubbles.
  'kerupuk-udang': {
    palette: { cracker: '#f0c4a8', fleck: '#e07a5a' },
    variants: { alt1: { cracker: '#4a72b8' }, alt2: { cracker: '#cf8f2a' } },
    draw: (p) => {
      const cracker = (cx: number, cy: number, rx: number, ry: number, bumps: number, fill: string) => {
        const outline = wavyDisc(cx, cy, rx, ry, bumps, 0.11);
        // The darker copy just below is the cracker's thin edge, seen slightly from above.
        return (
          `<path d="${outline}" transform="translate(0 3)" fill="${p.shade('cracker')}"${p.edge('cracker')}/>` +
          `<path d="${outline}" fill="${fill}"${p.edge('cracker')}/>`
        );
      };
      const dots = (list: number[][], kind: 'bubble' | 'fleck') =>
        list
          .map(([x, y, r]) =>
            kind === 'bubble'
              ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.light('cracker')}" stroke="${p.shade('cracker')}" stroke-width="1.2"/>`
              : `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r! * 0.6}" fill="${p.flat('fleck')}" opacity="0.85"/>`,
          )
          .join('');
      return `
        ${cracker(62, 36, 27, 19, 9, p.shade('cracker'))}
        ${dots([[60, 30, 2.4], [72, 38, 2]], 'bubble')}
        ${cracker(44, 60, 36, 25, 11, p.fill('cracker'))}
        ${dots([[32, 54, 3], [50, 50, 2.5], [58, 64, 3.2], [40, 70, 2.6], [24, 63, 2.1]], 'bubble')}
        ${dots([[38, 58, 2.4], [55, 56, 2.2], [46, 66, 2], [29, 68, 2], [62, 70, 2.2], [48, 45, 1.8]], 'fleck')}
        ${p.spec(30, 49, 6, 2.6, -20)}`;
    },
  },
  // A golden fried ball covered in sesame seeds.
  'onde-onde': {
    palette: { dough: '#d8912c', seed: '#fbf0d2' },
    variants: { alt1: { dough: '#4d5fae' }, alt2: { dough: '#f5e3a0' } },
    draw: (p) => {
      const seeds = Array.from({ length: 24 }, (_, i) => {
        const rr = 28 * Math.sqrt((i + 0.5) / 24);
        const a = i * 2.39996;
        const x = r1(50 + Math.cos(a) * rr);
        const y = r1(55 + Math.sin(a) * rr * 0.95);
        return `<ellipse cx="${x}" cy="${y}" rx="3.9" ry="1.9" transform="rotate(${r1((a * 180) / Math.PI + 30)} ${x} ${y})" fill="${p.flat('seed')}" stroke="${p.line('dough')}" stroke-width="0.8"/>`;
      });
      return `
        <circle cx="50" cy="55" r="34" fill="${p.ball('dough')}"${p.edge('dough')}/>
        ${seeds.join('')}
        ${p.spec(37, 40, 8, 4.5, -35)}`;
    },
  },
  // A tall see-through glass of iced tea with ice cubes and a straw.
  'es-teh-manis': {
    palette: { tea: '#cf7424', glass: '#dceef6', ice: '#f6fcff', straw: '#e0483a' },
    variants: { alt1: { tea: '#4262b0' }, alt2: { tea: '#f2d55a' } },
    draw: (p) => `
      <path d="M24 16 L76 16 L69 90 L31 90 Z" fill="${p.flat('glass')}" opacity="0.55"/>
      <path d="M26.7 32 L73.3 32 L68.4 87 L31.6 87 Z" fill="${p.fill('tea')}"/>
      <ellipse cx="50" cy="32" rx="23.3" ry="3.4" fill="${p.light('tea')}"/>
      <rect x="31" y="24" width="15" height="14" rx="3" transform="rotate(-10 38 31)" fill="${p.flat('ice')}" opacity="0.92"${p.edge('glass', 1.4)}/>
      <rect x="49" y="22" width="14" height="13" rx="3" transform="rotate(12 56 28)" fill="${p.flat('ice')}" opacity="0.92"${p.edge('glass', 1.4)}/>
      <rect x="39" y="38" width="13" height="12" rx="3" transform="rotate(5 45 44)" fill="${p.flat('ice')}" opacity="0.75"${p.edge('glass', 1.2)}/>
      <rect x="56" y="2" width="6.5" height="56" rx="3" transform="rotate(14 59 30)" fill="${p.fill('straw')}"${p.edge('straw', 1.8)}/>
      <rect x="31" y="84" width="38" height="6" rx="2" fill="${p.light('glass')}" opacity="0.7"/>
      <path d="M24 16 L76 16 L69 90 L31 90 Z" fill="none"${p.edge('glass')}/>
      <ellipse cx="50" cy="16" rx="26" ry="3.8" fill="${p.light('glass')}" opacity="0.8"${p.edge('glass', 1.8)}/>
      <path d="M30.5 24 L34.5 80" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" opacity="0.7"/>`,
  },
  // A hairy rambutan with its top peeled off, showing the white fruit inside.
  rambutan: {
    palette: { shell: '#c9302a', inner: '#f2d9c9', flesh: '#f1efe4' },
    variants: { alt1: { shell: '#7f9be0' }, alt2: { shell: '#f3cf45' } },
    draw: (p) => {
      // Hairs all round the shell except at the opening on top, curling one way.
      const hairs = Array.from({ length: 21 }, (_, i) => {
        const a = ((-28 + (i * 236) / 20) * Math.PI) / 180;
        const point = (r: number, turn = 0) => `${r1(50 + Math.cos(a + turn) * r)} ${r1(58 + Math.sin(a + turn) * r)}`;
        return `M${point(27)} Q${point(36, 0.12)} ${point(40, 0.3)}`;
      }).join(' ');
      // Short hairs over the shell's face.
      const fuzz = [
        [36, 60], [50, 64], [64, 60], [42, 74], [58, 74], [30, 70], [70, 70], [50, 80], [26, 58], [74, 58],
      ]
        .map(([x, y]) => `M${x! - 2.5} ${y! + 2} q2 -5 5 -4`)
        .join(' ');
      return `
        <path d="${hairs}" fill="none" stroke="${p.line('shell')}" stroke-width="5.6" stroke-linecap="round"/>
        <path d="${hairs}" fill="none" stroke="${p.flat('shell')}" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="50" cy="58" r="29" fill="${p.ball('shell')}"${p.edge('shell')}/>
        <path d="${fuzz}" fill="none" stroke="${p.shade('shell')}" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="50" cy="41" rx="22" ry="9" fill="${p.flat('inner')}"${p.edge('shell', 2)}/>
        <ellipse cx="50" cy="33" rx="17.5" ry="17" fill="${p.ball('flesh')}"${p.edge('flesh', 2.2)}/>
        <path d="M28 41 A22 9 0 0 0 72 41" fill="none" stroke="${p.flat('shell')}" stroke-width="4.2"/>
        <path d="M28 43 A22 9 0 0 0 72 43" fill="none" stroke="${p.line('shell')}" stroke-width="1.4"/>
        ${p.spec(44, 26, 4, 6, -25)}`;
    },
  },
  // A mangosteen with its green crown, and one white segment beside it.
  manggis: {
    palette: { skin: '#80388a', calyx: '#5a9a3a', stem: '#7a4a24', flesh: '#f7f4ea' },
    variants: { alt1: { skin: '#5d8fd6' }, alt2: { skin: '#f0d470' } },
    draw: (p) => `
      <circle cx="58" cy="52" r="31" fill="${p.ball('skin')}"${p.edge('skin')}/>
      <rect x="55.5" y="8" width="5" height="15" rx="2.5" fill="${p.fill('stem')}"${p.edge('stem', 1.6)}/>
      ${[
        [46, 25, -28],
        [70, 25, 28],
        [52, 21, -8],
        [64, 21, 8],
      ]
        .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5.5" transform="rotate(${a} ${x} ${y})" fill="${p.fill('calyx')}"${p.edge('calyx', 1.8)}/>`)
        .join('')}
      ${p.spec(46, 42, 7, 4.5, -35)}
<g transform="translate(26 74) scale(1.18) translate(-26 -72)"><path d="M10 80 C8 64 20 54 32 56 C44 58 46 74 40 84 C32 90 16 90 10 80 Z" fill="${p.fill('flesh')}"${p.edge('flesh')}/>
      <path d="M19 61 Q27 72 26 87" fill="none" stroke="${p.shade('flesh')}" stroke-width="1.8"/>
      ${p.spec(18, 68, 2.6, 5, -15)}</g>`,
  },
  // A thorny durian, split open to show its yellow pulp.
  durian: {
    palette: { husk: '#8e9c3a', stem: '#7a5a2e', rind: '#f3ead0', pulp: '#f2c230' },
    variants: { alt1: { husk: '#4a6c9a' }, alt2: { husk: '#ecd98e' } },
    draw: (p) => {
      const thorns: string[] = [];
      for (const [y, xs] of [
        [38, [36, 50]],
        [50, [26, 38]],
        [62, [24, 36]],
        [74, [34, 48, 62]],
      ] as const)
        for (const x of xs)
          thorns.push(
            `<polygon points="${x - 4},${y + 3.5} ${x},${y - 4} ${x + 4},${y + 3.5}" fill="${p.light('husk')}"/>` +
              `<polygon points="${x},${y - 4} ${x + 4},${y + 3.5} ${x},${y + 3.5}" fill="${p.shade('husk')}"/>`,
          );
      return `
        <rect x="46" y="10" width="8" height="16" rx="3" fill="${p.fill('stem')}"${p.edge('stem', 1.8)}/>
        <polygon points="${spikyEllipse(50, 56, 32, 29, 16, 0.2)}" fill="${p.fill('husk')}"${p.edge('husk')}/>
        ${thorns.join('')}
        <path d="M42 60 C44 42 62 33 77 41 C82 56 72 72 56 75 C47 73 42 67 42 60 Z" fill="${p.flat('rind')}"${p.edge('husk', 2.2)}/>
        <ellipse cx="55" cy="62" rx="10" ry="7.5" transform="rotate(-35 55 62)" fill="${p.ball('pulp')}"${p.edge('pulp', 1.6)}/>
        <ellipse cx="67" cy="50" rx="8" ry="6.5" transform="rotate(-35 67 50)" fill="${p.ball('pulp')}"${p.edge('pulp', 1.6)}/>
        ${p.spec(52, 58, 2.6, 1.7, -35)}${p.spec(30, 40, 5, 2.6, -40)}`;
    },
  },
};

/** Kinds that have a drawn icon; the rest use a placeholder for now. */
export const DRAWN_KINDS: readonly string[] = Object.keys(ICON_TEMPLATES);

// ---------------------------------------------------------------- variants

export function variantPalette(template: IconTemplate, variant: Variant): Palette {
  return variant === 'original' ? template.palette : { ...template.palette, ...template.variants[variant] };
}

/** Materials whose colour changes between variants. */
export function tintedMaterials(template: IconTemplate): string[] {
  return [...new Set([...Object.keys(template.variants.alt1), ...Object.keys(template.variants.alt2)])];
}

/**
 * Colour-free badge in the bottom-right corner, shown only in colour-blind mode (`marks`): none for the
 * original, a dot for alt1, a triangle for alt2. Dark with a white ring and a white mark, so it stands out on
 * light and on dark icons alike. Without it, variants are told apart by colour and lightness alone.
 */
function variantBadge(variant: Variant, marks: boolean): string {
  if (!marks || variant === 'original') return '';
  const mark =
    variant === 'alt1'
      ? '<circle cx="81" cy="81" r="6.5" fill="#ffffff"/>'
      : '<polygon points="81,71.5 89.5,86.5 72.5,86.5" fill="#ffffff"/>';
  return `<circle cx="81" cy="81" r="15.5" fill="#1d2630" stroke="#ffffff" stroke-width="3"/>${mark}`;
}

// ---------------------------------------------------------------- rendering

/** Shading tones derived from a material's base colour. */
export const tones = (base: string) => ({
  light: lighten(base, 0.38),
  base,
  shade: darken(base, 0.28),
  line: darken(base, 0.58),
});

function paintFor(palette: Palette, defs: string[]): Paint {
  const color = (m: string) => palette[m] ?? '#888888';
  const made = new Set<string>();
  const gradient = (kind: 'l' | 'r', m: string) => {
    const id = `${kind}-${m}`;
    if (!made.has(id)) {
      made.add(id);
      const t = tones(color(m));
      const stops =
        `<stop offset="0" stop-color="${t.light}"/><stop offset="0.5" stop-color="${t.base}"/>` +
        `<stop offset="1" stop-color="${t.shade}"/>`;
      defs.push(
        kind === 'l'
          ? `<linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1">${stops}</linearGradient>`
          : `<radialGradient id="${id}" cx="0.36" cy="0.32" r="0.75">${stops}</radialGradient>`,
      );
    }
    return `url(#${id})`;
  };
  return {
    fill: (m) => gradient('l', m),
    ball: (m) => gradient('r', m),
    flat: color,
    light: (m) => tones(color(m)).light,
    shade: (m) => tones(color(m)).shade,
    line: (m) => tones(color(m)).line,
    edge: (m, width = OUTLINE) => ` stroke="${tones(color(m)).line}" stroke-width="${width}" stroke-linejoin="round"`,
    spec: (cx, cy, rx, ry, rotate = 0) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${r1(rx * 1.6)}" ry="${r1(ry * 1.6)}" transform="rotate(${rotate} ${cx} ${cy})" fill="#ffffff" opacity="0.25"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})" fill="#ffffff" opacity="0.85"/>`,
  };
}

function svgDocument(defs: string[], body: string): string {
  const shadow =
    '<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.35"/>' +
    '<stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<defs>${shadow}${defs.join('')}</defs>` +
    // Soft shadow underneath.
    `<ellipse cx="50" cy="91" rx="34" ry="6" fill="url(#shadow)"/>` +
    `${body}</svg>`
  );
}

/** SVG for a drawn kind in a variant; `marks` adds the colour-blind variant badge. */
export function renderIcon(kindId: string, variant: Variant, marks = false): string {
  const template = ICON_TEMPLATES[kindId];
  if (!template) throw new Error(`no icon for ${kindId}`);
  const defs: string[] = [];
  const paint = paintFor(variantPalette(template, variant), defs);
  const body = template.draw(paint).replace(/\s*\n\s*/g, '');
  // Drawn a little larger than the 100-unit grid so icons fill their slot; the badge stays in its corner.
  return svgDocument(defs, `<g transform="translate(50 52) scale(1.07) translate(-50 -52)">${body}</g>` + variantBadge(variant, marks));
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

/** Placeholder variants follow the same idea as the drawn ones: alt1 bluer, alt2 lighter and yellower. */
export function placeholderVariantColor(base: string, variant: Variant): string {
  if (variant === 'alt1') return mix(base, '#4f72c8', 0.7);
  if (variant === 'alt2') return mix(base, '#f7e7a0', 0.68);
  return base;
}

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
      return `<polygon points="${spikyEllipse(50, 52, 18, 18, 5, 1.2)}" fill="${fill}"${edge}/>`;
    case 'drop':
      return `<path d="M50 10 C64 32 80 46 80 62 A30 30 0 0 1 20 62 C20 46 36 32 50 10 Z" fill="${fill}"${edge}/>`;
  }
}

/** Provisional icon for kinds without art yet: shape + colour + initial, with the same variant badges. */
export function renderPlaceholder(kindId: string, variant: Variant, marks = false): string {
  const kind = ITEM_KINDS.find((k) => k.id === kindId);
  if (!kind) throw new Error(`unknown kind ${kindId}`);
  const look = placeholderLook(kind);
  const color = placeholderVariantColor(look.color, variant);
  const defs: string[] = [];
  const paint = paintFor({ body: color }, defs);
  const light = hexToRgb(color).reduce((a, b) => a + b, 0) > 520;
  const letter =
    `<text x="50" y="${look.shape === 'triangle' ? 66 : 62}" text-anchor="middle" font-family="Arial, sans-serif" ` +
    `font-weight="700" font-size="34" fill="${light ? '#1d2630' : '#ffffff'}">${look.initial}</text>`;
  return svgDocument(defs, placeholderShape(look.shape, paint.fill('body'), paint.edge('body', 3)) + letter + variantBadge(variant, marks));
}

/** SVG for any item type id: its drawn icon if there is one, otherwise its placeholder (`marks`: see renderIcon). */
export function renderItemSvg(type: string, marks = false): string {
  const parsed = parseItemType(type);
  if (!parsed) throw new Error(`unknown item type ${type}`);
  return ICON_TEMPLATES[parsed.kind.id]
    ? renderIcon(parsed.kind.id, parsed.variant, marks)
    : renderPlaceholder(parsed.kind.id, parsed.variant, marks);
}

/**
 * What an item looks like from behind another one: its icon blurred into a soft blob, so an empty front slot
 * shows that something waits there and roughly how big it is, but not what it is. Drawn dark in the game.
 */
export function renderSilhouette(type: string): string {
  const svg = renderItemSvg(type);
  const open = svg.indexOf('</defs>') + '</defs>'.length;
  const blur = '<filter id="silhouette" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="6"/></filter>';
  return svg.slice(0, open - '</defs>'.length) + blur + '</defs><g filter="url(#silhouette)">' + svg.slice(open, -'</svg>'.length) + '</g></svg>';
}
