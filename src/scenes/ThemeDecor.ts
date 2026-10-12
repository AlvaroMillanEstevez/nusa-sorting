import type * as Phaser from 'phaser';
import type { BoardLayout, Rect } from '../ui/boardLayout';
import type { ThemeLook } from '../ui/themeLook';
import { BakedLayer } from './art/BakedLayer';
import { SKIN } from '../ui/design/tokens';
import { drawStall } from './StallDecor';

/** Under everything: the board, the tracks and the HUD are drawn over it. */
const DEPTH_DECOR = -100;

const hex = (color: string) => Number.parseInt(color.slice(1), 16);

/**
 * The background of a themed level, drawn by code from its ThemeLook and cached in a texture. Only the
 * background changes: the board keeps its size and the shelves their back wall.
 */
export class ThemeDecor {
  private readonly layer: BakedLayer;

  constructor(scene: Phaser.Scene) {
    this.layer = new BakedLayer(scene, DEPTH_DECOR);
  }

  /**
   * Draws the background over the whole screen (`screen`, in world coordinates: it starts above and left of the
   * safe area). Without a theme it is the warm warung backdrop of the interface.
   */
  draw(look: ThemeLook | null, screen: Rect, layout: BoardLayout, boosters = false): void {
    const { width, height } = screen;
    // Drawn in screen coordinates: the layer sits at the screen's corner, and the board is moved to match.
    this.layer.setPosition(screen.x, screen.y);
    const local = (r: Rect): Rect => ({ ...r, x: r.x - screen.x, y: r.y - screen.y });
    this.layer.draw({ x: 0, y: 0, width, height }, (g) => {
      const [top, bottom] = (look ? look.sky : SKIN.backdrop).map(hex) as [number, number];
      g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, width, height);
      const hudBottom = layout.hud.height - screen.y;
      const bounds = boardBounds(layout);
      const board = bounds && local(bounds);
      if (look) this.motif(g, look, width, height, hudBottom, board);
      // Wide screens: the warung around the board, over the theme's motif.
      const side = layout.side;
      if (side) drawStall(g, width, height, { awning: hudBottom, board, hud: local(side.hud), boosters: boosters ? local(side.boosters) : null });
    });
  }

  /** A themed level's motif over its sky (`board` in screen coordinates). */
  private motif(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number, hudBottom: number, board: Rect | null): void {
    // Strings hang across the screen but stop at the board, so none shows through the gaps between shelves.
    const clear = outsideBoard(board);
    switch (look.motif) {
      case 'batik':
        return batik(g, look, width, height);
      case 'bunting':
        return bunting(g, look, width, height, hudBottom, clear);
      case 'bulbs':
        return bulbs(g, look, width, height, hudBottom, clear);
      case 'waves':
        return waves(g, look, width, height);
      case 'court':
        return court(g, look, width, height);
      case 'chalk':
        return chalk(g, look, width, height);
      case 'spices':
        return spices(g, look, width, height);
      case 'terraces':
        return terraces(g, look, width, height);
      case 'leaves':
        return leaves(g, look, width, height);
      case 'festival':
        return festival(g, look, width, height, hudBottom, clear);
    }
  }
}

/** The area the shelves, tracks and belt cover, or null with nothing on screen. */
function boardBounds(layout: BoardLayout): Rect | null {
  const rects = [...layout.shelves.map((s) => s.rect), ...layout.tracks.map((t) => t.rect), ...(layout.belt ? [layout.belt.rect] : [])];
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}

/** Whether a point of a hanging string (with what hangs from it, down to `drop` px) stays off the board. */
type Clear = (x: number, y: number, drop: number) => boolean;

const PAD = 6;

function outsideBoard(board: Rect | null): Clear {
  if (!board) return () => true;
  return (x, y, drop) =>
    x < board.x - PAD || x > board.x + board.width + PAD || y + drop < board.y - PAD || y > board.y + board.height + PAD;
}

/** A string sagging across the screen from y0, drawn only where it is clear of the board. */
function string(g: Phaser.GameObjects.Graphics, width: number, y0: number, sag: number, drop: number, clear: Clear): void {
  let drawing = false;
  for (let x = 0; x <= width; x += 4) {
    const y = y0 + sag * Math.sin((Math.PI * x) / width);
    if (!clear(x, y, drop)) {
      if (drawing) g.strokePath();
      drawing = false;
      continue;
    }
    if (!drawing) {
      g.beginPath();
      g.moveTo(x, y);
      drawing = true;
    } else g.lineTo(x, y);
  }
  if (drawing) g.strokePath();
}

