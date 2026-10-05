import { r1, spikyEllipse, type IconTemplate, type Paint } from './template';

/** A line drawn twice: its outline, then its colour (cords, poles, rays). */
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

/** Cultural objects that themed levels bring (not food), in the same style as the food icons. */
export const CULTURAL_TEMPLATES: Readonly<Record<string, IconTemplate>> = {
  // ---------------------------------------------------------------- Budaya Jawa

  // A Javanese batik headcloth: a rounded cap with a band and the knot at the back.
  blangkon: {
    palette: { cloth: '#8a5a2e', pattern: '#ecc878', band: '#5a3a1e' },
    variants: { alt1: { cloth: '#5d8fd6' }, alt2: { cloth: '#e9c25a' } },
    draw: (p) => `
      <ellipse cx="76" cy="60" rx="14" ry="12" fill="${p.fill('cloth')}"${p.edge('cloth')}/>
      <path d="M16 66 C16 36 32 24 50 24 C68 24 84 36 84 66 Z" fill="${p.fill('cloth')}"${p.edge('cloth')}/>
      ${[
        [34, 42, 40],
        [50, 34, -40],
        [66, 42, 40],
        [42, 54, -40],
        [58, 54, 40],
        [28, 58, -40],
        [72, 58, 40],
      ]
        .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="1.8" transform="rotate(${a} ${x} ${y})" fill="${p.flat('pattern')}"/><ellipse cx="${x}" cy="${y}" rx="3.6" ry="1.8" transform="rotate(${-a!} ${x} ${y})" fill="${p.flat('pattern')}"/>`)
        .join('')}
      <path d="M14 62 Q50 72 86 62 L86 72 Q50 82 14 72 Z" fill="${p.fill('band')}"${p.edge('band')}/>
      ${p.spec(34, 34, 6, 2.6, -30)}`,
  },
  // Folded batik cloth: three folds, each with a band of parang stripes.
  batik: {
    palette: { cloth: '#7a4a2a', motif: '#f0d9a0' },
    variants: { alt1: { cloth: '#6f93dc' }, alt2: { cloth: '#e4c25a' } },
    draw: (p) => {
      const fold = (x: number, y: number, w: number, h: number) => {
        const dashes: string[] = [];
        for (let dx = 4; dx < w - 6; dx += 7) dashes.push(`M${x + dx} ${y + h - 3} L${x + dx + 5} ${y + 3}`);
        return (
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${p.fill('cloth')}"${p.edge('cloth')}/>` +
          `<path d="${dashes.join(' ')}" stroke="${p.flat('motif')}" stroke-width="2.4" stroke-linecap="round"/>` +
          `<path d="M${x + 4} ${y + 1.5} L${x + w - 4} ${y + 1.5}" stroke="${p.light('cloth')}" stroke-width="2"/>`
        );
      };
      return `${fold(12, 66, 76, 20)}${fold(16, 46, 68, 21)}${fold(20, 26, 60, 21)}${p.spec(30, 30, 6, 1.6)}`;
    },
  },
  // A wayang kulit shadow puppet: a slim ornate figure on its central rod, with rods on both arms.
  'wayang-kulit': {
    palette: { leather: '#c8902e', stick: '#6a4424', paint: '#b0302a' },
    variants: { alt1: { leather: '#3f5fa8' }, alt2: { leather: '#f2dc8a' } },
    draw: (p) => `
      ${strand(p, 'stick', 'M50 10 L50 96', 2.6)}
      ${strand(p, 'leather', 'M60 38 Q74 44 80 60', 3.4)}${strand(p, 'stick', 'M80 60 L88 94', 1.8)}
      ${strand(p, 'leather', 'M40 38 Q26 44 20 60', 3.4)}${strand(p, 'stick', 'M20 60 L12 94', 1.8)}
      <path d="M50 10 C58 12 60 20 56 27 L62 33 C70 40 70 56 64 66 L66 86 L54 86 L52 70 L48 70 L46 86 L34 86 L36 66 C30 56 30 40 38 33 L44 27 C40 20 42 12 50 10 Z" fill="${p.fill('leather')}"${p.edge('leather')}/>
      <path d="M44 14 L50 4 L56 14 Z" fill="${p.flat('paint')}"${p.edge('paint', 1.6)}/>
      <path d="M37 60 L63 60 L64 66 L36 66 Z" fill="${p.flat('paint')}"/>
      ${[
        [50, 40],
        [45, 47],
        [55, 47],
        [50, 54],
        [43, 74],
        [57, 74],
        [50, 20],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${p.line('leather')}"/>`)
        .join('')}
      ${p.spec(42, 40, 2.4, 5, 10)}`,
  },
  // A kendang: a barrel drum on its side, laced from head to head.
  kendang: {
    palette: { wood: '#9a5a2a', skin: '#efe2c0', cord: '#5a3418' },
    variants: { alt1: { wood: '#7f9de0' }, alt2: { wood: '#efd27a' } },
    draw: (p) => `
      <path d="M16 40 Q50 28 84 40 L84 72 Q50 84 16 72 Z" fill="${p.fill('wood')}"${p.edge('wood')}/>
      <path d="M26 38 L26 76 M74 36 L74 78" stroke="${p.shade('wood')}" stroke-width="2.4"/>
      <path d="M18 44 L32 72 L46 40 L60 74 L74 40 L82 66" fill="none" stroke="${p.flat('cord')}" stroke-width="2.4" stroke-linejoin="round"/>
      <ellipse cx="16" cy="56" rx="6.5" ry="16" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <ellipse cx="84" cy="56" rx="7.5" ry="17" fill="${p.fill('skin')}"${p.edge('skin')}/>
      ${p.spec(42, 40, 9, 2.4, -6)}`,
  },
  // A bronze gong with its raised centre, hanging in a wooden frame.
  gong: {
    palette: { bronze: '#c99a38', frame: '#7a4a24', cord: '#b0302a' },
    variants: { alt1: { bronze: '#4a6cb8' }, alt2: { bronze: '#f3e09a' } },
    draw: (p) => `
      <rect x="14" y="18" width="7" height="72" rx="2" fill="${p.fill('frame')}"${p.edge('frame', 2)}/>
      <rect x="79" y="18" width="7" height="72" rx="2" fill="${p.fill('frame')}"${p.edge('frame', 2)}/>
      <rect x="8" y="14" width="84" height="8" rx="3" fill="${p.fill('frame')}"${p.edge('frame', 2)}/>
      <path d="M40 22 L44 34 M60 22 L56 34" stroke="${p.flat('cord')}" stroke-width="2.4"/>
      <circle cx="50" cy="60" r="26" fill="${p.ball('bronze')}"${p.edge('bronze')}/>
      <circle cx="50" cy="60" r="18" fill="none" stroke="${p.shade('bronze')}" stroke-width="2"/>
      <circle cx="50" cy="60" r="8" fill="${p.ball('bronze')}"${p.edge('bronze', 2)}/>
      ${p.spec(40, 48, 5, 2.6, -35)}${p.spec(47, 56, 2, 1.2, -35)}`,
  },
  // A caping: a wide conical woven hat with its chin strap.
  caping: {
    palette: { straw: '#e0c27a', strap: '#7a4a24' },
    variants: { alt1: { straw: '#3f5fa8' }, alt2: { straw: '#b8862a' } },
    draw: (p) => `
      <path d="M32 72 Q50 94 68 72" fill="none" stroke="${p.flat('strap')}" stroke-width="2.4"/>
      <path d="M6 70 L50 14 L94 70 Q50 82 6 70 Z" fill="${p.fill('straw')}"${p.edge('straw')}/>
      <path d="M50 14 L18 72 M50 14 L32 75 M50 14 L44 76 M50 14 L56 76 M50 14 L68 75 M50 14 L82 72" stroke="${p.shade('straw')}" stroke-width="1.4"/>
      <path d="M30 42 Q50 47 70 42 M18 57 Q50 64 82 57" fill="none" stroke="${p.shade('straw')}" stroke-width="1.6"/>
      <circle cx="50" cy="14" r="3" fill="${p.fill('straw')}"${p.edge('straw', 1.6)}/>
      ${p.spec(38, 36, 6, 2.4, -50)}`,
  },
  // An open folding fan with pleats and a painted band.
  kipas: {
    palette: { leaf: '#c8382e', rib: '#7a4a24', motif: '#f0d9a0' },
    variants: { alt1: { leaf: '#7f9de0' }, alt2: { leaf: '#f1d36a' } },
    draw: (p) => {
      const cx = 50;
      const cy = 82;
      const [ox0, oy0] = polar(cx, cy, 46, -165);
      const [ox1, oy1] = polar(cx, cy, 46, -15);
      const [ix0, iy0] = polar(cx, cy, 14, -165);
      const [ix1, iy1] = polar(cx, cy, 14, -15);
      const pleats = Array.from({ length: 9 }, (_, i) => {
        const a = -165 + (i + 1) * 15;
        const [x0, y0] = polar(cx, cy, 14, a);
        const [x1, y1] = polar(cx, cy, 46, a);
        return `M${x0} ${y0} L${x1} ${y1}`;
      }).join(' ');
      const [bx0, by0] = polar(cx, cy, 37, -160);
      const [bx1, by1] = polar(cx, cy, 37, -20);
      return `
        <path d="M${ix0} ${iy0} L${ox0} ${oy0} A46 46 0 0 1 ${ox1} ${oy1} L${ix1} ${iy1} A14 14 0 0 0 ${ix0} ${iy0} Z" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
        <path d="${pleats}" stroke="${p.shade('leaf')}" stroke-width="1.6"/>
        <path d="M${bx0} ${by0} A37 37 0 0 1 ${bx1} ${by1}" fill="none" stroke="${p.flat('motif')}" stroke-width="3"/>
        ${strand(p, 'rib', `M${cx} ${cy} L${ix0} ${iy0} M${cx} ${cy} L${ix1} ${iy1}`, 2.4)}
        <circle cx="${cx}" cy="${cy}" r="3.6" fill="${p.fill('rib')}"${p.edge('rib', 1.6)}/>
        ${p.spec(30, 50, 5, 2, -40)}`;
    },
  },

  // ---------------------------------------------------------------- 17 Agustus

  // The red and white flag (red on top) on a bamboo pole, standing in a painted tin.
  bendera: {
    palette: { red: '#d8282a', white: '#f6f4ee', pole: '#d8c08a', knob: '#e0b040', stand: '#c9762a' },
    variants: { alt1: { stand: '#3f5fa8' }, alt2: { stand: '#f1d36a' } },
    draw: (p) => `
      <rect x="26" y="10" width="5" height="62" rx="2" fill="${p.fill('pole')}"${p.edge('pole', 1.8)}/>
      <circle cx="28.5" cy="9" r="3.6" fill="${p.ball('knob')}"${p.edge('knob', 1.4)}/>
      <path d="M31 14 Q48 10 62 14 T90 14 L90 30 Q74 26 62 30 T31 30 Z" fill="${p.fill('red')}"${p.edge('red', 2)}/>
      <path d="M31 30 Q48 26 62 30 T90 30 L90 46 Q74 42 62 46 T31 46 Z" fill="${p.fill('white')}"${p.edge('white', 2)}/>
      <path d="M6 68 L52 68 L46 94 L12 94 Z" fill="${p.fill('stand')}"${p.edge('stand')}/>
      <ellipse cx="29" cy="68" rx="23" ry="5" fill="${p.light('stand')}"${p.edge('stand', 1.8)}/>
      <path d="M10 80 L49 80" stroke="${p.shade('stand')}" stroke-width="2.4"/>
      ${p.spec(16, 78, 2.4, 6, 10)}`,
  },
  // A burlap sack for the sack race, with handles and a printed stripe.
  karung: {
    palette: { sack: '#c8a46a', rope: '#7a4a24', print: '#c8382e' },
    variants: { alt1: { sack: '#4a6cb8' }, alt2: { sack: '#f1e4a8' } },
    draw: (p) => {
      const weave: string[] = [];
      for (let x = 30; x <= 70; x += 8) weave.push(`M${x} 42 L${x - 1} 84`);
      for (let y = 48; y <= 82; y += 8) weave.push(`M26 ${y} L74 ${y}`);
      return `
        ${strand(p, 'rope', 'M30 32 Q24 12 40 16', 2.4)}${strand(p, 'rope', 'M70 32 Q76 12 60 16', 2.4)}
        <path d="M22 32 Q15 62 22 90 L78 90 Q85 62 78 32 Q50 24 22 32 Z" fill="${p.fill('sack')}"${p.edge('sack')}/>
        <path d="${weave.join(' ')}" stroke="${p.shade('sack')}" stroke-width="1.2" opacity="0.7"/>
        <rect x="21" y="56" width="58" height="9" fill="${p.flat('print')}" opacity="0.9"/>
        <path d="M20 32 Q50 20 80 32 L78 40 Q50 30 22 40 Z" fill="${p.light('sack')}"${p.edge('sack', 2)}/>
        ${p.spec(32, 50, 3, 7, 10)}`;
    },
  },
  // Lomba kelereng: a glass marble balanced on a spoon.
  kelereng: {
    palette: { spoon: '#c9d2da', marble: '#3fb08a', swirl: '#f6f4ee' },
    variants: { alt1: { marble: '#3f5fa8' }, alt2: { marble: '#f1d36a' } },
    draw: (p) => `
      ${strand(p, 'spoon', 'M16 92 L50 56', 5)}
      <ellipse cx="62" cy="48" rx="24" ry="16" transform="rotate(-38 62 48)" fill="${p.fill('spoon')}"${p.edge('spoon')}/>
      <ellipse cx="63" cy="47" rx="17" ry="10" transform="rotate(-38 63 47)" fill="${p.shade('spoon')}" opacity="0.6"/>
      <circle cx="63" cy="42" r="14" fill="${p.ball('marble')}"${p.edge('marble')}/>
      <path d="M53 44 Q60 34 66 42 T76 40" fill="none" stroke="${p.flat('swirl')}" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>
      ${p.spec(57, 35, 4, 2.6, -35)}`,
  },
  // Panjat pinang: the greasy pole with prizes hanging from the hoop at its top, and a small flag.
  'panjat-pinang': {
    palette: { pole: '#9a6a3a', ring: '#d8a83a', gift: '#c8382e', red: '#d8282a', white: '#f6f4ee' },
    variants: { alt1: { gift: '#7f9de0' }, alt2: { gift: '#f3e08a' } },
    draw: (p) => `
      <rect x="46" y="22" width="8" height="72" rx="3" fill="${p.fill('pole')}"${p.edge('pole', 2)}/>
      <path d="M49 30 L49 90" stroke="${p.light('pole')}" stroke-width="1.6"/>
      <path d="M54 4 L54 22" stroke="${p.line('pole')}" stroke-width="2"/>
      <rect x="55" y="5" width="12" height="4" fill="${p.flat('red')}"/><rect x="55" y="9" width="12" height="4" fill="${p.flat('white')}"/>
      <path d="M20 34 L20 42 M37 36 L37 45 M65 36 L65 46 M82 34 L82 40" stroke="${p.line('ring')}" stroke-width="1.4"/>
      <ellipse cx="50" cy="30" rx="32" ry="7" fill="none" stroke="${p.line('ring')}" stroke-width="5.4"/>
      <ellipse cx="50" cy="30" rx="32" ry="7" fill="none" stroke="${p.flat('ring')}" stroke-width="3.2"/>
      <rect x="11" y="42" width="19" height="17" rx="2" fill="${p.fill('gift')}"${p.edge('gift', 2)}/>
      <path d="M20.5 42 L20.5 59 M11 50 L30 50" stroke="${p.light('gift')}" stroke-width="2"/>
      <circle cx="37" cy="54" r="9" fill="${p.ball('gift')}"${p.edge('gift', 2)}/>
      <rect x="57" y="46" width="16" height="19" rx="2" fill="${p.fill('gift')}"${p.edge('gift', 2)}/>
      <path d="M65 46 L65 65" stroke="${p.light('gift')}" stroke-width="2"/>
      <circle cx="82" cy="48" r="8" fill="${p.ball('gift')}"${p.edge('gift', 2)}/>`,
  },
  // A peci: the oval velvet cap, with its sheen.
  peci: {
    palette: { velvet: '#5a5f70' },
    variants: { alt1: { velvet: '#86a3dc' }, alt2: { velvet: '#efd06a' } },
    draw: (p) => `
      <path d="M14 70 L18 36 Q50 26 82 36 L86 70 Q50 78 14 70 Z" fill="${p.fill('velvet')}"${p.edge('velvet')}/>
      <ellipse cx="50" cy="36" rx="32" ry="8" fill="${p.light('velvet')}"${p.edge('velvet')}/>
      <path d="M16 62 Q50 70 84 62" fill="none" stroke="${p.shade('velvet')}" stroke-width="2.4"/>
      <path d="M28 40 L26 64" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.35"/>
      ${p.spec(34, 34, 7, 1.6)}`,
  },
  // A paper trumpet: a striped cone with a fringed bell.
  terompet: {
    palette: { paper: '#e0483a', stripe: '#f6f4ee', fringe: '#f1c23a' },
    variants: { alt1: { paper: '#9db8ec' }, alt2: { paper: '#f8eebc' } },
    draw: (p) => {
      const stripes = [-28, -12, 4, 18]
        .map((x) => {
          const h0 = 3 + ((x + 40) / 70) * 11;
          const h1 = 3 + ((x + 46) / 70) * 11;
          return `<polygon points="${x},${-h0} ${x + 6},${-h1} ${x + 6},${h1} ${x},${h0}" fill="${p.flat('stripe')}"/>`;
        })
        .join('');
      const fringe = Array.from({ length: 9 }, (_, i) => {
        const y = -14 + i * 3.5;
        return `M30 ${r1(y)} L37 ${r1(y * 1.25)}`;
      }).join(' ');
      return `<g transform="translate(46 54) rotate(-38)">
        <rect x="-46" y="-3" width="8" height="6" rx="2" fill="${p.fill('fringe')}"${p.edge('fringe', 1.6)}/>
        <polygon points="-40,-3 30,-14 30,14 -40,3" fill="${p.fill('paper')}"${p.edge('paper')}/>
        ${stripes}
        <path d="${fringe}" stroke="${p.flat('fringe')}" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="30" cy="0" rx="4.5" ry="14.5" fill="${p.light('paper')}"${p.edge('paper', 2)}/>
        ${p.spec(-8, -5, 8, 1.6)}
      </g>`;
    },
  },

  // ---------------------------------------------------------------- Pasar malam

  // A round ribbed paper lantern with gold caps and a tassel.
  lampion: {
    palette: { paper: '#d8322a', cap: '#d8a83a' },
    variants: { alt1: { paper: '#7f9de0' }, alt2: { paper: '#f3df7a' } },
    draw: (p) => `
      <path d="M50 4 L50 20" stroke="${p.line('cap')}" stroke-width="2"/>
      <path d="M50 80 L50 90 M46 84 L44 96 M54 84 L56 96 M50 84 L50 97" stroke="${p.flat('cap')}" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse cx="50" cy="50" rx="32" ry="27" fill="${p.ball('paper')}"${p.edge('paper')}/>
      <ellipse cx="50" cy="50" rx="21" ry="27" fill="none" stroke="${p.shade('paper')}" stroke-width="1.8"/>
      <ellipse cx="50" cy="50" rx="9" ry="27" fill="none" stroke="${p.shade('paper')}" stroke-width="1.8"/>
      <ellipse cx="50" cy="48" rx="16" ry="14" fill="${p.light('paper')}" opacity="0.35"/>
      <rect x="38" y="19" width="24" height="7" rx="2" fill="${p.fill('cap')}"${p.edge('cap', 1.8)}/>
      <rect x="38" y="74" width="24" height="7" rx="2" fill="${p.fill('cap')}"${p.edge('cap', 1.8)}/>
      ${p.spec(36, 38, 5, 3, -30)}`,
  },
  // Cotton candy: a pink fluffy cloud on a stick.
  'arum-manis': {
    palette: { candy: '#f2a8c4', stick: '#e8dcc0' },
    variants: { alt1: { candy: '#6f93dc' }, alt2: { candy: '#f6eaa0' } },
    draw: (p) => {
      const puffs = [
        [34, 42, 15],
        [52, 30, 17],
        [68, 42, 15],
        [50, 52, 17],
        [34, 58, 11],
        [66, 58, 11],
      ];
      return `
        <rect x="46.5" y="60" width="7" height="36" rx="3" fill="${p.fill('stick')}"${p.edge('stick', 1.8)}/>
        ${puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.line('candy')}" stroke="${p.line('candy')}" stroke-width="4.4"/>`).join('')}
        ${puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.ball('candy')}"/>`).join('')}
        <path d="M30 38 q4 -4 8 0 M50 24 q4 -4 8 0 M60 46 q4 -4 8 0 M42 52 q4 -4 8 0" fill="none" stroke="${p.light('candy')}" stroke-width="2" stroke-linecap="round"/>
        ${p.spec(42, 28, 5, 2.6, -30)}`;
    },
  },
  // A balloon on its string.
  balon: {
    palette: { rubber: '#e0382e', string: '#e8dcc0' },
    variants: { alt1: { rubber: '#9db8ec' }, alt2: { rubber: '#faf0c0' } },
    draw: (p) => `
      <path d="M50 79 Q42 85 50 90 T50 99" fill="none" stroke="${p.line('string')}" stroke-width="2"/>
      <path d="M50 8 C72 8 82 26 80 42 C78 58 62 70 52 72 L48 72 C38 70 22 58 20 42 C18 26 28 8 50 8 Z" fill="${p.ball('rubber')}"${p.edge('rubber')}/>
      <path d="M46 72 L54 72 L52 79 L48 79 Z" fill="${p.fill('rubber')}"${p.edge('rubber', 1.6)}/>
      ${p.spec(38, 26, 6, 9, -25)}`,
  },
  // A toy mask: a round smiling face with eye holes, rosy cheeks and its elastic.
  topeng: {
    palette: { mask: '#e8a030', cheek: '#e0483a', elastic: '#c9d2da' },
    variants: { alt1: { mask: '#4a6cb8' }, alt2: { mask: '#f8eebc' } },
    draw: (p) => `
      <path d="M18 46 L4 38 M82 46 L96 38" stroke="${p.flat('elastic')}" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="50" cy="52" rx="33" ry="37" fill="${p.fill('mask')}"${p.edge('mask')}/>
      <path d="M30 34 Q38 28 46 34 M54 34 Q62 28 70 34" fill="none" stroke="${p.line('mask')}" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="38" cy="44" rx="7.5" ry="5.5" fill="${p.line('mask')}"/>
      <ellipse cx="62" cy="44" rx="7.5" ry="5.5" fill="${p.line('mask')}"/>
      <circle cx="30" cy="60" r="6" fill="${p.flat('cheek')}" opacity="0.7"/><circle cx="70" cy="60" r="6" fill="${p.flat('cheek')}" opacity="0.7"/>
      <path d="M48 50 L50 58 L46 58" fill="none" stroke="${p.shade('mask')}" stroke-width="2"/>
      <path d="M36 68 Q50 80 64 68" fill="none" stroke="${p.line('mask')}" stroke-width="3" stroke-linecap="round"/>
      ${p.spec(34, 26, 6, 2.6, -25)}`,
  },
  // Fireworks: a burst of sparks with a bright core, and the rocket's trail below.
  'kembang-api': {
    palette: { spark: '#f0a830', core: '#fbf8ee', trail: '#e0482e' },
    variants: { alt1: { spark: '#4a6cb8' }, alt2: { spark: '#f8f0c4' } },
    draw: (p) => {
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 - 90;
        const [x0, y0] = polar(50, 42, 9, a);
        const [x1, y1] = polar(50, 42, i % 2 ? 26 : 34, a);
        return { d: `M${x0} ${y0} L${x1} ${y1}`, x1, y1 };
      });
      return `
        <path d="M50 96 L50 58" stroke="${p.flat('trail')}" stroke-width="2.4" stroke-dasharray="3 4" stroke-linecap="round"/>
        ${rays.map((r) => strand(p, 'spark', r.d, 2.8)).join('')}
        ${rays.map((r) => `<circle cx="${r.x1}" cy="${r.y1}" r="3" fill="${p.light('spark')}"${p.edge('spark', 1.4)}/>`).join('')}
        <circle cx="50" cy="42" r="7.5" fill="${p.ball('core')}"${p.edge('spark', 1.6)}/>`;
    },
  },
  // A miniature Ferris wheel on its stand, with little cabins.
  bianglala: {
    palette: { wheel: '#d83a7a', frame: '#c9d2da', cabin: '#f1c23a' },
    variants: { alt1: { wheel: '#9db8ec' }, alt2: { wheel: '#faf0c0' } },
    draw: (p) => {
      const spokes = Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(50, 44, 29, i * 45);
        return `M50 44 L${x} ${y}`;
      }).join(' ');
      const cabins = Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(50, 44, 31, i * 45 + 22.5);
        return `<rect x="${r1(x - 4.5)}" y="${r1(y - 2)}" width="9" height="8" rx="2" fill="${p.fill('cabin')}"${p.edge('cabin', 1.4)}/>`;
      }).join('');
      return `
        ${strand(p, 'frame', 'M50 46 L24 92 M50 46 L76 92 M16 92 L84 92', 3)}
        <path d="${spokes}" stroke="${p.flat('frame')}" stroke-width="1.6"/>
        <circle cx="50" cy="44" r="30" fill="none" stroke="${p.line('wheel')}" stroke-width="7.4"/>
        <circle cx="50" cy="44" r="30" fill="none" stroke="${p.flat('wheel')}" stroke-width="5"/>
        <circle cx="50" cy="44" r="21" fill="none" stroke="${p.flat('wheel')}" stroke-width="2"/>
        ${cabins}
        <circle cx="50" cy="44" r="4.5" fill="${p.ball('frame')}"${p.edge('frame', 1.4)}/>`;
    },
  },

  // ---------------------------------------------------------------- Laut Nusantara

  // A pinisi schooner: a curved wooden hull, two masts and full sails.
  pinisi: {
    palette: { hull: '#8a4a24', sail: '#f2ead6', mast: '#5a3418' },
    variants: { alt1: { sail: '#3f5fa8' }, alt2: { sail: '#d9a62a' } },
    draw: (p) => `
      <path d="M40 12 L40 66 M64 18 L64 64" stroke="${p.flat('mast')}" stroke-width="3"/>
      <path d="M41 14 Q30 36 20 60 L41 60 Z" fill="${p.fill('sail')}"${p.edge('sail', 2)}/>
      <path d="M43 18 Q52 38 58 60 L43 60 Z" fill="${p.fill('sail')}"${p.edge('sail', 2)}/>
      <path d="M65 20 Q76 38 84 58 L65 58 Z" fill="${p.fill('sail')}"${p.edge('sail', 2)}/>
      <path d="M66 22 L94 54" stroke="${p.line('mast')}" stroke-width="1.4"/>
      <path d="M6 62 Q50 70 94 58 L84 82 Q50 90 18 84 Z" fill="${p.fill('hull')}"${p.edge('hull')}/>
      <path d="M12 68 Q50 76 90 64" fill="none" stroke="${p.light('hull')}" stroke-width="2.2"/>
      ${p.spec(30, 74, 8, 1.6, 4)}`,
  },
  // A scallop shell: a ribbed fan with a scalloped edge and its hinge.
  kerang: {
    palette: { shell: '#f8d0c0' },
    variants: { alt1: { shell: '#3f5fa8' }, alt2: { shell: '#c8962a' } },
    draw: (p) => {
      const cx = 50;
      const cy = 82;
      const parts: string[] = [];
      const ribs: string[] = [];
      const bumps = 7;
      for (let i = 0; i <= bumps; i++) {
        const a = -170 + (i * 160) / bumps;
        const [x, y] = polar(cx, cy, 40, a);
        if (i === 0) parts.push(`M${cx} ${cy} L${x} ${y}`);
        else {
          const [qx, qy] = polar(cx, cy, 46, a - 80 / bumps);
          parts.push(`Q${qx} ${qy} ${x} ${y}`);
        }
        if (i > 0 && i < bumps + 1) ribs.push(`M${cx} ${cy} L${polar(cx, cy, 42, a - 80 / bumps).join(' ')}`);
      }
      return `
        <path d="M36 78 L64 78 L60 92 L40 92 Z" fill="${p.fill('shell')}"${p.edge('shell', 2)}/>
        <path d="${parts.join(' ')} Z" fill="${p.fill('shell')}"${p.edge('shell')}/>
        <path d="${ribs.join(' ')}" stroke="${p.shade('shell')}" stroke-width="2"/>
        ${p.spec(36, 50, 4, 7, -30)}`;
    },
  },
  // A starfish: five rounded arms with bumps.
  'bintang-laut': {
    palette: { star: '#e8823a' },
    variants: { alt1: { star: '#3f5fa8' }, alt2: { star: '#f6e6a0' } },
    draw: (p) => {
      const points = spikyEllipse(50, 54, 15, 15, 5, 1.55);
      const bumps = Array.from({ length: 5 }, (_, i) => {
        const a = -90 + i * 72;
        return [14, 24, 32].map((r) => {
          const [x, y] = polar(50, 54, r, a);
          return `<circle cx="${x}" cy="${y}" r="2" fill="${p.light('star')}"/>`;
        }).join('');
      }).join('');
      return `
        <polygon points="${points}" fill="${p.line('star')}" stroke="${p.line('star')}" stroke-width="9" stroke-linejoin="round"/>
        <polygon points="${points}" fill="${p.ball('star')}" stroke="${p.flat('star')}" stroke-width="5" stroke-linejoin="round"/>
        ${bumps}
        <circle cx="50" cy="54" r="4" fill="${p.light('star')}"/>
        ${p.spec(38, 44, 4, 2.2, -30)}`;
    },
  },
  // A fishing net hanging from its rope, with floats along the top.
  jaring: {
    palette: { net: '#d8c08a', float: '#e0482e' },
    variants: { alt1: { float: '#9db8ec' }, alt2: { float: '#faf0c0' } },
    draw: (p) => {
      const outline = 'M14 28 Q50 38 86 28 L74 88 Q50 94 26 88 Z';
      const mesh: string[] = [];
      for (let x = -40; x <= 100; x += 9) {
        mesh.push(`M${x} 26 L${x + 60} 96`);
        mesh.push(`M${x + 60} 26 L${x} 96`);
      }
      return `
        <defs><clipPath id="net-shape"><path d="${outline}"/></clipPath></defs>
        <path d="${outline}" fill="${p.flat('net')}" opacity="0.3"/>
        <g clip-path="url(#net-shape)"><path d="${mesh.join(' ')}" stroke="${p.flat('net')}" stroke-width="1.8"/></g>
        <path d="${outline}" fill="none"${p.edge('net', 2)}/>
        ${strand(p, 'net', 'M8 26 Q50 38 92 26', 2.6)}
        ${[
          [22, 30],
          [50, 34],
          [78, 30],
        ]
          .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="5.5" fill="${p.ball('float')}"${p.edge('float', 2)}/>`)
          .join('')}`;
    },
  },
  // A diamond kite with its cross spars and a tail of bows below.
  layangan: {
    palette: { kite: '#e0382e', spar: '#8a5a32', tail: '#f1c23a' },
    variants: { alt1: { kite: '#9db8ec' }, alt2: { kite: '#f6e6a0' } },
    draw: (p) => `
      <path d="M50 78 Q40 86 46 92 T36 98" fill="none" stroke="${p.line('tail')}" stroke-width="2"/>
      <path d="M40 84 L46 88 L40 92 Z M48 90 L42 94 L48 98 Z" fill="${p.flat('tail')}"${p.edge('tail', 1.2)}/>
      <polygon points="50,6 80,38 50,78" fill="${p.fill('kite')}"/>
      <polygon points="50,6 20,38 50,78" fill="${p.light('kite')}"/>
      <polygon points="50,6 80,38 50,78 20,38" fill="none"${p.edge('kite')}/>
      <path d="M50 6 L50 78 M20 38 L80 38" stroke="${p.flat('spar')}" stroke-width="2.4"/>
      ${p.spec(38, 26, 6, 2, -45)}`,
  },
  // A ripe brown coconut, hairy, and a half showing its white flesh.
  kelapa: {
    palette: { husk: '#7a4a24', flesh: '#fbf8ee', shell: '#5a3418', water: '#e3eee8' },
    variants: { alt1: { husk: '#6f93dc' }, alt2: { husk: '#e8c86a' } },
    draw: (p) => `
      <circle cx="40" cy="52" r="29" fill="${p.ball('husk')}"${p.edge('husk')}/>
      <path d="M22 44 l6 3 M30 62 l6 2 M44 68 l6 -1 M54 50 l6 3 M36 36 l5 4 M26 56 l5 -2" stroke="${p.shade('husk')}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="32" r="2.2" fill="${p.line('husk')}"/><circle cx="43" cy="31" r="2.2" fill="${p.line('husk')}"/><circle cx="40" cy="37" r="2.2" fill="${p.line('husk')}"/>
      <path d="M52 66 A22 9 0 0 0 96 66 Q94 92 74 92 Q54 92 52 66 Z" fill="${p.fill('shell')}"${p.edge('shell')}/>
      <ellipse cx="74" cy="66" rx="22" ry="9" fill="${p.flat('flesh')}"${p.edge('shell', 2)}/>
      <ellipse cx="74" cy="67" rx="15" ry="5" fill="${p.flat('water')}"/>
      ${p.spec(30, 40, 6, 3, -30)}`,
  },
};
