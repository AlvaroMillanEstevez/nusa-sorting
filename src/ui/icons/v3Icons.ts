import { darken, lighten, mix } from './color';
import { r1, type Palette } from './template';

/**
 * A test of a more illustrated, less toy-like icon style ("v3"), for three kinds: sate, es teh manis and
 * rambutan. Compared with the current icons: natural, less saturated colours; five-tone shading with soft
 * transitions; subtle textures from SVG patterns; no thick outline (shapes are separated by light and shade);
 * a contact shadow where the item touches the shelf, and a rim light along its edge.
 *
 * The materials are the same as the current templates', so their colour variants still apply.
 */

export interface V3Template {
  readonly palette: Palette;
  readonly variants: { readonly alt1: Palette; readonly alt2: Palette };
  draw(p: V3Paint): string;
}

/** Drawing helpers for the v3 style. */
export interface V3Paint {
  /** Five-tone linear shading at an angle (degrees; 0 = light from the top). */
  fill(material: string, angle?: number): string;
  /** Five-tone radial shading lit from the top left. */
  ball(material: string): string;
  /** A tone of a material: -1 (deepest shade) to 1 (highlight); 0 is the base colour. */
  tone(material: string, t: number): string;
  /** A texture pattern over a material, as a fill: 'grain' (wood fibres), 'char' (grill specks), 'pores' (skin cells), 'drops' (condensation). */
  texture(kind: 'grain' | 'char' | 'pores' | 'drops', material: string): string;
  /** A soft blur filter id (light, shadows). */
  readonly blur: string;
}

const tone = (base: string, t: number) => (t >= 0 ? lighten(base, t * 0.55) : darken(base, -t * 0.6));

function v3Paint(palette: Palette, defs: string[]): V3Paint {
  const color = (m: string) => palette[m] ?? '#888888';
  const made = new Set<string>();
  const once = (id: string, def: () => string) => {
    if (!made.has(id)) {
      made.add(id);
      defs.push(def());
    }
    return `url(#${id})`;
  };
  const stops = (m: string) =>
    [
      [0, 0.75],
      [0.25, 0.35],
      [0.55, 0],
      [0.82, -0.35],
      [1, -0.6],
    ]
      .map(([o, t]) => `<stop offset="${o}" stop-color="${tone(color(m), t!)}"/>`)
      .join('');
  return {
    fill: (m, angle = 20) =>
      once(`v3l-${m}-${angle}`, () => {
        const a = ((angle - 90) * Math.PI) / 180;
        const [x1, y1, x2, y2] = [0.5 - Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5].map(r1);
        return `<linearGradient id="v3l-${m}-${angle}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(m)}</linearGradient>`;
      }),
    ball: (m) => once(`v3r-${m}`, () => `<radialGradient id="v3r-${m}" cx="0.36" cy="0.3" r="0.78">${stops(m)}</radialGradient>`),
    tone: (m, t) => tone(color(m), t),
    texture: (kind, m) =>
      once(`v3t-${kind}-${m}`, () => {
        const id = `v3t-${kind}-${m}`;
        const dark = tone(color(m), -0.7);
        const light = tone(color(m), 0.8);
        const dots = (spots: readonly (readonly [number, number, number, number])[], fill: string) =>
          spots.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${o}"/>`).join('');
        switch (kind) {
          case 'grain':
            return `<pattern id="${id}" width="9" height="3.2" patternUnits="userSpaceOnUse"><path d="M0 1.2 Q3 0.6 9 1.4" stroke="${dark}" stroke-width="0.5" fill="none" opacity="0.4"/></pattern>`;
          case 'char':
            return (
              `<pattern id="${id}" width="13" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(31)">` +
              dots([[1.5, 2, 0.7, 0.4], [6.2, 7.4, 0.45, 0.35], [10.4, 3.1, 0.55, 0.3], [3.8, 9.2, 0.35, 0.3], [9, 9.6, 0.6, 0.25]], dark) +
              dots([[7.8, 1.4, 0.35, 0.3], [2.6, 5.6, 0.3, 0.25]], light) +
              `</pattern>`
            );
          case 'pores':
            return (
              `<pattern id="${id}" width="7.4" height="6.6" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">` +
              dots([[1.6, 1.7, 1, 0.16], [5.4, 4.6, 1.1, 0.14], [5.8, 0.6, 0.6, 0.12]], dark) +
              dots([[1.2, 1.2, 0.35, 0.22], [5, 4.1, 0.35, 0.2]], light) +
              `</pattern>`
            );
          case 'drops':
            return (
              `<pattern id="${id}" width="15" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">` +
              `<ellipse cx="3" cy="4" rx="0.7" ry="1" fill="#ffffff" opacity="0.2"/><ellipse cx="10.5" cy="13" rx="0.55" ry="0.8" fill="#ffffff" opacity="0.16"/>` +
              `<ellipse cx="12.4" cy="5.6" rx="0.4" ry="0.55" fill="#ffffff" opacity="0.14"/></pattern>`
            );
        }
      }),
    blur: 'v3blur',
  };
}