/** Kawung: four ovals around each point of a grid, faint. */
function batik(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const step = 44;
  const [line, dot] = look.motifColors.map(hex) as [number, number];
  for (let y = 0; y < height + step; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < width + step; x += step) {
      g.lineStyle(2, line, 0.9);
      for (const [dx, dy] of [
        [0, -10],
        [10, 0],
        [0, 10],
        [-10, 0],
      ] as const) {
        g.strokeEllipse(x + dx, y + dy, dx === 0 ? 10 : 18, dx === 0 ? 18 : 10);
      }
      g.fillStyle(dot, 0.9).fillCircle(x, y, 2.4);
    }
  }
}

/** Strings of red and white pennants hanging in shallow arcs, the first just under the HUD. */
function bunting(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number, top: number, clear: Clear): void {
  const colors = look.motifColors.map(hex);
  for (let row = 0; row < 4; row++) {
    const y0 = top + 3 + row * Math.max(120, height / 4);
    if (y0 > height) break;
    const sag = 10;
    g.lineStyle(1.5, 0xd8d0c0, 0.8);
    string(g, width, y0, sag, 11, clear);
    for (let x = 6, i = 0; x < width - 6; x += 18, i++) {
      const y = y0 + sag * Math.sin((Math.PI * x) / width);
      if (!clear(x - 6, y, 11) || !clear(x + 6, y, 11)) continue;
      g.fillStyle(colors[i % colors.length]!, row === 0 ? 1 : 0.5).fillTriangle(x - 6, y, x + 6, y, x, y + 11);
    }
  }
}

/** Strings of coloured bulbs across the night, each with a soft glow. */
function bulbs(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number, top: number, clear: Clear): void {
  const colors = look.motifColors.map(hex);
  for (let row = 0; row < 5; row++) {
    const y0 = top + 4 + row * Math.max(110, height / 5);
    if (y0 > height) break;
    const sag = 18;
    g.lineStyle(1.2, 0x6a6a8a, 0.8);
    string(g, width, y0, sag, 13, clear);
    for (let x = 10, i = 0; x < width; x += 26, i++) {
      const y = y0 + sag * Math.sin((Math.PI * x) / width) + 4;
      if (!clear(x - 9, y - 4, 13) || !clear(x + 9, y - 4, 13)) continue;
      const color = colors[(i + row) % colors.length]!;
      g.fillStyle(color, 0.18).fillCircle(x, y, 9);
      g.fillStyle(color, 1).fillCircle(x, y, 3.2);
    }
  }
}

/** Light wave lines over the sea-to-sand gradient. */
function waves(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [sea, sand] = look.motifColors.map(hex) as [number, number];
  for (let y = 40; y < height; y += 46) {
    g.lineStyle(2, y < height * 0.6 ? sea : sand, 0.35);
    g.beginPath();
    for (let x = 0; x <= width; x += 6) {
      const wy = y + 4 * Math.sin(x / 18 + y);
      if (x === 0) g.moveTo(x, wy);
      else g.lineTo(x, wy);
    }
    g.strokePath();
  }
}

/** A sports field: wide mowed stripes and the faint white lines of a court around the middle. */
function court(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [stripe, line] = look.motifColors.map(hex) as [number, number];
  const band = 56;
  for (let y = 0, i = 0; y < height; y += band, i++) if (i % 2) g.fillStyle(stripe, 0.8).fillRect(0, y, width, band);
  g.lineStyle(3, line, 0.22);
  const inset = Math.min(width, height) * 0.08;
  g.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  g.lineBetween(inset, height / 2, width - inset, height / 2);
  g.strokeCircle(width / 2, height / 2, Math.min(width, height) * 0.14);
  g.strokeRect(width * 0.3, inset, width * 0.4, height * 0.12);
  g.strokeRect(width * 0.3, height - inset - height * 0.12, width * 0.4, height * 0.12);
}

/** A kampung yard: chalked hopscotch (engklek) squares up the sides, and scattered marbles. */
function chalk(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [line, dot] = look.motifColors.map(hex) as [number, number];
  const size = 40;
  g.lineStyle(2.5, line, 0.28);
  for (const x0 of [12, width - 12 - size * 2]) {
    for (let y = 30, i = 0; y < height - size; y += size, i++) {
      if (i % 3 === 1) {
        g.strokeRect(x0, y, size, size);
        g.strokeRect(x0 + size, y, size, size);
      } else g.strokeRect(x0 + size / 2, y, size, size);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * width;
    const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * height;
    g.fillStyle(dot, 0.5).fillCircle(x, y, 3.2);
  }
}

/** Cloves and peppercorns scattered on a deep red ground. */
function spices(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [clove, pepper] = look.motifColors.map(hex) as [number, number];
  const step = 52;
  for (let y = 18; y < height + step; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 8; x < width + step; x += step) {
      // A clove: a short stem with a four-pointed head.
      const a = Math.sin(x * 0.7 + y) * 0.9;
      const dx = Math.sin(a) * 10;
      const dy = Math.cos(a) * 10;
      g.lineStyle(3, clove, 0.9).lineBetween(x, y, x + dx, y + dy);
      g.fillStyle(clove, 0.9).fillCircle(x, y, 4);
      // Peppercorns beside it.
      g.fillStyle(pepper, 0.55).fillCircle(x + 18, y + 8, 3).fillCircle(x + 24, y + 3, 2.6).fillCircle(x + 22, y + 13, 2.4);
    }
  }
}

