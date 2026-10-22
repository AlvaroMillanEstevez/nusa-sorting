import { r1, type IconTemplate } from './template';

/**
 * Buku Nenek on the map: Grandma's book, drawn like the boosters' icons (three-tone materials, fine outlines in a
 * dark tone of each, highlights). A closed book with covers of brown batik in the kawung pattern (four ovals round
 * a point), brass corners, a cream label, the page block showing at its edge and a red ribbon bookmark hanging
 * below it.
 */

/** One kawung motif: four ovals round (cx, cy), set diagonally. */
const kawung = (cx: number, cy: number, fill: string, line: string) =>
  [45, 135, 225, 315]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      const x = r1(cx + Math.cos(rad) * 4.2);
      const y = r1(cy + Math.sin(rad) * 4.2);
      return `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.3" transform="rotate(${a} ${x} ${y})" fill="${fill}" stroke="${line}" stroke-width="0.8"/>`;
    })
    .join('');

export const BOOK_TEMPLATE: IconTemplate = {
  palette: { cover: '#8c4a24', motif: '#e3b453', pages: '#f3e6c4', ribbon: '#c8402e', brass: '#d9a640' },
  draw: (p) => {
    const motifs = [
      [36, 26],
      [56, 26],
      [36, 70],
      [56, 70],
      [26, 48],
      [66, 48],
    ]
      .map(([x, y]) => kawung(x!, y!, p.flat('motif'), p.line('cover')))
      .join('');
    return `
      <rect x="22" y="16" width="62" height="74" rx="4" fill="${p.fill('pages')}"${p.edge('pages', 2)}/>
      <path d="M80 22 V86 M76.5 22 V87 M30 87.5 H80" stroke="${p.line('pages')}" stroke-width="1.2" opacity="0.6"/>
      <rect x="14" y="10" width="64" height="76" rx="5" fill="${p.fill('cover')}"${p.edge('cover')}/>
      ${motifs}
      <rect x="14" y="10" width="9" height="76" rx="4" fill="${p.shade('cover')}"/>
      <path d="M23 12 V84" stroke="${p.line('cover')}" stroke-width="1.6"/>
      <rect x="31" y="39" width="38" height="18" rx="3.5" fill="${p.fill('pages')}"${p.edge('pages', 1.8)}/>
      <path d="M37 45.5 H63 M40 50.5 H60" stroke="${p.line('pages')}" stroke-width="2" stroke-linecap="round"/>
      <path d="M64 10 H78 V24 Z" fill="${p.fill('brass')}"${p.edge('brass', 1.6)}/>
      <path d="M64 86 H78 V72 Z" fill="${p.fill('brass')}"${p.edge('brass', 1.6)}/>
      <path d="M54 8 H62 V97 L58 92 L54 97 Z" fill="${p.fill('ribbon')}"${p.edge('ribbon', 1.6)}/>
      ${p.spec(32, 18, 6, 2.4, -8)}`;
  },
};
