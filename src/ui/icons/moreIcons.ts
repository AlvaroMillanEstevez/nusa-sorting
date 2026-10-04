import { r1, wavyDisc, type IconTemplate, type Paint } from './template';

/** A wavy strand (noodles, jelly): a path drawn twice, its outline and then its colour. */
function strand(p: Paint, material: string, d: string, width: number): string {
  return (
    `<path d="${d}" fill="none" stroke="${p.line(material)}" stroke-width="${width + 2.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${p.flat(material)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** A box seen from above-left: top face, front face and right side, each in its own tone. */
function block(p: Paint, material: string, x: number, y: number, w: number, h: number, depth: number): string {
  const dx = depth;
  const dy = depth * 0.75;
  const edge = p.edge(material, 2);
  return (
    `<polygon points="${x},${y} ${x + w},${y} ${x + w + dx},${y - dy} ${x + dx},${y - dy}" fill="${p.light(material)}"${edge}/>` +
    `<polygon points="${x + w},${y} ${x + w + dx},${y - dy} ${x + w + dx},${y + h - dy} ${x + w},${y + h}" fill="${p.shade(material)}"${edge}/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.fill(material)}"${edge}/>`
  );
}

/** Icons of the kinds after the starter set. */
export const MORE_TEMPLATES: Readonly<Record<string, IconTemplate>> = {
  // A mound of fried noodles on a plate, with chopsticks stuck in it.
  'mie-goreng': {
    palette: { plate: '#eceeee', noodle: '#d6a443', stick: '#9a6a3a', greens: '#4e9a3a', chili: '#d8322a' },
    variants: { alt1: { noodle: '#4f6fbf' }, alt2: { noodle: '#f6e7a6' } },
    draw: (p) => {
      const wave = (x0: number, x1: number, y: number) => {
        let d = `M${x0} ${y}`;
        for (let x = x0; x + 8 <= x1; x += 8) d += ` q4 ${x % 16 === x0 % 16 ? -5 : 5} 8 0`;
        return d;
      };
      return `
        <ellipse cx="50" cy="76" rx="44" ry="13" fill="${p.fill('plate')}"${p.edge('plate')}/>
        <ellipse cx="50" cy="76" rx="34" ry="9" fill="none" stroke="${p.shade('plate')}" stroke-width="1.5"/>
        <path d="M14 76 C16 56 32 44 50 44 C68 44 84 56 86 76 Q50 85 14 76 Z" fill="${p.fill('noodle')}"${p.edge('noodle')}/>
        ${strand(p, 'noodle', wave(30, 70, 54), 2.6)}${strand(p, 'noodle', wave(22, 78, 63), 2.6)}${strand(p, 'noodle', wave(18, 82, 72), 2.6)}
        <circle cx="36" cy="58" r="2.6" fill="${p.flat('greens')}"/><circle cx="62" cy="68" r="2.6" fill="${p.flat('greens')}"/>
        <circle cx="68" cy="56" r="2.2" fill="${p.flat('chili')}"/>
        ${strand(p, 'stick', 'M58 50 L86 10', 3.6)}${strand(p, 'stick', 'M64 52 L92 16', 3.6)}
        ${p.spec(30, 54, 4, 2, -20)}`;
    },
  },
  // Dark chunks of slow-cooked beef in thick sauce, on a banana leaf.
  rendang: {
    palette: { leaf: '#4f9a3a', meat: '#6b3a1e', sauce: '#8a4a22', chili: '#d8322a' },
    variants: { alt1: { leaf: '#9db8ec' }, alt2: { leaf: '#f3e7a0' } },
    draw: (p) => `
      <path d="M6 70 Q28 42 70 44 Q92 46 96 62 Q74 86 34 84 Q12 82 6 70 Z" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
      <path d="M10 70 Q50 58 94 60" fill="none" stroke="${p.light('leaf')}" stroke-width="2"/>
      <path d="M30 64 L24 54 M46 62 L42 50 M62 61 L60 48 M30 68 L26 80 M48 66 L46 80 M66 64 L66 78" stroke="${p.shade('leaf')}" stroke-width="1.6"/>
      <ellipse cx="52" cy="64" rx="30" ry="10" fill="${p.flat('sauce')}" opacity="0.92"/>
      ${[
        [36, 60, 11],
        [62, 58, 12],
        [49, 47, 10],
        [72, 68, 8.5],
        [28, 70, 8],
      ]
        .map(
          ([x, y, r]) =>
            `<path d="${wavyDisc(x!, y!, r!, r! * 0.82, 7, 0.12)}" fill="${p.fill('meat')}"${p.edge('meat', 2)}/>` +
            `<circle cx="${x! - r! * 0.3}" cy="${y! + r! * 0.2}" r="1.3" fill="${p.light('meat')}"/>` +
            `<circle cx="${x! + r! * 0.3}" cy="${y! - r! * 0.1}" r="1.1" fill="${p.light('meat')}"/>` +
            p.spec(x! - r! * 0.3, y! - r! * 0.4, 2.4, 1.4, -20),
        )
        .join('')}
      <path d="M78 52 q4 -4 8 -2" fill="none" stroke="${p.flat('chili')}" stroke-width="3" stroke-linecap="round"/>`,
  },
  // A salad on a woven plate: greens, halved eggs, tofu and peanut sauce.
  'gado-gado': {
    palette: { plate: '#c9a46a', greens: '#6fb546', egg: '#fbf9f0', yolk: '#f4b41c', sauce: '#a8642a', tofu: '#e0b060' },
    variants: { alt1: { greens: '#4a6cbf' }, alt2: { greens: '#f2e08a' } },
    draw: (p) => `
      <ellipse cx="50" cy="72" rx="45" ry="17" fill="${p.fill('plate')}"${p.edge('plate')}/>
      <ellipse cx="50" cy="72" rx="38" ry="13" fill="none" stroke="${p.shade('plate')}" stroke-width="3" stroke-dasharray="3 3"/>
      <path d="${wavyDisc(50, 60, 32, 19, 9, 0.14)}" fill="${p.fill('greens')}"${p.edge('greens')}/>
      <path d="M28 58 Q34 52 40 58 M56 52 Q62 46 68 52 M44 70 Q50 64 56 70" fill="none" stroke="${p.shade('greens')}" stroke-width="2"/>
      <rect x="52" y="58" width="11" height="10" rx="1.5" transform="rotate(-12 57 63)" fill="${p.fill('tofu')}"${p.edge('tofu', 1.8)}/>
      ${[
        [34, 52],
        [62, 46],
      ]
        .map(
          ([x, y]) =>
            `<ellipse cx="${x}" cy="${y}" rx="9.5" ry="7" fill="${p.fill('egg')}"${p.edge('egg', 1.8)}/>` +
            `<circle cx="${x}" cy="${y}" r="4.2" fill="${p.ball('yolk')}"${p.edge('yolk', 1.2)}/>`,
        )
        .join('')}
      ${strand(p, 'sauce', 'M22 64 Q34 58 46 64 T72 62', 3.4)}
      ${p.spec(30, 49, 2.6, 1.6, -20)}`,
  },
  // A crispy fried chicken drumstick with its bone sticking out.
  'ayam-goreng': {
    palette: { crust: '#c9762a', bone: '#f3ead6' },
    variants: { alt1: { crust: '#3f5fa8' }, alt2: { crust: '#f1d36a' } },
    draw: (p) => {
      const crumbs = [
        [16, 62, 5],
        [20, 74, 5],
        [31, 81, 5],
        [45, 81, 5],
        [57, 74, 4.5],
        [66, 63, 4],
        [70, 50, 3.5],
        [22, 47, 4.5],
        [33, 38, 4.5],
        [47, 35, 4],
        [60, 37, 3.5],
      ];
      return `
        ${strand(p, 'bone', 'M60 42 L82 18', 8)}
        <circle cx="82" cy="12" r="6.5" fill="${p.fill('bone')}"${p.edge('bone', 2)}/>
        <circle cx="89" cy="19" r="6.5" fill="${p.fill('bone')}"${p.edge('bone', 2)}/>
        ${crumbs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.flat('crust')}"${p.edge('crust', 2)}/>`).join('')}
        <path d="M70 36 C80 46 72 62 58 72 C44 82 20 80 16 64 C12 48 28 36 46 35 C56 34 62 30 70 36 Z" fill="${p.fill('crust')}"/>
        ${crumbs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r! - 2}" fill="${p.flat('crust')}"/>`).join('')}
        ${[
          [30, 52],
          [44, 46],
          [38, 64],
          [52, 60],
          [26, 68],
          [58, 48],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${p.light('crust')}"/><circle cx="${x! + 2}" cy="${y! + 2.5}" r="1.4" fill="${p.shade('crust')}"/>`)
          .join('')}
        ${p.spec(34, 44, 6, 3, -30)}`;
    },
  },
  // A grilled fish with grill marks and a wedge of lime.
  'ikan-bakar': {
    palette: { skin: '#a8743a', lime: '#9ccc4a', eye: '#fbf9f0' },
    variants: { alt1: { skin: '#8fb0e8' }, alt2: { skin: '#efe2a8' } },
    draw: (p) => `
      <path d="M44 36 L52 24 L62 38 Z" fill="${p.fill('skin')}"${p.edge('skin', 2)}/>
      <path d="M10 54 C20 34 50 30 68 42 L88 28 L84 54 L90 76 L68 64 C50 76 20 72 10 54 Z" fill="${p.fill('skin')}"${p.edge('skin')}/>
      <ellipse cx="40" cy="60" rx="22" ry="6" fill="${p.light('skin')}" opacity="0.55"/>
      <path d="M30 41 L24 64 M42 37 L35 68 M54 38 L47 68 M65 44 L59 65" stroke="${p.line('skin')}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
      <path d="M26 42 Q21 54 26 64" fill="none" stroke="${p.shade('skin')}" stroke-width="2"/>
      <circle cx="18" cy="49" r="3.8" fill="${p.flat('eye')}"${p.edge('skin', 1.4)}/><circle cx="18" cy="49" r="1.8" fill="${p.line('skin')}"/>
      <path d="M14 86 A11 11 0 0 1 36 86 Z" fill="${p.fill('lime')}"${p.edge('lime', 2)}/>
      <path d="M25 86 L18 79 M25 86 L25 76 M25 86 L32 79" stroke="${p.light('lime')}" stroke-width="1.4"/>
      ${p.spec(40, 42, 6, 2.4, -10)}`,
  },
  // Two slices of thick sweet pancake: honeycomb crumb and a chocolate filling.
  'martabak-manis': {
    palette: { cake: '#e2b04c', filling: '#5a3420', topping: '#f4e9c8' },
    variants: { alt1: { cake: '#5577c4' }, alt2: { cake: '#f7efc0' } },
    draw: (p) => {
      const holes = (x0: number, y0: number, w: number, rows: number[]) =>
        rows
          .flatMap((y, row) =>
            Array.from({ length: Math.floor(w / 9) }, (_, i) => `<ellipse cx="${x0 + 5 + i * 9 + (row % 2) * 4}" cy="${y0 + y}" rx="1.8" ry="1.3" fill="${p.shade('cake')}"/>`),
          )
          .join('');
      const slice = (x: number, y: number, w: number, h: number, depth: number) =>
        block(p, 'cake', x, y, w, h, depth) +
        `<rect x="${x}" y="${y + h * 0.42}" width="${w}" height="${h * 0.22}" fill="${p.flat('filling')}"/>` +
        `<polygon points="${x + w},${y + h * 0.42} ${x + w + depth},${y + h * 0.42 - depth * 0.75} ${x + w + depth},${y + h * 0.64 - depth * 0.75} ${x + w},${y + h * 0.64}" fill="${p.line('filling')}"/>` +
        holes(x, y, w, [h * 0.2, h * 0.84]);
      const sprinkles = [
        [40, 30, 20],
        [50, 28, -30],
        [58, 31, 60],
        [46, 33, -60],
        [64, 28, 10],
      ];
      return `
        ${slice(14, 58, 56, 24, 14)}
        ${slice(26, 36, 40, 18, 11)}
        ${sprinkles.map(([x, y, a]) => `<rect x="${x! - 2.5}" y="${y! - 0.8}" width="5" height="1.6" rx="0.8" transform="rotate(${a} ${x} ${y})" fill="${p.flat('filling')}"/>`).join('')}
        <ellipse cx="56" cy="30" rx="3" ry="1.4" fill="${p.flat('topping')}"/>
        ${p.spec(30, 60, 4, 1.6)}`;
    },
  },
  // A block of tempeh: pale, with whole soybeans pressed together, on a piece of banana leaf.
  tempe: {
    palette: { tempe: '#e8dcb0', leaf: '#4f9a3a' },
    variants: { alt1: { tempe: '#5e7fc4' }, alt2: { tempe: '#c9a43a' } },
    draw: (p) => {
      const beans: string[] = [];
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 5; i++) {
          const x = 20 + i * 10 + (row % 2) * 4;
          const y = 58 + row * 7;
          if (x > 64) continue;
          beans.push(`<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.4" fill="${p.shade('tempe')}"/><ellipse cx="${x - 0.8}" cy="${y - 0.7}" rx="1.6" ry="0.9" fill="${p.light('tempe')}"/>`);
        }
      for (let i = 0; i < 5; i++) beans.push(`<ellipse cx="${r1(30 + i * 9.5)}" cy="${r1(46 - (i % 2) * 3)}" rx="3.4" ry="1.8" fill="${p.shade('tempe')}"/>`);
      return `
        <path d="M6 80 Q40 66 94 70 Q80 90 44 90 Q14 90 6 80 Z" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
        <path d="M10 82 Q50 74 90 74" fill="none" stroke="${p.light('leaf')}" stroke-width="1.8"/>
        ${block(p, 'tempe', 14, 52, 52, 26, 22)}
        ${beans.join('')}
        ${p.spec(30, 44, 6, 1.8)}`;
    },
  },
  // Fried tofu: golden puffy cubes, one cut open to show the white inside.
  'tahu-goreng': {
    palette: { crust: '#c98a35', inside: '#f6f1e2' },
    variants: { alt1: { crust: '#4a63ad' }, alt2: { crust: '#f4dd7c' } },
    draw: (p) => `
      ${block(p, 'crust', 46, 36, 32, 28, 12)}
      <circle cx="56" cy="46" r="2.4" fill="${p.light('crust')}"/><circle cx="68" cy="54" r="2" fill="${p.light('crust')}"/><circle cx="60" cy="58" r="1.6" fill="${p.shade('crust')}"/>
      <polygon points="12,56 46,56 58,47 24,47" fill="${p.light('crust')}"${p.edge('crust', 2)}/>
      <polygon points="46,56 58,47 58,79 46,88" fill="${p.shade('crust')}"${p.edge('crust', 2)}/>
      <rect x="12" y="56" width="34" height="32" fill="${p.flat('crust')}"${p.edge('crust', 2)}/>
      <rect x="15.5" y="59.5" width="27" height="25" rx="2" fill="${p.fill('inside')}"/>
      <circle cx="22" cy="66" r="1.4" fill="${p.shade('inside')}"/><circle cx="34" cy="72" r="1.6" fill="${p.shade('inside')}"/><circle cx="26" cy="78" r="1.2" fill="${p.shade('inside')}"/>
      ${p.spec(60, 40, 4, 1.4)}`,
  },
  // Banana fritters: crispy, curved, one showing the yellow banana at its end.
  'pisang-goreng': {
    palette: { batter: '#e0a64a', banana: '#f5d75a' },
    variants: { alt1: { batter: '#5574c0' }, alt2: { batter: '#f7ecb0' } },
    draw: (p) => {
      const crisp = (points: number[][]) =>
        points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${p.light('batter')}"/><circle cx="${x! + 1.6}" cy="${y! + 2}" r="1.2" fill="${p.shade('batter')}"/>`).join('');
      return `
        <path d="M38 84 C50 70 70 62 90 60 C95 64 93 70 88 72 C72 74 58 82 48 90 C42 92 36 90 38 84 Z" fill="${p.fill('batter')}"${p.edge('batter')}/>
        ${crisp([
          [50, 80],
          [62, 72],
          [76, 68],
        ])}
        <path d="M12 66 C18 44 48 32 80 28 C90 28 92 38 84 42 C62 48 40 60 30 76 C24 84 10 78 12 66 Z" fill="${p.fill('batter')}"${p.edge('batter')}/>
        ${crisp([
          [22, 62],
          [32, 50],
          [46, 42],
          [60, 37],
          [30, 66],
          [44, 54],
        ])}
        <ellipse cx="84" cy="35" rx="5.5" ry="6.5" transform="rotate(-25 84 35)" fill="${p.ball('banana')}"${p.edge('batter', 2)}/>
        ${p.spec(36, 46, 6, 2.4, -30)}`;
    },
  },
  // Three green rice balls rolled in grated coconut, on a banana leaf.
  klepon: {
    palette: { dough: '#4fa64a', coconut: '#fbf8ee', leaf: '#3f8a34' },
    variants: { alt1: { dough: '#3b58a8' }, alt2: { dough: '#efdd73' } },
    draw: (p) => {
      const flakes = (cx: number, cy: number) =>
        [
          [-8, -6, 30],
          [2, -10, -20],
          [8, -2, 60],
          [-4, 4, 10],
          [5, 8, -40],
          [-10, 4, 80],
          [0, 0, -70],
        ]
          .map(([dx, dy, a]) => {
            const x = cx + dx!;
            const y = cy + dy!;
            return `<rect x="${x - 2}" y="${y - 0.8}" width="4" height="1.6" rx="0.8" transform="rotate(${a} ${x} ${y})" fill="${p.flat('coconut')}"/>`;
          })
          .join('');
      const ball = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="17" fill="${p.ball('dough')}"${p.edge('dough')}/>${flakes(x, y)}${p.spec(x - 6, y - 7, 3.4, 2.2, -30)}`;
      return `
        <ellipse cx="50" cy="80" rx="42" ry="9" fill="${p.fill('leaf')}"${p.edge('leaf')}/>
        ${ball(50, 46)}${ball(31, 64)}${ball(69, 64)}`;
    },
  },
  // Green pandan crepes rolled around brown coconut filling, the spiral showing at their ends.
  'dadar-gulung': {
    palette: { crepe: '#7cc25a', filling: '#9a5a2a' },
    variants: { alt1: { crepe: '#4a66b8' }, alt2: { crepe: '#f6eda8' } },
    draw: (p) => {
      const roll = (cx: number, cy: number) => `<g transform="translate(${cx} ${cy}) rotate(-14)">
        <rect x="-30" y="-12" width="58" height="24" rx="12" fill="${p.fill('crepe')}"${p.edge('crepe')}/>
        <path d="M-22 -5 Q-2 -1 18 -5 M-20 5 Q0 9 16 5" fill="none" stroke="${p.shade('crepe')}" stroke-width="1.8"/>
        <ellipse cx="26" cy="0" rx="7" ry="12" fill="${p.light('crepe')}"${p.edge('crepe', 2)}/>
        <ellipse cx="26" cy="0" rx="4.6" ry="8.4" fill="${p.flat('filling')}"/>
        <path d="M26 0 m-1.5 0 a1.5 2.4 0 1 1 1.5 2.4 a3 4.8 0 1 1 -3 -4.8" fill="none" stroke="${p.light('crepe')}" stroke-width="1.6"/>
        ${p.spec(-12, -6, 7, 2)}
      </g>`;
      return `${roll(46, 40)}${roll(50, 68)}`;
    },
  },
  // Iced cendol in a wide glass: green jelly worms, coconut milk, palm sugar, and a spoon.
  'es-cendol': {
    palette: { glass: '#dceef6', jelly: '#5fb84a', milk: '#f6f1e2', sugar: '#7a3e1a', spoon: '#c9d2da' },
    variants: { alt1: { jelly: '#4b67b8' }, alt2: { jelly: '#f0dc72' } },
    draw: (p) => `
      ${strand(p, 'spoon', 'M28 8 L40 48', 3.6)}
      <path d="M16 32 L84 32 L76 88 L24 88 Z" fill="${p.flat('glass')}" opacity="0.55"/>
      <path d="M18.6 40 L81.4 40 L76.6 86 L23.4 86 Z" fill="${p.fill('milk')}"/>
      <path d="M22.4 74 L77.6 74 L76.6 86 L23.4 86 Z" fill="${p.fill('sugar')}"/>
      ${[
        'M26 48 q4 -4 8 0 t8 0',
        'M48 46 q4 -4 8 0 t8 0',
        'M64 52 q4 -4 8 0',
        'M24 58 q4 -4 8 0 t8 0',
        'M44 58 q4 -4 8 0 t8 0 t8 0',
        'M30 68 q4 -4 8 0 t8 0',
        'M52 68 q4 -4 8 0 t8 0',
      ]
        .map((d) => strand(p, 'jelly', d, 3.4))
        .join('')}
      <path d="M16 32 L84 32 L76 88 L24 88 Z" fill="none"${p.edge('glass')}/>
      <ellipse cx="50" cy="32" rx="34" ry="4" fill="${p.light('glass')}" opacity="0.8"${p.edge('glass', 1.8)}/>
      <path d="M22 40 L26 80" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" opacity="0.7"/>`,
  },
  // A young green coconut with its top cut open, white flesh at the rim, and a straw.
  'es-kelapa-muda': {
    palette: { husk: '#7fb24a', flesh: '#fbf8ee', water: '#e3eee8', straw: '#e0483a' },
    variants: { alt1: { husk: '#4d6db8' }, alt2: { husk: '#efe08a' } },
    draw: (p) => `
      <path d="M20 38 C12 62 30 90 50 90 C70 90 88 62 80 38 Z" fill="${p.ball('husk')}"${p.edge('husk')}/>
      <path d="M32 46 Q26 66 40 86 M50 48 Q48 70 52 88 M68 46 Q74 66 62 86" fill="none" stroke="${p.shade('husk')}" stroke-width="1.8"/>
      <ellipse cx="50" cy="38" rx="30" ry="9" fill="${p.flat('flesh')}"${p.edge('husk', 2.2)}/>
      <ellipse cx="50" cy="39" rx="21" ry="5.5" fill="${p.flat('water')}"/>
      <rect x="53" y="4" width="6" height="36" rx="3" transform="rotate(14 56 22)" fill="${p.fill('straw')}"${p.edge('straw', 1.8)}/>
      ${p.spec(30, 54, 4, 9, 10)}`,
  },
  // Turmeric jamu in a corked bottle, with a small glass poured.
  jamu: {
    palette: { glass: '#dceef6', jamu: '#e0a020', cork: '#b07a45' },
    variants: { alt1: { jamu: '#4f6ec0' }, alt2: { jamu: '#f5eaa0' } },
    draw: (p) => `
      <rect x="35" y="8" width="16" height="13" rx="2.5" fill="${p.fill('cork')}"${p.edge('cork', 2)}/>
      <path d="M37 20 L37 32 C24 36 22 44 22 52 L22 84 Q22 90 28 90 L58 90 Q64 90 64 84 L64 52 C64 44 62 36 49 32 L49 20 Z" fill="${p.flat('glass')}" opacity="0.55"/>
      <path d="M24.4 50 L61.6 50 L61.6 84 Q61.6 87.6 58 87.6 L28 87.6 Q24.4 87.6 24.4 84 Z" fill="${p.fill('jamu')}"/>
      <path d="M37 20 L37 32 C24 36 22 44 22 52 L22 84 Q22 90 28 90 L58 90 Q64 90 64 84 L64 52 C64 44 62 36 49 32 L49 20 Z" fill="none"${p.edge('glass')}/>
      <path d="M68 62 L90 62 L87 90 L71 90 Z" fill="${p.flat('glass')}" opacity="0.55"/>
      <path d="M69 70 L89 70 L87 88 L71 88 Z" fill="${p.fill('jamu')}"/>
      <path d="M68 62 L90 62 L87 90 L71 90 Z" fill="none"${p.edge('glass', 2)}/>
      <path d="M28 54 L28 82" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" opacity="0.7"/>`,
  },
  // Snake fruit: a pointed brown fruit covered in scales, and one cream segment.
  salak: {
    palette: { skin: '#8a4f2c', flesh: '#f4ecd0' },
    variants: { alt1: { skin: '#7f9de0' }, alt2: { skin: '#efdb7a' } },
    draw: (p) => {
      const half = (y: number) => (y < 60 ? ((y - 12) / 48) * 28 : 28 * Math.sqrt(Math.max(0, 1 - ((y - 60) / 30) ** 2)));
      const scales: string[] = [];
      for (let y = 26, row = 0; y <= 84; y += 8, row++) {
        const w = half(y) - 5;
        for (let x = 52 - w + (row % 2) * 3.5; x <= 52 + w; x += 7) {
          scales.push(
            `<polygon points="${r1(x - 3.4)},${y + 3} ${r1(x)},${y - 3} ${r1(x + 3.4)},${y + 3}" fill="${p.light('skin')}" opacity="0.85"/>` +
              `<circle cx="${r1(x)}" cy="${y - 2}" r="0.9" fill="${p.line('skin')}"/>`,
          );
        }
      }
      return `
        <path d="M52 10 C64 22 82 42 82 62 C82 80 68 90 52 90 C36 90 22 80 22 62 C22 42 40 22 52 10 Z" fill="${p.fill('skin')}"${p.edge('skin')}/>
        ${scales.join('')}
        <path d="M52 10 L50 4" stroke="${p.line('skin')}" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="18" cy="76" rx="9" ry="12" transform="rotate(-20 18 76)" fill="${p.fill('flesh')}"${p.edge('flesh')}/>
        ${p.spec(16, 72, 2.4, 4.4, -20)}${p.spec(40, 36, 4, 7, 20)}`;
    },
  },
  // Two long red chillies with green caps, crossed.
  cabai: {
    palette: { chili: '#d8322a', stem: '#4f9a3a' },
    variants: { alt1: { chili: '#7f9de0' }, alt2: { chili: '#f2d54a' } },
    draw: (p) => {
      const chili = `
        <path d="M24 22 C34 20 40 30 46 44 C54 62 66 76 86 84 C70 88 50 80 38 64 C28 50 22 36 24 22 Z" fill="${p.fill('chili')}"${p.edge('chili')}/>
        <path d="M30 28 C36 40 42 56 56 68" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
        <path d="M16 22 Q24 12 34 20 Q28 30 16 22 Z" fill="${p.fill('stem')}"${p.edge('stem', 2)}/>
        <path d="M24 17 Q22 9 29 5" fill="none" stroke="${p.line('stem')}" stroke-width="4" stroke-linecap="round"/>
        <path d="M24 17 Q22 9 29 5" fill="none" stroke="${p.flat('stem')}" stroke-width="2.2" stroke-linecap="round"/>`;
      return `<g transform="translate(98 6) scale(-0.92 0.92)">${chili}</g>${chili}`;
    },
  },
};
