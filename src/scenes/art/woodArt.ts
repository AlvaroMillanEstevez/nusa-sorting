import type * as Phaser from 'phaser';
import type { ShelfLayout, TrackLayout } from '../../ui/boardLayout';
import { WOOD, type WoodPalette } from '../../ui/art/wood';
import type { ArtSet } from './ArtSet';

/**
 * Wooden street-stall look: warung shelves, bamboo conveyors, a rolling shutter for locked shelves and a crate
 * for the blocker. Everything is drawn from the slot size `s`, so it scales to any size without stretching.
 */

const hex = (color: string) => Number.parseInt(color.slice(1), 16);

/** A stable pseudo-random number in [0, 1) for a point, so each shelf gets its own wood grain. */
function noise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** A gently wavy line from (x0, y) to (x1, y): wood grain. */
function grainLine(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, amp: number, wave: number, phase: number): void {
  g.beginPath();
  const steps = Math.max(4, Math.ceil((x1 - x0) / (wave / 4)));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const py = y + Math.sin(phase + (x - x0) * ((2 * Math.PI) / wave)) * amp;
    if (i === 0) g.moveTo(x, py);
    else g.lineTo(x, py);
  }
  g.strokePath();
}

/** A bamboo pole along a rectangle: rounded, with a highlight and node rings across it. */
function bamboo(
  g: Phaser.GameObjects.Graphics,
  p: WoodPalette,
  x: number,
  y: number,
  w: number,
  h: number,
  nodeEvery: number,
  edge: number,
): void {
  const vertical = h > w;
  const thick = vertical ? w : h;
  g.fillStyle(hex(p.bamboo), 1).fillRoundedRect(x, y, w, h, thick / 2);
  g.fillStyle(hex(p.bambooLight), 0.9);
  if (vertical) g.fillRect(x + thick * 0.2, y + thick * 0.3, thick * 0.22, h - thick * 0.6);
  else g.fillRect(x + thick * 0.3, y + thick * 0.2, w - thick * 0.6, thick * 0.22);
  g.lineStyle(Math.max(1, thick * 0.16), hex(p.bambooDark), 1);
  const length = vertical ? h : w;
  for (let at = nodeEvery / 2; at < length - thick / 2; at += nodeEvery) {
    if (vertical) g.lineBetween(x, y + at, x + w, y + at);
    else g.lineBetween(x + at, y, x + at, y + h);
  }
  g.lineStyle(edge, hex(p.line), 1).strokeRoundedRect(x, y, w, h, thick / 2);
}

/** A wooden log seen end-on (conveyor roller). */
function roller(g: Phaser.GameObjects.Graphics, p: WoodPalette, x: number, y: number, r: number, edge: number): void {
  g.fillStyle(hex(p.frame), 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(1, r * 0.08), hex(p.frameLight), 1).strokeCircle(x, y, r * 0.68);
  g.lineStyle(Math.max(1, r * 0.06), hex(p.frameDark), 1).strokeCircle(x, y, r * 0.4);
  g.fillStyle(hex(p.frameDark), 1).fillCircle(x, y, r * 0.14);
  g.lineStyle(edge, hex(p.line), 1).strokeCircle(x, y, r);
}

