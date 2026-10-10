import type { BoosterId } from '../../data/economy';
import { r1, type IconTemplate } from './template';

/**
 * The three boosters' icons, drawn like the item icons (materials with three-tone shading, a fine outline in a
 * dark tone of each material, specular highlights) so they belong to the same warm, hand-made world. Each one is
 * a single bold object that still reads at 28 px: a brass stopwatch caught in ice, a wooden mallet striking, and
 * two crossing arrows. Boosters have no colour variants.
 */

const none = { alt1: {}, alt2: {} };

/** A four-pointed sparkle (an impact, a glint). */
const sparkle = (cx: number, cy: number, r: number, fill: string, line: string) => {
  const k = r * 0.28;
  const points = [
    [cx, cy - r],
    [cx + k, cy - k],
    [cx + r, cy],
    [cx + k, cy + k],
    [cx, cy + r],
    [cx - k, cy + k],
    [cx - r, cy],
    [cx - k, cy - k],
  ]
    .map(([x, y]) => `${r1(x!)},${r1(y!)}`)
    .join(' ');
  return `<polygon points="${points}" fill="${fill}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>`;
};

export const BOOSTER_TEMPLATES: Readonly<Record<BoosterId, IconTemplate>> = {
  // A brass stopwatch frozen over: ice crusted on its rim, icicles hanging from it, the hands stopped.
  freeze: {
    palette: { brass: '#d9a640', face: '#d6f1fd', ice: '#8fd3f4', hand: '#2b3d5c', frost: '#ffffff' },
    variants: none,
    draw: (p) => {
      const ticks = Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const r0 = i % 3 === 0 ? 15 : 17;
        return `M${r1(50 + Math.sin(a) * r0)} ${r1(55 - Math.cos(a) * r0)} L${r1(50 + Math.sin(a) * 20)} ${r1(55 - Math.cos(a) * 20)}`;
      }).join(' ');
      return `
        <rect x="44.5" y="12" width="11" height="9" rx="2.5" fill="${p.fill('brass')}"${p.edge('brass', 2)}/>
        <rect x="41" y="8" width="18" height="6" rx="3" fill="${p.fill('brass')}"${p.edge('brass', 2)}/>
        <rect x="68" y="20" width="9" height="7" rx="2" transform="rotate(40 72.5 23.5)" fill="${p.fill('brass')}"${p.edge('brass', 2)}/>
        <circle cx="50" cy="55" r="32" fill="${p.ball('brass')}"${p.edge('brass')}/>
        <circle cx="50" cy="55" r="25" fill="${p.ball('face')}"${p.edge('brass', 2)}/>
        <path d="${ticks}" stroke="${p.line('face')}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M50 55 L50 38 M50 55 L61 49" stroke="${p.flat('hand')}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="55" r="3.4" fill="${p.flat('hand')}"/>
        <path d="M20 46 Q22 28 38 22 L42 30 L35 30 L37 37 L29 36 L30 44 L24 42 Z" fill="${p.fill('ice')}"${p.edge('ice', 2)} opacity="0.95"/>
        <path d="M58 23 Q74 27 81 42 L74 41 L76 48 L69 45 L66 51 L63 42 L58 40 Z" fill="${p.fill('ice')}"${p.edge('ice', 2)} opacity="0.95"/>
        <path d="M30 80 L34 94 L38 82 M45 86 L49 98 L53 86 M60 83 L64 93 L67 80" fill="${p.fill('ice')}"${p.edge('ice', 1.8)}/>
        <path d="M24 39 Q27 29 36 25" fill="none" stroke="${p.flat('frost')}" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        <path d="M63 27 Q72 30 77 38" fill="none" stroke="${p.flat('frost')}" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
        ${p.spec(36, 42, 5, 3, -40)}
        ${sparkle(84, 64, 8, '#ffffff', p.line('ice'))}`;
    },
  },
  // A chunky wooden mallet with brass bands, swung down: the impact sparkles where it lands.
  removeTriple: {
    palette: { head: '#b06a2f', handle: '#e2b878', brass: '#e0b04a', grip: '#8a3b2a', spark: '#ffd84a' },
    variants: none,
    draw: (p) => `
      ${sparkle(20, 74, 9, p.flat('spark'), p.line('spark'))}
      ${sparkle(12, 56, 5.5, p.flat('spark'), p.line('spark'))}
      ${sparkle(33, 88, 5, p.flat('spark'), p.line('spark'))}
      <g transform="rotate(-38 56 48)">
        <rect x="51.5" y="44" width="10" height="50" rx="5" fill="${p.fill('handle')}"${p.edge('handle')}/>
        <rect x="51" y="76" width="11" height="14" rx="4" fill="${p.fill('grip')}"${p.edge('grip', 2)}/>
        <path d="M51.5 80 L62 83 M51.5 85 L62 88" stroke="${p.line('grip')}" stroke-width="1.6" opacity="0.7"/>
        <rect x="24" y="18" width="65" height="32" rx="9" fill="${p.fill('head')}"${p.edge('head')}/>
        <ellipse cx="26" cy="34" rx="5" ry="15" fill="${p.light('head')}"${p.edge('head', 2)}/>
        <rect x="34" y="17" width="7" height="34" rx="2.5" fill="${p.fill('brass')}"${p.edge('brass', 2)}/>
        <rect x="72" y="17" width="7" height="34" rx="2.5" fill="${p.fill('brass')}"${p.edge('brass', 2)}/>
        <path d="M45 27 Q56 25 66 28 M46 40 Q57 38 67 41" fill="none" stroke="${p.line('head')}" stroke-width="1.6" opacity="0.55"/>
        ${p.spec(50, 23, 9, 2.6)}
      </g>`,
  },
  // Two thick arrows crossing over each other, warm orange and teal: everything changes places.
  shuffle: {
    palette: { warm: '#f08a34', cool: '#2fb3a3' },
    variants: none,
    draw: (p) => {
      const arrow = (m: string, path: string, head: string) =>
        `<path d="${path}" fill="none" stroke="${p.line(m)}" stroke-width="15" stroke-linecap="round"/>` +
        `<polygon points="${head}" fill="${p.line(m)}" stroke="${p.line(m)}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="${path}" fill="none" stroke="${p.flat(m)}" stroke-width="10" stroke-linecap="round"/>` +
        `<polygon points="${head}" fill="${p.fill(m)}"/>` +
        `<path d="${path}" fill="none" stroke="${p.light(m)}" stroke-width="3" stroke-linecap="round" opacity="0.8" transform="translate(-1 -2.5)"/>`;
      return (
        arrow('cool', 'M16 30 C38 30 50 70 70 70', '68,58 89,70 68,82') +
        arrow('warm', 'M16 70 C38 70 50 30 70 30', '68,18 89,30 68,42')
      );
    },
  },
};