/** Skewers of grilled chunks, glossy with sweet soy glaze, under peanut sauce flecked with crushed peanuts. */
const sate: V3Template = {
  palette: { meat: '#86441f', stick: '#cfb27e', sauce: '#a8723a' },
  variants: { alt1: { meat: '#86a3dc' }, alt2: { meat: '#f2d47e' } },
  draw: (p) => {
    // An irregular chunk: a rounded box with wobbly corners.
    const chunk = (x: number, y: number, seed: number) => {
      const w = 17 + (seed % 3);
      const h = 21 + ((seed * 7) % 3);
      const j = (k: number) => r1(Math.sin(seed * 3.1 + k) * 1.4);
      const d =
        `M${r1(x - w / 2 + 3)} ${r1(y - h / 2 + j(1))} Q${r1(x)} ${r1(y - h / 2 - 1.5 + j(2))} ${r1(x + w / 2 - 3)} ${r1(y - h / 2 + j(3))}` +
        ` Q${r1(x + w / 2 + 1)} ${r1(y - h / 2 + 1)} ${r1(x + w / 2 + j(4) * 0.5)} ${r1(y - h / 2 + 5)}` +
        ` L${r1(x + w / 2 + j(5) * 0.6)} ${r1(y + h / 2 - 5)} Q${r1(x + w / 2)} ${r1(y + h / 2 + 1)} ${r1(x + w / 2 - 4)} ${r1(y + h / 2 + j(6) * 0.5)}` +
        ` Q${r1(x)} ${r1(y + h / 2 + 2)} ${r1(x - w / 2 + 4)} ${r1(y + h / 2 + j(7) * 0.5)}` +
        ` Q${r1(x - w / 2 - 1)} ${r1(y + h / 2)} ${r1(x - w / 2 + j(8) * 0.5)} ${r1(y + h / 2 - 5)}` +
        ` L${r1(x - w / 2 + j(9) * 0.6)} ${r1(y - h / 2 + 5)} Q${r1(x - w / 2)} ${r1(y - h / 2 + 1)} ${r1(x - w / 2 + 3)} ${r1(y - h / 2 + j(1))}Z`;
      return (
        // Shade where the chunk meets the stick and its neighbours.
        `<path d="${d}" transform="translate(0.8 1.6)" fill="${p.tone('meat', -0.85)}" opacity="0.55" filter="url(#${p.blur})"/>` +
        `<path d="${d}" fill="${p.fill('meat', 15)}"/>` +
        `<path d="${d}" fill="${p.texture('char', 'meat')}"/>` +
        `<path d="${d}" fill="none" stroke="${p.tone('meat', -0.9)}" stroke-width="0.8" opacity="0.6"/>` +
        // Charred, caramelised edges and a grill line.
        `<path d="M${r1(x - w / 2 + 2)} ${r1(y - 4)} q${r1(w / 2)} 3 ${r1(w - 4)} -1" stroke="${p.tone('meat', -0.8)}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M${r1(x - w / 2 + 3)} ${r1(y + 5)} q${r1(w / 2)} 2.5 ${r1(w - 6)} -0.5" stroke="${p.tone('meat', -0.75)}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.55"/>` +
        // Glossy glaze: a soft highlight and a sharp glint.
        `<ellipse cx="${r1(x - 3)}" cy="${r1(y - h / 2 + 5)}" rx="4.4" ry="2" fill="${p.tone('meat', 0.9)}" opacity="0.45" filter="url(#${p.blur})"/>` +
        `<ellipse cx="${r1(x - 4)}" cy="${r1(y - h / 2 + 4.6)}" rx="1.8" ry="0.9" fill="#fff6e8" opacity="0.85"/>`
      );
    };
    const skewer = (y: number, xs: number[], seed: number) =>
      `<rect x="-40" y="${y - 2}" width="78" height="4" rx="2" fill="${p.fill('stick', 0)}"/>` +
      `<rect x="-40" y="${y - 2}" width="78" height="4" rx="2" fill="${p.texture('grain', 'stick')}"/>` +
      `<path d="M38 ${y - 2} L45 ${y} L38 ${y + 2}Z" fill="${p.tone('stick', -0.2)}"/>` +
      `<rect x="-40" y="${y - 2}" width="78" height="1.2" rx="0.6" fill="${p.tone('stick', 0.9)}" opacity="0.6"/>` +
      xs.map((x, i) => chunk(x, y, seed + i)).join('');
    const drizzle = 'M-27 7 Q-14 1.5 0 6.5 T29 5.5';
    return `<g transform="translate(50 49) rotate(-28)">
      ${skewer(-11, [-21, -3, 15], 1)}
      ${skewer(12, [-15, 3, 21], 5)}
      <path d="${drizzle}" fill="none" stroke="${p.tone('sauce', -0.75)}" stroke-width="9" stroke-linecap="round" opacity="0.45" filter="url(#${p.blur})" transform="translate(0.6 1.4)"/>
      <path d="${drizzle}" fill="none" stroke="${p.tone('sauce', 0)}" stroke-width="7" stroke-linecap="round"/>
      <path d="${drizzle}" fill="none" stroke="${p.tone('sauce', -0.45)}" stroke-width="2" stroke-linecap="round" opacity="0.5" transform="translate(0 2.2)"/>
      ${[[-20, 4.2], [-6, 5.6], [8, 6.4], [21, 4.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${p.tone('sauce', -0.6)}" opacity="0.6"/>`).join('')}
      <path d="M-24 5 Q-13 1 -3 4.6" fill="none" stroke="${p.tone('sauce', 0.9)}" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
      <path d="M-9 8.5 q1 5.5 0 8.5 M16 8 q1 4.5 0 6.5" fill="none" stroke="${p.tone('sauce', -0.1)}" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="-9" cy="17.3" r="2.1" fill="${p.tone('sauce', -0.1)}"/>
    </g>`;
  },
};

/** A tall glass of iced tea: amber tea deepening to the bottom, clear ice, condensation, a straw. */
const esTehManis: V3Template = {
  palette: { tea: '#c2661c', glass: '#d9e6ea', ice: '#eef6f8', straw: '#c4453b' },
  variants: { alt1: { tea: '#4262b0' }, alt2: { tea: '#f2d55a' } },
  draw: (p) => {
    const glass = 'M25 15 L75 15 L68.6 89 Q50 92 31.4 89 Z';
    const tea = 'M27.4 33 L72.6 33 L68.2 86.6 Q50 89.4 31.8 86.6 Z';
    const cube = (x: number, y: number, w: number, a: number, o: number) =>
      `<g transform="rotate(${a} ${x + w / 2} ${y + w / 2})" opacity="${o}">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${w * 0.92}" rx="2.6" fill="${p.tone('ice', -0.1)}" opacity="0.75"/>` +
      `<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 5}" height="${w * 0.4}" rx="1.6" fill="#ffffff" opacity="0.75"/>` +
      `<path d="M${x + w - 2} ${y + 3} L${x + w - 2} ${y + w * 0.8}" stroke="${p.tone('ice', -0.45)}" stroke-width="1" opacity="0.5"/></g>`;
    return `
      <defs><linearGradient id="v3-tea-depth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.tone('tea', 0.45)}"/><stop offset="0.4" stop-color="${p.tone('tea', 0.1)}"/>
        <stop offset="1" stop-color="${p.tone('tea', -0.38)}"/></linearGradient>
      <linearGradient id="v3-tea-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="0.3" stop-color="#000" stop-opacity="0"/>
        <stop offset="0.75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient></defs>
      <path d="${glass}" fill="${p.tone('glass', 0.2)}" opacity="0.32"/>
      <path d="${tea}" fill="url(#v3-tea-depth)"/>
      <path d="${tea}" fill="url(#v3-tea-side)"/>
      <ellipse cx="50" cy="33" rx="22.6" ry="3" fill="${p.tone('tea', 0.55)}" opacity="0.9"/>
      ${cube(31, 22, 15, -10, 0.95)}${cube(49, 20, 14, 12, 0.95)}${cube(40, 36, 13, 5, 0.7)}${cube(52, 44, 11, -8, 0.45)}
      <rect x="56" y="1" width="6" height="58" rx="3" transform="rotate(14 59 30)" fill="${p.fill('straw', 90)}"/>
      <rect x="57.4" y="1" width="1.6" height="58" rx="0.8" transform="rotate(14 59 30)" fill="#ffffff" opacity="0.45"/>
      <path d="M29.6 56 L70.4 56 L68.6 89 Q50 92 31.4 89 Z" fill="${p.texture('drops', 'glass')}"/>
      <path d="M29 21 L33.6 83" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" opacity="0.55"/>
      <path d="M36 22 L38.6 60" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
      <path d="M71.5 20 L66.6 84" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
      <path d="${glass}" fill="none" stroke="${p.tone('glass', -0.35)}" stroke-width="0.9" opacity="0.6"/>
      <ellipse cx="50" cy="15" rx="25" ry="3.4" fill="none" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>
      <ellipse cx="50" cy="15.4" rx="25" ry="3.4" fill="none" stroke="${p.tone('glass', -0.4)}" stroke-width="0.6" opacity="0.5"/>
      <path d="M33 88.4 Q50 91 67 88.4" stroke="#ffffff" stroke-width="1.6" fill="none" opacity="0.55"/>`;
  },
};