export function drawWoodShelf(
  g: Phaser.GameObjects.Graphics,
  shelf: ShelfLayout,
  s: number,
  dx = 0,
  dy = 0,
  p: WoodPalette = WOOD,
): void {
  const { rect } = shelf;
  const x = rect.x + dx;
  const y = rect.y + dy;
  const w = rect.width;
  const h = rect.height;
  const edge = Math.max(1, s * 0.03);
  const plankTop = shelf.slots[0]!.y + dy + s / 2;
  const seed = noise(rect.x, rect.y);

  // Brackets under the board at both ends, within the gap to the next shelf.
  const bw = s * 0.2;
  const bh = s * 0.12;
  g.fillStyle(hex(p.frameDark), 1);
  g.lineStyle(edge, hex(p.line), 1);
  for (const [bx, dir] of [
    [x + s * 0.08, 1],
    [x + w - s * 0.08, -1],
  ] as const) {
    g.fillTriangle(bx, y + h, bx + bw * dir, y + h, bx, y + h + bh);
    g.strokeTriangle(bx, y + h, bx + bw * dir, y + h, bx, y + h + bh);
  }

  // Frame: thin sides and top (the layout leaves SIDE_PAD and TOP_PAD for them).
  g.fillStyle(hex(p.frame), 1).fillRoundedRect(x, y, w, h, s * 0.05);
  g.lineStyle(edge, hex(p.line), 1).strokeRoundedRect(x, y, w, h, s * 0.05);
  g.fillStyle(hex(p.frameLight), 0.7).fillRect(x + s * 0.05, y + s * 0.015, w - s * 0.1, s * 0.022);

  // Back wall: dark boards with seams, shaded at the top and sides so it reads as the inside of a box.
  const side = s * 0.035;
  const wx = x + side;
  const wy = y + s * 0.05;
  const ww = w - side * 2;
  const wh = plankTop - wy;
  g.fillStyle(hex(p.wall), 1).fillRect(wx, wy, ww, wh);
  const boards = Math.max(2, Math.round(ww / (s * 0.42)));
  for (let i = 1; i < boards; i++) {
    const sx = wx + (ww * i) / boards;
    g.lineStyle(Math.max(1, s * 0.022), hex(p.wallShade), 1).lineBetween(sx, wy, sx, wy + wh);
    g.lineStyle(Math.max(1, s * 0.012), hex(p.wallSlat), 1).lineBetween(sx + s * 0.02, wy, sx + s * 0.02, wy + wh);
  }
  const shade = hex(p.wallShade);
  g.fillGradientStyle(shade, shade, shade, shade, 0.95, 0.95, 0, 0).fillRect(wx, wy, ww, s * 0.2);
  g.fillGradientStyle(shade, shade, shade, shade, 0.8, 0, 0.8, 0).fillRect(wx, wy, s * 0.08, wh);
  g.fillGradientStyle(shade, shade, shade, shade, 0, 0.8, 0, 0.8).fillRect(wx + ww - s * 0.08, wy, s * 0.08, wh);

  // A slightly lighter panel behind each slot, so slots read at a glance.
  g.fillStyle(hex(p.wallSlat), 0.55);
  const panelH = shelf.slotHeight - s * 0.08;
  for (const slot of shelf.slots) {
    g.fillRoundedRect(slot.x + dx - s * 0.46, plankTop - s * 0.04 - panelH, s * 0.92, panelH, s * 0.1);
  }

  // Front board: overhangs a little, with a lit top edge, a dark lower edge and grain.
  const px = x - s * 0.02;
  const pw = w + s * 0.04;
  const py = plankTop - s * 0.02;
  const ph = y + h - py + s * 0.02;
  g.fillStyle(hex(p.plank), 1).fillRect(px, py, pw, ph);
  g.fillStyle(hex(p.plankLight), 1).fillRect(px, py, pw, s * 0.04);
  g.fillStyle(hex(p.plankDark), 1).fillRect(px, py + ph - s * 0.05, pw, s * 0.05);
  g.lineStyle(Math.max(1, s * 0.016), hex(p.grain), 0.85);
  grainLine(g, px + s * 0.05, px + pw - s * 0.05, py + ph * 0.42, s * 0.012, s * 0.9, seed * 6.28);
  grainLine(g, px + s * 0.3, px + pw - s * 0.4, py + ph * 0.66, s * 0.01, s * 1.3, seed * 9.1);
  g.fillStyle(hex(p.grain), 0.9).fillEllipse(px + pw * (0.2 + seed * 0.6), py + ph * 0.55, s * 0.12, s * 0.05);
  g.lineStyle(edge, hex(p.line), 1).strokeRect(px, py, pw, ph);
}

/** Both ends of a conveyor loop, where rollers sit. */
function trackEnds(layout: TrackLayout): [number, number][] {
  const { rect, cross } = layout;
  return layout.orientation === 'horizontal'
    ? [
        [rect.x, cross],
        [rect.x + rect.width, cross],
      ]
    : [
        [cross, rect.y],
        [cross, rect.y + rect.height],
      ];
}

/** Bamboo mat under each stack on a conveyor, drawn once as a texture. */
const PLATE_TEXTURE = 'belt-plate-wood';
const PLATE_SIZE = 128;

