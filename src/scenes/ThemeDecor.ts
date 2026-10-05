import type * as Phaser from 'phaser';
import type { BoardLayout, Rect } from '../ui/boardLayout';
import type { ThemeLook } from '../ui/themeLook';
import { BakedLayer } from './art/BakedLayer';

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

  draw(look: ThemeLook | null, width: number, height: number, layout: BoardLayout): void {
    this.layer.draw(look ? { x: 0, y: 0, width, height } : null, (g) => {
      if (!look) return;
      const [top, bottom] = look.sky.map(hex) as [number, number];
      g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, width, height);
      const hudBottom = layout.hud.height;
      // Strings hang across the screen but stop at the board, so none shows through the gaps between shelves.
      const clear = outsideBoard(boardBounds(layout));
      switch (look.motif) {
        case 'batik':
          return batik(g, look, width, height);
        case 'bunting':
          return bunting(g, look, width, height, hudBottom, clear);
        case 'bulbs':
          return bulbs(g, look, width, height, hudBottom, clear);
        case 'waves':
          return waves(g, look, width, height);
      }
    });
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