/** A rambutan, top peeled away: soft hairs with lighter tips around a pored shell, glossy translucent flesh. */
const rambutan: V3Template = {
  palette: { shell: '#b2342b', inner: '#eed4c0', flesh: '#f1ece0' },
  variants: { alt1: { shell: '#7f9be0' }, alt2: { shell: '#f3cf45' } },
  draw: (p) => {
    const hairs = Array.from({ length: 22 }, (_, i) => {
      const a = ((-32 + (i * 244) / 21) * Math.PI) / 180;
      const len = 8 + ((i * 7) % 4);
      const at = (r: number, turn = 0) => `${r1(50 + Math.cos(a + turn) * r)} ${r1(60 + Math.sin(a + turn) * r)}`;
      return { d: `M${at(25.5)} Q${at(27 + len * 0.8, 0.05)} ${at(26.5 + len, 0.36)}`, tip: at(26.5 + len, 0.36) };
    });
    const tipColor = mix(p.tone('shell', 0.3), '#c9b04a', 0.45);
    const fuzz = [
      [36, 62], [50, 67], [64, 62], [42, 77], [58, 77], [31, 72], [69, 72], [50, 83], [27, 60], [73, 60], [44, 55], [57, 55],
    ]
      .map(([x, y]) => `M${x! - 2.5} ${y! + 2} q2.2 -4.6 5 -3.6`)
      .join(' ');
    return `
      <g opacity="0.95">${hairs.map((h) => `<path d="${h.d}" fill="none" stroke="${p.tone('shell', -0.45)}" stroke-width="3.6" stroke-linecap="round"/>`).join('')}</g>
      ${hairs.map((h) => `<path d="${h.d}" fill="none" stroke="${p.tone('shell', 0.1)}" stroke-width="2" stroke-linecap="round"/>`).join('')}
      ${hairs.map((h) => `<circle cx="${h.tip.split(' ')[0]}" cy="${h.tip.split(' ')[1]}" r="1.15" fill="${tipColor}" opacity="0.85"/>`).join('')}
      <circle cx="50" cy="60" r="28" fill="${p.ball('shell')}"/>
      <circle cx="50" cy="60" r="28" fill="${p.texture('pores', 'shell')}"/>
      <circle cx="50" cy="60" r="27.6" fill="none" stroke="${p.tone('shell', -0.85)}" stroke-width="0.8" opacity="0.55"/>
      <path d="${fuzz}" fill="none" stroke="${p.tone('shell', -0.45)}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
      <path d="${fuzz}" fill="none" stroke="${p.tone('shell', 0.4)}" stroke-width="0.8" stroke-linecap="round" opacity="0.6" transform="translate(-0.6 -0.8)"/>
      <ellipse cx="50" cy="43.5" rx="22" ry="8.6" fill="${p.tone('inner', -0.15)}"/>
      <ellipse cx="50" cy="43" rx="20" ry="7.2" fill="${p.tone('inner', 0.1)}"/>
      <ellipse cx="50" cy="36" rx="17" ry="16" fill="${p.ball('flesh')}"/>
      <ellipse cx="50" cy="40" rx="15" ry="11" fill="${p.tone('flesh', -0.3)}" opacity="0.25" filter="url(#${p.blur})"/>
      <path d="M44 25 Q41 33 44 44 M55 25 Q58 34 55 44" stroke="${p.tone('flesh', -0.25)}" stroke-width="0.8" fill="none" opacity="0.5"/>
      <ellipse cx="43.5" cy="28" rx="5" ry="7" transform="rotate(-25 43.5 28)" fill="#ffffff" opacity="0.5" filter="url(#${p.blur})"/>
      <ellipse cx="43" cy="27" rx="1.8" ry="3" transform="rotate(-25 43 27)" fill="#ffffff" opacity="0.9"/>
      <path d="M28.5 45.5 A22 8.6 0 0 0 71.5 45.5" fill="none" stroke="${p.tone('shell', -0.2)}" stroke-width="3.2"/>`;
  },
};

