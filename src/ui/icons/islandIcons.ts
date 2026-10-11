import { r1, type IconTemplate, type Paint } from './template';

/** A line drawn twice: its outline, then its colour (cords, poles, stalks). */
function strand(p: Paint, material: string, d: string, width: number): string {
  return (
    `<path d="${d}" fill="none" stroke="${p.line(material)}" stroke-width="${width + 2.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${p.flat(material)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

const polar = (cx: number, cy: number, r: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return [r1(cx + Math.cos(a) * r), r1(cy + Math.sin(a) * r)] as const;
};

/** A regular polygon's points. */
const polygon = (cx: number, cy: number, r: number, sides: number, start = -90) =>
  Array.from({ length: sides }, (_, i) => polar(cx, cy, r, start + (360 / sides) * i).join(',')).join(' ');

/**
 * The objects of the themed levels 25-45 (Olahraga, Permainan tradisional, Rempah Maluku, Sawah, Fauna Nusantara),
 * in the same style as the food and the first cultural objects. Each one is a single object with a feature that
 * reads at 36 px (a feathered cone, a woven ball, a casque on a beak), and changes colour in one main material.
 */
export const ISLAND_TEMPLATES: Readonly<Record<string, IconTemplate>> = {
  // ---------------------------------------------------------------- Olahraga

  // A shuttlecock: a cone of white feathers with their ribs, on a round red cork.
  kok: {
    palette: { cork: '#c43a2a', feather: '#f4f2ea', band: '#2f6fc0' },
    variants: { alt1: { cork: '#7aa6ea' }, alt2: { cork: '#f2e08a' } },
    draw: (p) => `
      <path d="M22 12 L78 12 L62 64 L38 64 Z" fill="${p.fill('feather')}"${p.edge('feather')}/>
      <path d="M22 12 Q50 22 78 12" fill="none" stroke="${p.line('feather')}" stroke-width="2.4"/>
      <path d="M33 13 L43 63 M44 15 L48 64 M56 15 L52 64 M67 13 L57 63" stroke="${p.shade('feather')}" stroke-width="2" stroke-linecap="round"/>
      <path d="M31 40 Q50 46 69 40" fill="none" stroke="${p.flat('band')}" stroke-width="3"/>
      <rect x="35" y="61" width="30" height="7" rx="2" fill="${p.flat('band')}"${p.edge('band', 1.6)}/>
      <path d="M35 67 L65 67 Q66 88 50 88 Q34 88 35 67 Z" fill="${p.fill('cork')}"${p.edge('cork')}/>
      ${p.spec(42, 74, 3, 4.5, 15)}`,
  },
  // A badminton racket: an oval head strung in a grid, a slim shaft and a wrapped grip.
  raket: {
    palette: { frame: '#c8382a', string: '#f2efe4', grip: '#3a3a44', shaft: '#c9ccd2' },
    variants: { alt1: { frame: '#86aef0' }, alt2: { frame: '#f2de7a' } },
    draw: (p) => {
      const strings: string[] = [];
      for (let x = 34; x <= 76; x += 7) strings.push(`M${x} 14 L${x} 62`);
      for (let y = 18; y <= 60; y += 7) strings.push(`M30 ${y} L80 ${y}`);
      return `<g transform="rotate(-30 55 40)">
        <defs><clipPath id="head"><ellipse cx="55" cy="38" rx="21" ry="26"/></clipPath></defs>
        <path d="${strings.join(' ')}" stroke="${p.flat('string')}" stroke-width="1.6" clip-path="url(#head)"/>
        <ellipse cx="55" cy="38" rx="22.5" ry="27.5" fill="none" stroke="${p.line('frame')}" stroke-width="8.4"/>
        <ellipse cx="55" cy="38" rx="22.5" ry="27.5" fill="none" stroke="${p.flat('frame')}" stroke-width="5.6"/>
        <path d="M44 22 Q48 15 56 13" fill="none" stroke="${p.light('frame')}" stroke-width="2" stroke-linecap="round"/>
        ${strand(p, 'shaft', 'M55 66 L55 88', 3)}
        <rect x="50.5" y="86" width="9" height="20" rx="3.5" fill="${p.fill('grip')}"${p.edge('grip', 1.8)}/>
      </g>`;
    },
  },
  // A sepak takraw ball: rattan strips woven into a ball with five-sided holes.
  'sepak-takraw': {
    palette: { rattan: '#d9a83e', hole: '#5a3a16' },
    variants: { alt1: { rattan: '#5a86d6' }, alt2: { rattan: '#f6eaa8' } },
    draw: (p) => {
      const holes = [
        [50, 52, 9],
        [50, 26, 6.5],
        [26, 44, 6.5],
        [74, 44, 6.5],
        [34, 72, 6.5],
        [66, 72, 6.5],
      ]
        .map(([x, y, r]) => `<polygon points="${polygon(x!, y!, r!, 5)}" fill="${p.flat('hole')}" stroke="${p.line('rattan')}" stroke-width="1.6" stroke-linejoin="round"/>`)
        .join('');
      return `
        <circle cx="50" cy="52" r="36" fill="${p.ball('rattan')}"${p.edge('rattan')}/>
        <path d="M18 40 Q50 30 82 40 M16 58 Q50 70 84 58 M30 22 Q24 52 36 84 M70 22 Q76 52 64 84" fill="none" stroke="${p.shade('rattan')}" stroke-width="3"/>
        ${holes}
        ${p.spec(36, 32, 5, 3, -35)}`;
    },
  },
  // A football: white with black pentagon patches.
  bola: {
    palette: { panel: '#f4f4f0', patch: '#2e3038' },
    variants: { alt1: { panel: '#5a86d6' }, alt2: { panel: '#e6bc3c' } },
    draw: (p) => {
      const center = `<polygon points="${polygon(50, 52, 11, 5)}" fill="${p.flat('patch')}"/>`;
      const ring = [-90, -18, 54, 126, 198]
        .map((a) => {
          const [x, y] = polar(50, 52, 31, a);
          return `<polygon points="${polygon(x, y, 9, 5, a + 90)}" fill="${p.flat('patch')}"/>`;
        })
        .join('');
      const seams = [-90, -18, 54, 126, 198]
        .map((a) => {
          const [x1, y1] = polar(50, 52, 11, a);
          const [x2, y2] = polar(50, 52, 23, a);
          return `M${x1} ${y1} L${x2} ${y2}`;
        })
        .join(' ');
      return `
        <defs><clipPath id="ball"><circle cx="50" cy="52" r="35"/></clipPath></defs>
        <circle cx="50" cy="52" r="36" fill="${p.ball('panel')}"/>
        <g clip-path="url(#ball)">${center}${ring}<path d="${seams}" stroke="${p.line('panel')}" stroke-width="1.8"/></g>
        <circle cx="50" cy="52" r="36" fill="none"${p.edge('panel')}/>
        ${p.spec(34, 32, 5, 3, -35)}`;
    },
  },
  // A trophy cup with two handles, on a stem and a dark stepped base with a plate.
  piala: {
    palette: { gold: '#d9a42e', base: '#4a3020' },
    variants: { alt1: { gold: '#4f78c8' }, alt2: { gold: '#f6e7a0' } },
    draw: (p) => `
      <path d="M28 22 C12 22 12 46 32 48 M72 22 C88 22 88 46 68 48" fill="none" stroke="${p.line('gold')}" stroke-width="7"/>
      <path d="M28 22 C12 22 12 46 32 48 M72 22 C88 22 88 46 68 48" fill="none" stroke="${p.flat('gold')}" stroke-width="4"/>
      <path d="M24 14 L76 14 Q76 52 50 58 Q24 52 24 14 Z" fill="${p.fill('gold')}"${p.edge('gold')}/>
      <rect x="45" y="56" width="10" height="14" fill="${p.fill('gold')}"${p.edge('gold', 2)}/>
      <ellipse cx="50" cy="70" rx="14" ry="4" fill="${p.fill('gold')}"${p.edge('gold', 2)}/>
      <path d="M30 74 L70 74 L74 90 L26 90 Z" fill="${p.fill('base')}"${p.edge('base')}/>
      <rect x="40" y="79" width="20" height="6" rx="1.5" fill="${p.light('gold')}"/>
      <path d="M50 22 L52.6 29 L60 29 L54 33.5 L56.3 41 L50 36.4 L43.7 41 L46 33.5 L40 29 L47.4 29 Z" fill="${p.light('gold')}"/>
      ${p.spec(32, 24, 3, 7, 10)}`,
  },
  // A sports whistle on its cord: a round chamber with its open slot on top, a flat mouthpiece and a ring.
  peluit: {
    palette: { body: '#d8402e', cord: '#f2efe4' },
    variants: { alt1: { body: '#86aef0' }, alt2: { body: '#f2de7a' } },
    draw: (p) => `
      ${strand(p, 'cord', 'M22 46 C4 36 8 10 30 8 C50 6 58 16 60 24', 2.6)}
      <path d="M48 40 L90 40 Q94 40 94 45 L94 51 Q94 56 90 56 L60 58 Z" fill="${p.fill('body')}"${p.edge('body')}/>
      <circle cx="40" cy="62" r="25" fill="${p.ball('body')}"${p.edge('body')}/>
      <rect x="40" y="36" width="18" height="7" rx="2" fill="${p.line('body')}"/>
      <circle cx="22" cy="46" r="6" fill="none" stroke="${p.line('cord')}" stroke-width="3"/>
      ${p.spec(30, 52, 6, 3.4, -30)}`,
  },

  // ---------------------------------------------------------------- Permainan tradisional

  // A wooden spinning top: a turned body with painted rings, a peg on top and the iron tip below.
  gasing: {
    palette: { wood: '#a8682e', ring: '#c8382a', tip: '#8c9098' },
    variants: { alt1: { wood: '#7aaaf0' }, alt2: { wood: '#f2dc80' } },
    draw: (p) => `
      <path d="M46 6 L54 6 L55 24 L45 24 Z" fill="${p.fill('wood')}"${p.edge('wood', 2)}/>
      <path d="M14 42 Q14 22 50 22 Q86 22 86 42 Q86 56 54 82 L46 82 Q14 56 14 42 Z" fill="${p.fill('wood')}"${p.edge('wood')}/>
      <path d="M16 36 Q50 46 84 36 L85 44 Q50 54 15 44 Z" fill="${p.flat('ring')}"/>
      <path d="M26 58 Q50 66 74 58" fill="none" stroke="${p.flat('ring')}" stroke-width="3.4"/>
      <path d="M46 82 L54 82 L50 94 Z" fill="${p.fill('tip')}"${p.edge('tip', 1.6)}/>
      ${p.spec(30, 30, 6, 2.6, -15)}`,
  },
  // A congklak board: a long boat-shaped wooden board with two rows of cups and a store at each end, cowries in them.
  congklak: {
    palette: { board: '#9a5a26', shell: '#f4ead2' },
    variants: { alt1: { board: '#6f9ee8' }, alt2: { board: '#f0d77a' } },
    draw: (p) => {
      const cups = [24, 37, 50, 63, 76]
        .flatMap((x) => [
          [x, 46],
          [x, 62],
        ])
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="4" fill="${p.line('board')}"/>`)
        .join('');
      const shells = [
        [24, 45],
        [50, 61],
        [63, 45],
        [76, 61],
        [9, 53],
        [91, 53],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2.2" fill="${p.flat('shell')}"/>`)
        .join('');
      return `
        <path d="M4 54 Q4 34 18 34 L82 34 Q96 34 96 54 Q96 74 82 74 L18 74 Q4 74 4 54 Z" fill="${p.fill('board')}"${p.edge('board')}/>
        <path d="M4 66 Q8 82 22 82 L78 82 Q92 82 96 66" fill="${p.shade('board')}"${p.edge('board')}/>
        <ellipse cx="10" cy="54" rx="5" ry="10" fill="${p.line('board')}"/>
        <ellipse cx="90" cy="54" rx="5" ry="10" fill="${p.line('board')}"/>
        ${cups}${shells}
        <path d="M20 37 L80 37" stroke="${p.light('board')}" stroke-width="2" stroke-linecap="round"/>`;
    },
  },
  // Bamboo stilts: two tall poles with nodes, each with a footrest tied on low down.
  egrang: {
    palette: { bamboo: '#d8b84e', tie: '#7a4a26' },
    variants: { alt1: { bamboo: '#5a86d6' }, alt2: { bamboo: '#f8efc0' } },
    draw: (p) => {
      const pole = (x: number) =>
        `<rect x="${x - 5}" y="6" width="10" height="86" rx="4" fill="${p.fill('bamboo')}"${p.edge('bamboo')}/>` +
        [24, 44, 66].map((y) => `<path d="M${x - 5} ${y} L${x + 5} ${y}" stroke="${p.line('bamboo')}" stroke-width="2.2"/>`).join('');
      const foot = (x: number, dir: number) =>
        `<path d="M${x} 60 L${x + dir * 18} 60 L${x + dir * 18} 67 L${x} 70 Z" fill="${p.fill('tie')}"${p.edge('tie', 1.8)}/>` +
        `<path d="M${x - 5} 71 L${x + 5} 73 M${x - 5} 75 L${x + 5} 77" stroke="${p.flat('tie')}" stroke-width="2.4"/>`;
      return `${pole(36)}${pole(64)}${foot(31, -1)}${foot(69, 1)}${p.spec(34, 14, 1.6, 5)}${p.spec(62, 14, 1.6, 5)}`;
    },
  },
  // A yo-yo seen from the side: two round halves on an axle, the string running up from it.
  yoyo: {
    palette: { body: '#c8302a', rim: '#f2e8d0', cord: '#f4f2ea' },
    variants: { alt1: { body: '#7aa6ea' }, alt2: { body: '#f2e08a' } },
    draw: (p) => `
      ${strand(p, 'cord', 'M50 52 C56 34 70 22 64 6', 1.8)}
      <circle cx="50" cy="56" r="34" fill="${p.ball('body')}"${p.edge('body')}/>
      <circle cx="50" cy="56" r="22" fill="none" stroke="${p.flat('rim')}" stroke-width="4"/>
      <circle cx="50" cy="56" r="10" fill="${p.fill('body')}"${p.edge('body', 2)}/>
      <circle cx="50" cy="56" r="3.4" fill="${p.flat('rim')}"/>
      ${p.spec(36, 38, 6, 3.4, -35)}`,
  },
  // Bekel: a bouncy rubber ball and the metal jacks (biji bekel) scattered beside it.
  bekel: {
    palette: { ball: '#c8305e', jack: '#c9ccd2' },
    variants: { alt1: { ball: '#7aaaf0' }, alt2: { ball: '#f6e48e' } },
    draw: (p) => {
      const jack = (x: number, y: number, a: number) =>
        `<g transform="rotate(${a} ${x} ${y})"><rect x="${x - 8}" y="${y - 5}" width="16" height="10" rx="4" fill="${p.fill('jack')}"${p.edge('jack', 1.6)}/>` +
        `<ellipse cx="${x - 3}" cy="${y}" rx="2.4" ry="3" fill="${p.shade('jack')}"/><ellipse cx="${x + 3}" cy="${y}" rx="2.4" ry="3" fill="${p.shade('jack')}"/></g>`;
      return `
        ${jack(20, 80, -20)}${jack(42, 86, 15)}${jack(78, 82, 30)}${jack(84, 62, -40)}
        <circle cx="46" cy="44" r="27" fill="${p.ball('ball')}"${p.edge('ball')}/>
        <path d="M22 38 Q46 52 70 36" fill="none" stroke="${p.shade('ball')}" stroke-width="2.6"/>
        ${p.spec(36, 30, 6, 3.4, -35)}`;
    },
  },
  // A rubber band rope (lompat tali): rubber bands linked into a chain, looped in a figure of eight.
  'lompat-tali': {
    palette: { rubber: '#3f8a2a', other: '#e8a020' },
    variants: { alt1: { rubber: '#86aef0' }, alt2: { rubber: '#f4ea9a' } },
    draw: (p) => {
      const links: string[] = [];
      for (let i = 0; i < 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        const x = 50 + 36 * Math.sin(t);
        const y = 52 + 30 * Math.sin(t) * Math.cos(t);
        const material = i % 3 === 2 ? 'other' : 'rubber';
        const angle = r1((Math.atan2(30 * Math.cos(2 * t), 36 * Math.cos(t)) * 180) / Math.PI);
        links.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="7.5" ry="3.8" transform="rotate(${angle} ${r1(x)} ${r1(y)})" fill="none" stroke="${p.line(material)}" stroke-width="4.6"/>`);
        links.push(`<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="7.5" ry="3.8" transform="rotate(${angle} ${r1(x)} ${r1(y)})" fill="none" stroke="${p.flat(material)}" stroke-width="2.6"/>`);
      }
      return links.join('');
    },
  },

  // ---------------------------------------------------------------- Rempah Maluku

  // Cloves: three dried flower buds, each a thick tapering stem with a round head between four pointed sepals.
  cengkeh: {
    palette: { clove: '#a0522d' },
    variants: { alt1: { clove: '#7aaaf0' }, alt2: { clove: '#f2dc80' } },
    draw: (p) => {
      const clove = (x: number, y: number, a: number) => `<g transform="rotate(${a} ${x} ${y + 30})">
        <path d="M${x - 6} ${y + 6} L${x + 6} ${y + 6} L${x + 2.6} ${y + 58} L${x - 2.6} ${y + 58} Z" fill="${p.fill('clove')}"${p.edge('clove')}/>
        <path d="M${x - 15} ${y + 2} L${x - 7} ${y - 8} L${x} ${y} L${x + 7} ${y - 8} L${x + 15} ${y + 2} L${x + 7} ${y + 10} L${x - 7} ${y + 10} Z" fill="${p.fill('clove')}"${p.edge('clove')}/>
        <circle cx="${x}" cy="${y - 4}" r="7.6" fill="${p.ball('clove')}"${p.edge('clove')}/>
      </g>`;
      return `${clove(28, 26, -26)}${clove(72, 26, 26)}${clove(50, 18, 0)}${p.spec(47, 11, 2.4, 1.6)}`;
    },
  },
  // Nutmeg: the dark brown nut wrapped in its lacy red mace, beside half of its pale yellow fruit.
  pala: {
    palette: { mace: '#d0302a', nut: '#5e3a1e', fruit: '#f0dc96' },
    variants: { alt1: { mace: '#86aef0' }, alt2: { mace: '#f2de7a' } },
    draw: (p) => `
      <path d="M58 30 Q90 30 90 62 Q90 90 62 88 Q78 76 76 58 Q74 38 58 30 Z" fill="${p.fill('fruit')}"${p.edge('fruit')}/>
      <ellipse cx="44" cy="56" rx="26" ry="30" fill="${p.ball('nut')}"${p.edge('nut')}/>
      <path d="M28 34 Q36 46 30 62 Q38 74 34 84 M44 26 Q50 44 42 58 Q52 70 46 86 M60 32 Q56 46 62 60 Q56 72 60 82 M24 50 Q44 52 66 48 M24 70 Q44 66 64 72" fill="none" stroke="${p.line('mace')}" stroke-width="6.4" stroke-linecap="round"/>
      <path d="M28 34 Q36 46 30 62 Q38 74 34 84 M44 26 Q50 44 42 58 Q52 70 46 86 M60 32 Q56 46 62 60 Q56 72 60 82 M24 50 Q44 52 66 48 M24 70 Q44 66 64 72" fill="none" stroke="${p.flat('mace')}" stroke-width="4" stroke-linecap="round"/>
      ${p.spec(34, 38, 4, 2.4, -30)}`,
  },
  // Cinnamon sticks: three rolled quills of bark, ends showing their spiral, tied with a string.
  'kayu-manis': {
    palette: { bark: '#b0652e', string: '#f0e2c0' },
    variants: { alt1: { bark: '#7aaaf0' }, alt2: { bark: '#f2dc80' } },
    draw: (p) => {
      const quill = (y: number) =>
        `<rect x="12" y="${y - 8}" width="74" height="16" rx="7" fill="${p.fill('bark')}"${p.edge('bark')}/>` +
        `<ellipse cx="84" cy="${y}" rx="6" ry="8" fill="${p.shade('bark')}"${p.edge('bark', 2)}/>` +
        `<path d="M84 ${y - 4} Q88 ${y} 84 ${y + 4} Q81 ${y} 84 ${y - 1.5}" fill="none" stroke="${p.line('bark')}" stroke-width="1.8"/>` +
        `<path d="M20 ${y - 3} L70 ${y - 3}" stroke="${p.light('bark')}" stroke-width="2" stroke-linecap="round"/>`;
      return `<g transform="rotate(-18 50 52)">${quill(36)}${quill(52)}${quill(68)}
        ${strand(p, 'string', 'M42 26 L42 78', 2.6)}${strand(p, 'string', 'M50 26 L50 78', 2.6)}</g>`;
    },
  },
  // Peppercorns: a cluster of green berries hanging from a stalk, with a leaf.
  lada: {
    palette: { pepper: '#5a8a2e', leaf: '#3f7a2a', stalk: '#7a5a2e' },
    variants: { alt1: { pepper: '#7aaaf0' }, alt2: { pepper: '#f2dc80' } },
    draw: (p) => {
      const berries: string[] = [];
      for (let row = 0; row < 7; row++) {
        const y = 28 + row * 9;
        const n = row < 5 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const x = 50 + (k - (n - 1) / 2) * 10 + (row % 2 ? 4 : -2) - row * 1.2;
          berries.push(`<circle cx="${r1(x)}" cy="${y}" r="5.6" fill="${p.ball('pepper')}"${p.edge('pepper', 1.6)}/>`);
        }
      }
      return `
        <path d="M52 8 Q78 4 88 24 Q66 30 52 8 Z" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
        ${strand(p, 'stalk', 'M50 6 L50 22', 2.6)}
        ${berries.join('')}
        ${p.spec(42, 26, 1.8, 1.2)}`;
    },
  },
  // A stone mortar (cobek) with its pestle (ulekan) leaning in it, and a red chilli.
  cobek: {
    palette: { stone: '#a8a49a', chili: '#d0302a' },
    variants: { alt1: { stone: '#4f78c8' }, alt2: { stone: '#f2dc80' } },
    draw: (p) => `
      <ellipse cx="50" cy="56" rx="40" ry="11" fill="${p.shade('stone')}"${p.edge('stone')}/>
      <path d="M10 56 Q12 86 50 88 Q88 86 90 56 Q50 70 10 56 Z" fill="${p.fill('stone')}"${p.edge('stone')}/>
      <ellipse cx="50" cy="56" rx="32" ry="7" fill="${p.line('stone')}" opacity="0.55"/>
      <path d="M38 54 Q44 50 52 54" fill="none" stroke="${p.flat('chili')}" stroke-width="4.4" stroke-linecap="round"/>
      <path d="M52 52 L74 16 Q80 10 84 16 L64 54 Z" fill="${p.fill('stone')}"${p.edge('stone')}/>
      ${p.spec(78, 18, 2, 4, 30)}
      ${p.spec(24, 70, 4, 2.4, 20)}`,
  },
  // An open spice sack: rolled burlap with a heap of orange spice and a wooden scoop in it.
  'karung-rempah': {
    palette: { spice: '#e0782a', burlap: '#c8aa78', scoop: '#8a5a2e' },
    variants: { alt1: { spice: '#3a60b0' }, alt2: { spice: '#f6ea9a' } },
    draw: (p) => `
      <path d="M18 44 Q16 88 50 90 Q84 88 82 44 Z" fill="${p.fill('burlap')}"${p.edge('burlap')}/>
      <path d="M28 56 L28 84 M40 58 L40 88 M60 58 L60 88 M72 56 L72 84" stroke="${p.shade('burlap')}" stroke-width="1.6"/>
      <path d="M22 44 Q50 18 78 44 Q50 52 22 44 Z" fill="${p.fill('spice')}"${p.edge('spice')}/>
      <ellipse cx="50" cy="45" rx="34" ry="8" fill="${p.light('burlap')}"${p.edge('burlap')}/>
      <path d="M24 42 Q50 22 76 42 Q50 46 24 42 Z" fill="${p.fill('spice')}"/>
      ${[
        [38, 34],
        [52, 30],
        [62, 36],
        [46, 39],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${p.shade('spice')}"/>`)
        .join('')}
      ${strand(p, 'scoop', 'M64 34 L84 14', 3)}
      <ellipse cx="60" cy="38" rx="7" ry="4" transform="rotate(-40 60 38)" fill="${p.fill('scoop')}"${p.edge('scoop', 1.8)}/>
      ${p.spec(30, 66, 3, 6, 10)}`,
  },

  // ---------------------------------------------------------------- Sawah

  // A ripe rice ear: a stalk bending over under its drooping golden grains, with two leaves.
  padi: {
    palette: { grain: '#d8a838', leaf: '#5a9a3a' },
    variants: { alt1: { grain: '#4f78c8' }, alt2: { grain: '#f8eeb0' } },
    draw: (p) => {
      const grains: string[] = [];
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = 34 + 40 * Math.sin(t * 1.4);
        const y = 14 + 66 * t * t;
        for (const side of [-1, 1]) {
          const gx = r1(x + side * 6);
          const gy = r1(y + 2);
          grains.push(`<ellipse cx="${gx}" cy="${gy}" rx="3.6" ry="6" transform="rotate(${side * 30 - 20} ${gx} ${gy})" fill="${p.fill('grain')}"${p.edge('grain', 1.6)}/>`);
        }
      }
      return `
        ${strand(p, 'leaf', 'M22 92 Q24 40 36 12', 2.4)}
        <path d="M22 92 Q10 60 14 36 Q24 62 26 88 Z" fill="${p.fill('leaf')}"${p.edge('leaf', 1.8)}/>
        ${strand(p, 'grain', 'M36 12 Q72 14 74 80', 2)}
        ${grains.join('')}`;
    },
  },
  // A hoe (cangkul): a long wooden handle, and at its end a broad steel blade bent back towards it.
  cangkul: {
    palette: { handle: '#b8743a', blade: '#b8bcc4' },
    variants: { alt1: { handle: '#86b4f6' }, alt2: { handle: '#f8e8a0' } },
    draw: (p) => `
      ${strand(p, 'handle', 'M14 92 L70 18', 7)}
      <path d="M62 14 L92 30 L88 68 Q72 74 58 64 L66 36 Z" fill="${p.fill('blade')}"${p.edge('blade')}/>
      <path d="M64 12 L78 20 L74 30 L60 22 Z" fill="${p.shade('blade')}"${p.edge('blade', 1.8)}/>
      <path d="M68 40 L84 38" stroke="${p.light('blade')}" stroke-width="2.4" stroke-linecap="round"/>
      ${p.spec(30, 70, 1.8, 6, 37)}`,
  },
  // A scarecrow: a straw-stuffed figure on a cross pole, in a red shirt and a conical straw hat.
  'orang-orangan': {
    palette: { shirt: '#c8382a', straw: '#e6c66a', pole: '#7a4a26', face: '#f0dcb0' },
    variants: { alt1: { shirt: '#86aef0' }, alt2: { shirt: '#f2de7a' } },
    draw: (p) => `
      ${strand(p, 'pole', 'M50 30 L50 96', 4)}
      ${strand(p, 'pole', 'M10 50 L90 50', 3.4)}
      <path d="M22 44 L78 44 L70 58 L62 58 L64 80 L36 80 L38 58 L30 58 Z" fill="${p.fill('shirt')}"${p.edge('shirt')}/>
      <path d="M14 46 L8 54 M86 46 L92 54 M40 80 L36 88 M60 80 L64 88" stroke="${p.flat('straw')}" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="50" cy="34" r="10" fill="${p.ball('face')}"${p.edge('face')}/>
      <path d="M45 34 L47 36 M53 34 L55 36 M45 39 Q50 42 55 39" stroke="${p.line('face')}" stroke-width="1.8" fill="none"/>
      <path d="M22 28 L50 6 L78 28 Q50 34 22 28 Z" fill="${p.fill('straw')}"${p.edge('straw')}/>
      <path d="M44 60 L56 60 M44 68 L56 68" stroke="${p.line('shirt')}" stroke-width="1.6"/>`,
  },
  // A water buffalo's head from the front: a broad grey face with wide sweeping horns and drooping ears.
  kerbau: {
    palette: { hide: '#8e8a84', horn: '#e8dcc0', nose: '#4a4440' },
    variants: { alt1: { hide: '#3a60b0' }, alt2: { hide: '#eed890' } },
    draw: (p) => `
      <path d="M36 36 C24 36 6 30 6 14 C14 24 24 24 38 26 Z" fill="${p.fill('horn')}"${p.edge('horn')}/>
      <path d="M64 36 C76 36 94 30 94 14 C86 24 76 24 62 26 Z" fill="${p.fill('horn')}"${p.edge('horn')}/>
      <ellipse cx="20" cy="46" rx="12" ry="6" transform="rotate(20 20 46)" fill="${p.fill('hide')}"${p.edge('hide')}/>
      <ellipse cx="80" cy="46" rx="12" ry="6" transform="rotate(-20 80 46)" fill="${p.fill('hide')}"${p.edge('hide')}/>
      <path d="M32 30 Q50 22 68 30 Q72 56 64 76 Q50 84 36 76 Q28 56 32 30 Z" fill="${p.fill('hide')}"${p.edge('hide')}/>
      <ellipse cx="50" cy="76" rx="15" ry="10" fill="${p.fill('nose')}"${p.edge('nose')}/>
      <ellipse cx="44" cy="77" rx="2.6" ry="3.4" fill="${p.line('nose')}"/><ellipse cx="56" cy="77" rx="2.6" ry="3.4" fill="${p.line('nose')}"/>
      <circle cx="40" cy="46" r="3" fill="${p.line('hide')}"/><circle cx="60" cy="46" r="3" fill="${p.line('hide')}"/>
      ${p.spec(42, 34, 5, 2.4, -10)}`,
  },
  // A bakul: a round woven bamboo basket heaped with white rice.
  bakul: {
    palette: { weave: '#d0a868', rice: '#f8f6ee' },
    variants: { alt1: { weave: '#4f78c8' }, alt2: { weave: '#f8ecb0' } },
    draw: (p) => {
      const weave: string[] = [];
      for (let x = 22; x <= 78; x += 8) weave.push(`M${x} 50 L${x + 4} 84`);
      for (let y = 58; y <= 80; y += 8) weave.push(`M18 ${y} Q50 ${y + 6} 82 ${y}`);
      return `
        <path d="M18 42 Q50 4 82 42 Z" fill="${p.ball('rice')}"${p.edge('rice')}/>
        ${[
          [40, 30],
          [52, 24],
          [60, 34],
          [46, 38],
        ]
          .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.4" fill="${p.shade('rice')}"/>`)
          .join('')}
        <path d="M12 44 L88 44 L78 86 Q50 92 22 86 Z" fill="${p.fill('weave')}"${p.edge('weave')}/>
        <path d="${weave.join(' ')}" fill="none" stroke="${p.shade('weave')}" stroke-width="2"/>
        <rect x="10" y="40" width="80" height="9" rx="4" fill="${p.light('weave')}"${p.edge('weave', 2)}/>
        ${p.spec(26, 60, 2.4, 6, 10)}`;
    },
  },
  // A gubuk: a small hut on stilts above the rice field, with a steep thatched roof.
  gubuk: {
    palette: { roof: '#c89a48', post: '#7a4a26', wall: '#e0c48a' },
    variants: { alt1: { roof: '#4a72c0' }, alt2: { roof: '#f6e6a0' } },
    draw: (p) => `
      ${strand(p, 'post', 'M24 54 L24 92 M76 54 L76 92 M50 58 L50 92', 3.4)}
      ${strand(p, 'post', 'M18 70 L82 70', 3)}
      <rect x="22" y="44" width="56" height="18" fill="${p.fill('wall')}"${p.edge('wall')}/>
      <path d="M32 44 L32 62 M42 44 L42 62 M58 44 L58 62 M68 44 L68 62" stroke="${p.shade('wall')}" stroke-width="1.8"/>
      <path d="M6 48 L50 8 L94 48 Z" fill="${p.fill('roof')}"${p.edge('roof')}/>
      <path d="M20 40 L50 14 M30 44 L50 24 M80 40 L50 14 M70 44 L50 24" stroke="${p.shade('roof')}" stroke-width="1.8"/>
      <path d="M50 8 L50 3" stroke="${p.line('roof')}" stroke-width="3" stroke-linecap="round"/>
      ${p.spec(36, 28, 2, 6, -45)}`,
  },

  // ---------------------------------------------------------------- Fauna Nusantara

  // A Komodo dragon walking: a long heavy body and tail, splayed legs, and a forked yellow tongue.
  komodo: {
    palette: { skin: '#8a8a5a', belly: '#c8c098', tongue: '#e8b830' },
    variants: { alt1: { skin: '#3458a8' }, alt2: { skin: '#eed890' } },
    draw: (p) => `
      <path d="M6 44 L0 40 M6 44 L0 48" stroke="${p.flat('tongue')}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M20 58 L14 74 L22 74 M40 62 L36 80 L44 80 M60 62 L64 80 L72 80 M76 58 L84 72 L90 70" fill="none" stroke="${p.line('skin')}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 58 L14 74 L22 74 M40 62 L36 80 L44 80 M60 62 L64 80 L72 80 M76 58 L84 72 L90 70" fill="none" stroke="${p.flat('skin')}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 44 Q8 36 18 36 L30 38 Q50 34 72 42 Q86 46 98 62 Q84 56 72 60 Q50 68 28 60 Q16 56 10 50 Z" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <path d="M26 56 Q50 64 72 56" fill="none" stroke="${p.flat('belly')}" stroke-width="3"/>
      <circle cx="16" cy="41" r="2.2" fill="${p.line('skin')}"/>
      <path d="M36 44 L40 42 M48 42 L52 40 M60 44 L64 42" stroke="${p.shade('skin')}" stroke-width="2.4" stroke-linecap="round"/>
      ${p.spec(46, 40, 6, 1.6, -4)}`,
  },
  // An orangutan's face: shaggy orange hair around a broad bare face with a wide mouth.
  orangutan: {
    palette: { fur: '#c8662a', face: '#5e4434', muzzle: '#9a7a62' },
    variants: { alt1: { fur: '#86b4f6' }, alt2: { fur: '#f8e8a0' } },
    draw: (p) => `
      <path d="M50 8 Q70 8 80 22 Q96 30 92 52 Q96 70 84 80 Q70 94 50 92 Q30 94 16 80 Q4 70 8 52 Q4 30 20 22 Q30 8 50 8 Z" fill="${p.fill('fur')}"${p.edge('fur')}/>
      <path d="M22 30 L16 24 M78 30 L84 24 M14 52 L6 52 M86 52 L94 52 M30 84 L26 92 M70 84 L74 92" stroke="${p.shade('fur')}" stroke-width="3" stroke-linecap="round"/>
      <path d="M50 22 Q72 22 72 46 Q74 74 50 80 Q26 74 28 46 Q28 22 50 22 Z" fill="${p.fill('face')}"${p.edge('face')}/>
      <ellipse cx="50" cy="64" rx="15" ry="11" fill="${p.fill('muzzle')}"${p.edge('muzzle', 1.8)}/>
      <circle cx="41" cy="44" r="3.4" fill="${p.line('face')}"/><circle cx="59" cy="44" r="3.4" fill="${p.line('face')}"/>
      <circle cx="42" cy="43" r="1" fill="${p.light('muzzle')}"/><circle cx="60" cy="43" r="1" fill="${p.light('muzzle')}"/>
      <path d="M46 56 L46 58 M54 56 L54 58 M40 68 Q50 74 60 68" stroke="${p.line('muzzle')}" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${p.spec(30, 22, 5, 2.4, -30)}`,
  },
  // A hornbill (rangkong): a black bird with a huge curved beak crowned by an orange casque, and a white tail.
  rangkong: {
    palette: { casque: '#e8902e', body: '#5a5a6e', white: '#f4f2ea', beak: '#f2dc8a' },
    variants: { alt1: { casque: '#3f6fc8' }, alt2: { casque: '#f8f0b8' } },
    draw: (p) => `
      <path d="M72 66 L94 86 L82 92 L64 72 Z" fill="${p.fill('white')}"${p.edge('white')}/>
      <path d="M40 42 Q70 40 78 68 Q60 84 42 74 Q30 62 40 42 Z" fill="${p.fill('body')}"${p.edge('body')}/>
      <circle cx="40" cy="36" r="13" fill="${p.ball('body')}"${p.edge('body')}/>
      <path d="M30 38 Q14 40 4 58 Q20 48 30 46 Z" fill="${p.fill('beak')}"${p.edge('beak')}/>
      <path d="M28 30 Q16 22 6 40 Q18 34 32 36 Z" fill="${p.fill('casque')}"${p.edge('casque')}/>
      <circle cx="42" cy="34" r="2.6" fill="${p.flat('white')}"/><circle cx="42" cy="34" r="1.3" fill="${p.line('body')}"/>
      <path d="M50 54 Q60 58 64 68" fill="none" stroke="${p.light('body')}" stroke-width="2"/>
      ${p.spec(18, 30, 3, 1.6, -30)}`,
  },
  // A sea turtle seen from above: a domed shell of plates, four flippers and a small head.
  penyu: {
    palette: { shell: '#9a7a3e', skin: '#7a9a6a' },
    variants: { alt1: { shell: '#86b4f6' }, alt2: { shell: '#f8e8a0' } },
    draw: (p) => `
      <path d="M30 34 Q8 22 6 38 Q18 42 30 44 Z M70 34 Q92 22 94 38 Q82 42 70 44 Z M32 70 Q16 84 22 90 Q32 80 38 74 Z M68 70 Q84 84 78 90 Q68 80 62 74 Z" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <ellipse cx="50" cy="16" rx="8" ry="9" fill="${p.ball('skin')}"${p.edge('skin')}/>
      <ellipse cx="50" cy="54" rx="26" ry="32" fill="${p.ball('shell')}"${p.edge('shell')}/>
      <polygon points="${polygon(50, 50, 9, 6)}" fill="none" stroke="${p.line('shell')}" stroke-width="2"/>
      <path d="M50 22 L50 41 M50 59 L50 85 M42 45 L27 38 M58 45 L73 38 M42 55 L26 66 M58 55 L74 66" stroke="${p.line('shell')}" stroke-width="2"/>
      ${p.spec(40, 36, 5, 3, -30)}`,
  },
  // A bird of paradise (cendrawasih): a small dark bird with a yellow head and a cascade of long golden plumes.
  cendrawasih: {
    palette: { plume: '#f0b030', body: '#7a3a22', throat: '#3a9a6a' },
    variants: { alt1: { plume: '#3f6fc8' }, alt2: { plume: '#fbf2c8' } },
    draw: (p) => `
      <path d="M44 50 Q60 70 52 96 Q70 74 64 50 Z" fill="${p.fill('plume')}"${p.edge('plume')}/>
      <path d="M50 48 Q82 58 92 90 Q88 62 66 46 Z" fill="${p.fill('plume')}"${p.edge('plume')}/>
      <path d="M40 50 Q20 66 18 94 Q34 70 52 54 Z" fill="${p.fill('plume')}"${p.edge('plume')}/>
      <path d="M58 52 Q70 58 76 76" fill="none" stroke="${p.shade('plume')}" stroke-width="2"/>
      <path d="M36 30 Q60 26 66 44 Q60 58 44 56 Q32 50 36 30 Z" fill="${p.fill('body')}"${p.edge('body')}/>
      <circle cx="38" cy="26" r="11" fill="${p.ball('plume')}"${p.edge('plume')}/>
      <path d="M30 34 Q38 42 48 36 Q44 46 34 42 Z" fill="${p.flat('throat')}"/>
      <path d="M28 24 L18 28 L28 30 Z" fill="${p.light('plume')}"${p.edge('plume', 1.6)}/>
      <circle cx="35" cy="23" r="2" fill="${p.line('body')}"/>
      ${p.spec(42, 18, 3, 1.6, -20)}`,
  },
  // A tarsier clinging to a branch: a tiny furry body with enormous round eyes and big ears.
  tarsius: {
    palette: { fur: '#b08a5a', eye: '#e8b030', branch: '#6a4424' },
    variants: { alt1: { fur: '#3a60b0' }, alt2: { fur: '#f6e6a8' } },
    draw: (p) => `
      ${strand(p, 'branch', 'M4 84 Q50 76 96 88', 5)}
      <path d="M30 58 Q50 46 70 58 Q74 80 50 84 Q26 80 30 58 Z" fill="${p.fill('fur')}"${p.edge('fur')}/>
      <path d="M32 80 L26 88 M68 80 L74 88" stroke="${p.line('fur')}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="24" cy="20" rx="9" ry="12" transform="rotate(-25 24 20)" fill="${p.fill('fur')}"${p.edge('fur')}/>
      <ellipse cx="76" cy="20" rx="9" ry="12" transform="rotate(25 76 20)" fill="${p.fill('fur')}"${p.edge('fur')}/>
      <ellipse cx="50" cy="38" rx="30" ry="24" fill="${p.ball('fur')}"${p.edge('fur')}/>
      <circle cx="36" cy="36" r="12" fill="${p.ball('eye')}"${p.edge('eye')}/>
      <circle cx="64" cy="36" r="12" fill="${p.ball('eye')}"${p.edge('eye')}/>
      <circle cx="36" cy="36" r="6.4" fill="${p.line('fur')}"/><circle cx="64" cy="36" r="6.4" fill="${p.line('fur')}"/>
      <circle cx="33" cy="33" r="2" fill="${p.light('eye')}"/><circle cx="61" cy="33" r="2" fill="${p.light('eye')}"/>
      <path d="M47 52 Q50 55 53 52" fill="none" stroke="${p.line('fur')}" stroke-width="1.8" stroke-linecap="round"/>`,
  },
};