/** Rice terraces: curved steps down the hill, alternating greens, each with a pale water line. */
function terraces(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [dark, light] = look.motifColors.map(hex) as [number, number];
  const step = 38;
  for (let y = 0, i = 0; y < height + step; y += step, i++) {
    g.fillStyle(i % 2 ? dark : light, 0.28);
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= width; x += 8) g.lineTo(x, y + 10 * Math.sin(x / 70 + i * 0.8));
    g.lineTo(width, y + step + 6);
    g.lineTo(0, y + step + 6);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, light, 0.4);
    g.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const ly = y + 10 * Math.sin(x / 70 + i * 0.8);
      if (x === 0) g.moveTo(x, ly);
      else g.lineTo(x, ly);
    }
    g.strokePath();
  }
}

/** A rainforest: big pointed leaves crowding in from both sides, darker behind and lighter in front. */
function leaves(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number): void {
  const [back, front] = look.motifColors.map(hex) as [number, number];
  const leaf = (x: number, y: number, length: number, angle: number, color: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (u: number, v: number) => ({ x: x + u * cos - v * sin, y: y + u * sin + v * cos });
    const points = [at(0, 0), at(length * 0.3, -length * 0.22), at(length * 0.7, -length * 0.16), at(length, 0), at(length * 0.7, length * 0.16), at(length * 0.3, length * 0.22)];
    g.fillStyle(color, 0.75).beginPath();
    points.forEach((point, k) => (k === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y)));
    g.closePath();
    g.fillPath();
    const tip = at(length * 0.95, 0);
    g.lineStyle(1.5, back, 0.9).lineBetween(x, y, tip.x, tip.y);
  };
  for (let y = 10, i = 0; y < height; y += 64, i++) {
    leaf(-10, y, 90 + (i % 3) * 16, -0.3 + (i % 2) * 0.6, i % 2 ? back : front);
    leaf(width + 10, y + 30, 90 + ((i + 1) % 3) * 16, Math.PI + 0.3 - (i % 2) * 0.6, i % 2 ? front : back);
  }
}

/**
 * The closing festival, mixing every island: strings of bunting in every theme's colours, strings of bulbs,
 * confetti, and a band of waves along the bottom.
 */
function festival(g: Phaser.GameObjects.Graphics, look: ThemeLook, width: number, height: number, top: number, clear: Clear): void {
  const colors = look.motifColors.map(hex);
  for (let i = 0; i < 70; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * width;
    const y = (Math.sin(i * 78.233) * 0.5 + 0.5) * height;
    g.fillStyle(colors[i % colors.length]!, 0.35).fillRect(x, y, 5, 3);
  }
  for (let row = 0; row < 4; row++) {
    const y0 = top + 3 + row * Math.max(120, height / 4);
    if (y0 > height) break;
    const sag = 12;
    g.lineStyle(1.5, 0xd8d0c0, 0.8);
    string(g, width, y0, sag, 12, clear);
    for (let x = 8, i = 0; x < width - 6; x += 20, i++) {
      const y = y0 + sag * Math.sin((Math.PI * x) / width);
      if (row % 2 === 0) {
        if (!clear(x - 6, y, 11) || !clear(x + 6, y, 11)) continue;
        g.fillStyle(colors[(i + row) % colors.length]!, row === 0 ? 1 : 0.55).fillTriangle(x - 6, y, x + 6, y, x, y + 11);
      } else {
        if (!clear(x - 9, y - 4, 13) || !clear(x + 9, y - 4, 13)) continue;
        const color = colors[(i * 3 + row) % colors.length]!;
        g.fillStyle(color, 0.18).fillCircle(x, y + 4, 9);
        g.fillStyle(color, 1).fillCircle(x, y + 4, 3.2);
      }
    }
  }
  g.lineStyle(2, colors[4]!, 0.35);
  for (let y = height - 70; y < height; y += 22) {
    g.beginPath();
    for (let x = 0; x <= width; x += 6) {
      const wy = y + 4 * Math.sin(x / 18 + y);
      if (x === 0) g.moveTo(x, wy);
      else g.lineTo(x, wy);
    }
    g.strokePath();
  }
}