export const V3_TEMPLATES: Readonly<Record<string, V3Template>> = { sate, 'es-teh-manis': esTehManis, rambutan };

/**
 * The SVG document of a v3 icon. Same frame as the current icons (viewBox 0 0 100 100, the same slight
 * enlargement); instead of their soft blob shadow, a contact shadow (a tight dark core under a wide soft one)
 * and a rim light from the top left over the whole drawing.
 */
export function renderV3Icon(palette: Palette, template: V3Template, badge: string): string {
  const defs: string[] = [
    '<filter id="v3blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>',
    '<filter id="v3soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.6"/></filter>',
    // Rim light: the drawing's own shape, offset from the top left and cut by itself, as a thin bright edge.
    '<filter id="v3rim" x="-10%" y="-10%" width="120%" height="120%">' +
      '<feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="linear" slope="3"/></feComponentTransfer>' +
      '<feOffset in="a" dx="1.4" dy="1.6" result="shifted"/>' +
      '<feComposite in="a" in2="shifted" operator="out" result="edge"/>' +
      '<feGaussianBlur in="edge" stdDeviation="0.45" result="blurred"/>' +
      '<feComposite in="blurred" in2="a" operator="in" result="soft"/>' +
      '<feFlood flood-color="#fff4dc" flood-opacity="0.55"/><feComposite in2="soft" operator="in" result="rim"/>' +
      '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rim"/></feMerge></filter>',
  ];
  const paint = v3Paint(palette, defs);
  const body = template.draw(paint).replace(/\s*\n\s*/g, '');
  const shadow =
    '<g class="contact-shadow"><ellipse cx="50" cy="92" rx="30" ry="5.5" fill="#000000" opacity="0.32" filter="url(#v3soft)"/>' +
    '<ellipse cx="50" cy="91.5" rx="20" ry="2.4" fill="#000000" opacity="0.4" filter="url(#v3blur)"/></g>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<defs>${defs.join('')}</defs>${shadow}` +
    `<g transform="translate(50 52) scale(1.07) translate(-50 -52)"><g filter="url(#v3rim)">${body}</g></g>${badge}</svg>`
  );
}