export function makeWoodArt(p: WoodPalette = WOOD): ArtSet {
  return {
    drawShelf: (g, shelf, s, dx = 0, dy = 0) => drawWoodShelf(g, shelf, s, dx, dy, p),

    plateTexture(scene) {
      if (!scene.textures.exists(PLATE_TEXTURE)) {
        const g = scene.add.graphics();
        const n = PLATE_SIZE;
        const m = 6;
        g.fillStyle(hex(p.bamboo), 1).fillRoundedRect(m, m, n - 2 * m, n - 2 * m, 14);
        const slat = (n - 2 * m) / 4;
        for (let i = 0; i < 4; i++) {
          const sx = m + i * slat;
          g.fillStyle(hex(p.bambooLight), 0.9).fillRect(sx + slat * 0.18, m + 8, slat * 0.2, n - 2 * m - 16);
          g.lineStyle(3, hex(p.bambooDark), 1).lineBetween(sx + slat * 0.1, i % 2 ? 42 : 30, sx + slat * 0.9, i % 2 ? 42 : 30);
          g.lineBetween(sx + slat * 0.1, i % 2 ? 92 : 80, sx + slat * 0.9, i % 2 ? 92 : 80);
          if (i > 0) g.lineStyle(4, hex(p.bambooDark), 1).lineBetween(sx, m + 2, sx, n - m - 2);
        }
        g.lineStyle(5, hex(p.line), 1).strokeRoundedRect(m, m, n - 2 * m, n - 2 * m, 14);
        g.generateTexture(PLATE_TEXTURE, n, n);
        g.destroy();
      }
      return { key: PLATE_TEXTURE, size: PLATE_SIZE };
    },

    drawStackTrack(rails, rollers, layout: TrackLayout) {
      const { rect, pitch, cross, slotSize } = layout;
      const t = slotSize * 0.92;
      const pole = slotSize * 0.11;
      const edge = Math.max(1, slotSize * 0.025);
      // A dark wooden bed between two bamboo rails.
      const horizontal = layout.orientation === 'horizontal';
      const bed = horizontal
        ? { x: rect.x, y: cross - t / 2, w: rect.width, h: t }
        : { x: cross - t / 2, y: rect.y, w: t, h: rect.height };
      rails.fillStyle(hex(p.frameDark), 1).fillRect(bed.x, bed.y, bed.w, bed.h);
      rails.fillStyle(hex(p.wallShade), 1);
      if (horizontal) rails.fillRect(bed.x, bed.y + pole, bed.w, bed.h - 2 * pole);
      else rails.fillRect(bed.x + pole, bed.y, bed.w - 2 * pole, bed.h);
      if (horizontal) {
        bamboo(rails, p, bed.x, bed.y - pole * 0.3, bed.w, pole, pitch * 0.8, edge);
        bamboo(rails, p, bed.x, bed.y + bed.h - pole * 0.7, bed.w, pole, pitch * 0.8, edge);
      } else {
        bamboo(rails, p, bed.x - pole * 0.3, bed.y, pole, bed.h, pitch * 0.8, edge);
        bamboo(rails, p, bed.x + bed.w - pole * 0.7, bed.y, pole, bed.h, pitch * 0.8, edge);
      }
      // Log rollers centred on the loop's ends, covering where carriers fade out and back in.
      const r = Math.max(t / 2, slotSize * 0.5);
      for (const [x, y] of trackEnds(layout)) roller(rollers, p, x, y, r, edge);
    },

    drawShelfTrack(rails, rollers, layout) {
      const { rect } = layout;
      // The poles and caps keep the proportions they were drawn with (about 0.77 of a slot).
      const s = layout.slotSize * 0.77;
      const pole = Math.max(3, s * 0.11);
      const edge = Math.max(1, s * 0.03);
      // Bamboo poles up both sides, in the gaps beside the column, and a log across each end of the loop.
      bamboo(rails, p, rect.x - pole - s * 0.035, rect.y, pole, rect.height, s * 0.7, edge);
      bamboo(rails, p, rect.x + rect.width + s * 0.035, rect.y, pole, rect.height, s * 0.7, edge);
      const cap = s * 0.3;
      for (const y of [rect.y, rect.y + rect.height]) {
        const x0 = rect.x - pole * 2;
        const w = rect.width + pole * 4;
        rollers.fillStyle(hex(p.frame), 1).fillRoundedRect(x0, y - cap / 2, w, cap, cap / 2);
        rollers.fillStyle(hex(p.frameLight), 0.8).fillRect(x0 + cap / 2, y - cap * 0.32, w - cap, cap * 0.16);
        rollers.lineStyle(Math.max(1, s * 0.016), hex(p.grain), 0.9);
        grainLine(rollers, x0 + cap * 0.6, x0 + w - cap * 0.6, y + cap * 0.12, s * 0.01, s, 1.3);
        rollers.lineStyle(edge, hex(p.line), 1).strokeRoundedRect(x0, y - cap / 2, w, cap, cap / 2);
        for (const ex of [x0 + cap / 2, x0 + w - cap / 2]) {
          rollers.fillStyle(hex(p.frameLight), 1).fillEllipse(ex, y, cap * 0.5, cap * 0.8);
          rollers.lineStyle(edge, hex(p.frameDark), 1).strokeEllipse(ex, y, cap * 0.5, cap * 0.8);
        }
      }
    },

    drawLockVeil(g, width, height, s) {
      const x = -width / 2;
      const y = -height / 2;
      const edge = Math.max(1, s * 0.03);
      // A half-lowered rolling shutter: slats you can still glimpse the goods through.
      g.fillStyle(hex(p.shutter), 0.86).fillRoundedRect(x, y, width, height, s * 0.07);
      const step = s * 0.14;
      for (let sy = y + step; sy < y + height - s * 0.1; sy += step) {
        g.lineStyle(Math.max(1, s * 0.026), hex(p.shutterDark), 0.9).lineBetween(x + edge, sy, x + width - edge, sy);
        g.lineStyle(Math.max(1, s * 0.014), hex(p.shutterLight), 0.9).lineBetween(x + edge, sy + s * 0.025, x + width - edge, sy + s * 0.025);
      }
      g.fillStyle(hex(p.shutterDark), 1).fillRect(x, y + height - s * 0.12, width, s * 0.12);
      g.lineStyle(edge, hex(p.line), 1).strokeRoundedRect(x, y, width, height, s * 0.07);
      // A dark plate behind the padlock and the counter, so the text reads on the slats.
      g.fillStyle(hex(p.shutterDark), 0.95).fillRoundedRect(-width * 0.44, -s * 0.25, width * 0.88, s * 0.5, s * 0.1);
      g.lineStyle(edge, hex(p.brassDark), 1).strokeRoundedRect(-width * 0.44, -s * 0.25, width * 0.88, s * 0.5, s * 0.1);
      // Brass padlock.
      const lx = -s * 0.45;
      const size = s * 0.42;
      g.lineStyle(Math.max(2, size * 0.13), hex(p.brassDark), 1);
      g.beginPath();
      g.arc(lx, -size * 0.1, size * 0.24, Math.PI, 0);
      g.strokePath();
      g.fillStyle(hex(p.brass), 1).fillRoundedRect(lx - size * 0.36, -size * 0.12, size * 0.72, size * 0.58, size * 0.1);
      g.lineStyle(edge, hex(p.brassDark), 1).strokeRoundedRect(lx - size * 0.36, -size * 0.12, size * 0.72, size * 0.58, size * 0.1);
      g.fillStyle(hex(p.line), 1).fillCircle(lx, size * 0.1, size * 0.08).fillRect(lx - size * 0.03, size * 0.12, size * 0.06, size * 0.14);
    },

    drawBlocker(g, slotSize) {
      const s = slotSize;
      const half = s * 0.42;
      const edge = Math.max(1.5, s * 0.035);
      // A wooden crate: boards, a frame and a cross brace.
      g.fillStyle(hex(p.crate), 1).fillRoundedRect(-half, -half, half * 2, half * 2, s * 0.05);
      g.lineStyle(Math.max(1, s * 0.025), hex(p.crateDark), 1);
      g.lineBetween(-half, -half / 3, half, -half / 3);
      g.lineBetween(-half, half / 3, half, half / 3);
      const inner = half - s * 0.09;
      g.lineStyle(s * 0.14, hex(p.line), 1);
      g.lineBetween(-inner, -inner, inner, inner);
      g.lineBetween(-inner, inner, inner, -inner);
      g.lineStyle(s * 0.095, hex(p.crateLight), 1);
      g.lineBetween(-inner, -inner, inner, inner);
      g.lineBetween(-inner, inner, inner, -inner);
      g.lineStyle(s * 0.09, hex(p.crateDark), 1).strokeRect(-half + s * 0.045, -half + s * 0.045, half * 2 - s * 0.09, half * 2 - s * 0.09);
      g.fillStyle(hex(p.line), 1);
      for (const [nx, ny] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        g.fillCircle(nx * (half - s * 0.045), ny * (half - s * 0.045), s * 0.022);
      }
      g.lineStyle(edge, hex(p.line), 1).strokeRoundedRect(-half, -half, half * 2, half * 2, s * 0.05);
    },
  };
}

export const woodArt = makeWoodArt();
