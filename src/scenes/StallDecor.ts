import * as Phaser from 'phaser';
import type { Rect } from '../ui/boardLayout';
import { WOOD } from '../ui/art/wood';

const hex = (color: string): number => Number.parseInt(color.slice(1), 16);

export interface StallFrame {
  /** Height of the awning across the top. */
  readonly awning: number;
  /** The board's area, kept clear of anything hanging. */
  readonly board: Rect | null;
  /** The signs the HUD and the boosters hang on (the boosters' only once a booster is unlocked). */
  readonly hud: Rect;
  readonly boosters: Rect | null;
}

/**
 * The warung around the board on wide screens (style A): a striped awning across the top with a scalloped edge,
 * wooden posts at the sides, string lights and garlands of ketupat and lanterns hanging beside the board, and the
 * wooden signs the HUD and the boosters hang on. Everything stays out of the board's area, and the sides are
 * shaded a little so the eye goes to the board. Drawn once into the backdrop, in screen coordinates.
 */
export function drawStall(g: Phaser.GameObjects.Graphics, width: number, height: number, frame: StallFrame): void {
  const unit = Math.min(width, height);
  const post = Math.round(unit * 0.03);
  const { awning, board } = frame;

  // The sides shaded towards the edges.
  if (board) {
    const shade = 0x140a04;
    const leftEnd = Math.max(0, board.x - 12);
    const rightStart = Math.min(width, board.x + board.width + 12);
    g.fillGradientStyle(shade, shade, shade, shade, 0.4, 0, 0.4, 0).fillRect(0, 0, leftEnd, height);
    g.fillGradientStyle(shade, shade, shade, shade, 0, 0.4, 0, 0.4).fillRect(rightStart, 0, width - rightStart, height);
  }

  // Posts holding the awning up.
  for (const x of [0, width - post]) {
    g.fillStyle(hex(WOOD.frame), 1).fillRect(x, 0, post, height);
    g.fillStyle(hex(WOOD.frameLight), 1).fillRect(x + post * 0.18, 0, post * 0.22, height);
    g.fillStyle(hex(WOOD.frameDark), 1).fillRect(x + post * 0.78, 0, post * 0.22, height);
    g.lineStyle(2, hex(WOOD.line), 1).strokeRect(x, -2, post, height + 4);
  }

  // What hangs beside the board: string lights, then a garland on each side if there is room.
  const hudLeft = frame.hud.x;
  const rightFrom = frame.boosters ? frame.boosters.x + frame.boosters.width : board ? board.x + board.width : width / 2;
  const sides: [number, number][] = [
    [post + 6, hudLeft - 10],
    [rightFrom + 10, width - post - 6],
  ];
  for (const [from, to] of sides) lights(g, from, to, awning + unit * 0.035, unit);
  const [leftFrom, leftTo] = sides[0]!;
  if (leftTo - leftFrom >= unit * 0.09) garland(g, (leftFrom + leftTo) / 2, awning, height * 0.62, unit, 'ketupat');
  const [rFrom, rTo] = sides[1]!;
  if (rTo - rFrom >= unit * 0.09) garland(g, (rFrom + rTo) / 2, awning, height * 0.58, unit, 'lantern');

  // Below the signs, a basket of fruit on a crate on each side, as on a market stall.
  const floor = height - unit * 0.02;
  const crate = unit * 0.16;
  basket(g, frame.hud.x + frame.hud.width / 2, floor, crate, [WOOD.lantern, WOOD.bulb, WOOD.ketupat]);
  if (frame.boosters) basket(g, frame.boosters.x + frame.boosters.width / 2, floor, crate * 0.8, [WOOD.bulb, WOOD.lantern, WOOD.awningCream]);

  // The signs, hung from the awning on two ropes.
  sign(g, frame.hud, awning);
  if (frame.boosters) sign(g, frame.boosters, awning);

  awningStripes(g, width, awning);
}

/** The striped awning, shaded under its beam, with a scalloped edge and its shadow on the wall. */
function awningStripes(g: Phaser.GameObjects.Graphics, width: number, height: number): void {
  const stripe = Math.max(28, height * 1.1);
  const count = Math.ceil(width / stripe) + 1;
  const radius = stripe / 2;
  // The shadow the scallops cast.
  g.fillStyle(0x000000, 0.22);
  for (let i = 0; i < count; i++) g.fillCircle(i * stripe + radius, height + 4, radius);
  g.fillRect(0, 0, width, height + 4);
  for (let i = 0; i < count; i++) {
    const red = i % 2 === 0;
    const x = i * stripe;
    g.fillStyle(hex(red ? WOOD.awningRed : WOOD.awningCream), 1);
    g.fillRect(x, 0, stripe, height);
    g.fillCircle(x + radius, height, radius);
    // A fold down the middle of each stripe.
    g.fillStyle(hex(red ? WOOD.awningRedDark : WOOD.awningCreamDark), 0.35).fillRect(x + stripe * 0.62, 0, stripe * 0.38, height);
  }
  // Darker under the beam, and the beam itself.
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.28, 0.28, 0, 0).fillRect(0, 0, width, height * 0.7);
  const beam = Math.max(6, height * 0.2);
  g.fillStyle(hex(WOOD.frameDark), 1).fillRect(0, 0, width, beam);
  g.lineStyle(2, hex(WOOD.line), 1).lineBetween(0, beam, width, beam);
}

/** A sagging wire of warm bulbs from `from` to `to`. */
function lights(g: Phaser.GameObjects.Graphics, from: number, to: number, y: number, unit: number): void {
  const span = to - from;
  if (span < unit * 0.08) return;
  const sag = unit * 0.03;
  const at = (x: number) => y + sag * Math.sin((Math.PI * (x - from)) / span);
  g.lineStyle(1.5, hex(WOOD.line), 0.9).beginPath();
  g.moveTo(from, at(from));
  for (let x = from; x <= to; x += 6) g.lineTo(x, at(x));
  g.lineTo(to, at(to)).strokePath();
  const count = Math.max(2, Math.round(span / (unit * 0.06)));
  const r = unit * 0.009;
  for (let i = 0; i < count; i++) {
    const x = from + ((i + 0.5) * span) / count;
    const by = at(x) + r * 1.6;
    g.fillStyle(hex(WOOD.bulb), 0.14).fillCircle(x, by, r * 4);
    g.fillStyle(hex(WOOD.bulb), 0.3).fillCircle(x, by, r * 2.2);
    g.fillStyle(hex(WOOD.bulb), 1).fillCircle(x, by, r);
  }
}

/** A string hanging from the awning with three ketupat, or three paper lanterns, down it. */
function garland(g: Phaser.GameObjects.Graphics, x: number, top: number, bottom: number, unit: number, kind: 'ketupat' | 'lantern'): void {
  g.lineStyle(1.5, hex(WOOD.line), 0.9).lineBetween(x, top, x, bottom);
  const size = unit * 0.05;
  for (let i = 0; i < 3; i++) {
    const cy = top + (bottom - top) * (0.32 + i * 0.27);
    if (kind === 'ketupat') ketupat(g, x, cy, size);
    else lantern(g, x, cy, size);
  }
}

/** A woven rice parcel: a green diamond with its weave and two leaf ends. */
function ketupat(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const h = size * 0.62;
  const points = [new Phaser.Math.Vector2(x, y - h), new Phaser.Math.Vector2(x + h, y), new Phaser.Math.Vector2(x, y + h), new Phaser.Math.Vector2(x - h, y)];
  g.fillStyle(hex(WOOD.ketupat), 1).fillPoints(points, true);
  g.lineStyle(1.5, hex(WOOD.ketupatDark), 1).strokePoints(points, true);
  // The weave: two strips crossing each way.
  for (const f of [-0.25, 0.25]) {
    g.lineBetween(x - h / 2 + f * h, y - h / 2 - f * h, x + h / 2 + f * h, y + h / 2 - f * h);
    g.lineBetween(x - h / 2 + f * h, y + h / 2 + f * h, x + h / 2 + f * h, y - h / 2 + f * h);
  }
  g.lineStyle(2, hex(WOOD.ketupatDark), 1).lineBetween(x, y + h, x - h * 0.3, y + h * 1.5).lineBetween(x, y + h, x + h * 0.25, y + h * 1.55);
}

/** A round red paper lantern with dark caps and a tassel. */
function lantern(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const w = size * 0.62;
  const h = size * 0.5;
  g.fillStyle(hex(WOOD.bulb), 0.12).fillCircle(x, y, size * 0.9);
  g.fillStyle(hex(WOOD.lantern), 1).fillEllipse(x, y, w * 2, h * 2);
  g.lineStyle(1.5, hex(WOOD.lanternDark), 1).strokeEllipse(x, y, w * 2, h * 2);
  g.strokeEllipse(x, y, w, h * 2);
  g.fillStyle(hex(WOOD.lanternDark), 1)
    .fillRect(x - w * 0.45, y - h - size * 0.1, w * 0.9, size * 0.12)
    .fillRect(x - w * 0.45, y + h - size * 0.02, w * 0.9, size * 0.12);
  g.lineStyle(2, hex(WOOD.brass), 1).lineBetween(x, y + h + size * 0.1, x, y + h + size * 0.4);
}

/** A wooden sign hung from the awning by two ropes, for the HUD or the boosters. */
function sign(g: Phaser.GameObjects.Graphics, rect: Rect, awning: number): void {
  const { x, y, width, height } = rect;
  const r = 12;
  g.lineStyle(2, hex(WOOD.line), 1)
    .lineBetween(x + width * 0.2, awning, x + width * 0.2, y + 6)
    .lineBetween(x + width * 0.8, awning, x + width * 0.8, y + 6);
  g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 2, y + 6, width, height, r);
  g.fillStyle(hex(WOOD.plankDark), 1).fillRoundedRect(x, y, width, height, r);
  g.fillStyle(hex(WOOD.plank), 1).fillRoundedRect(x + 4, y + 4, width - 8, height - 8, r - 3);
  // Planks and grain.
  g.lineStyle(1, hex(WOOD.grain), 0.6);
  for (let i = 1; i < 4; i++) g.lineBetween(x + 6, y + (height * i) / 4, x + width - 6, y + (height * i) / 4);
  g.lineStyle(1, hex(WOOD.plankLight), 0.35);
  for (let i = 0; i < 4; i++) g.lineBetween(x + 10, y + (height * i) / 4 + 6, x + width * 0.55, y + (height * i) / 4 + 6);
  g.lineStyle(3, hex(WOOD.line), 1).strokeRoundedRect(x, y, width, height, r);
  // Nails where the ropes hold it.
  g.fillStyle(hex(WOOD.brassDark), 1).fillCircle(x + width * 0.2, y + 8, 3).fillCircle(x + width * 0.8, y + 8, 3);
}

/** A wooden crate standing on the floor with a woven basket of round fruit on it (`size` is the crate's width). */
function basket(g: Phaser.GameObjects.Graphics, x: number, floor: number, size: number, fruit: readonly string[]): void {
  const crateH = size * 0.55;
  const top = floor - crateH;
  // The crate: planks with a dark outline.
  g.fillStyle(0x000000, 0.25).fillRect(x - size / 2 + 4, top + 4, size, crateH);
  g.fillStyle(hex(WOOD.crate), 1).fillRect(x - size / 2, top, size, crateH);
  g.fillStyle(hex(WOOD.crateLight), 1).fillRect(x - size / 2, top, size, crateH * 0.18);
  g.lineStyle(2, hex(WOOD.crateDark), 1);
  for (let i = 1; i < 3; i++) g.lineBetween(x - size / 2, top + (crateH * i) / 3, x + size / 2, top + (crateH * i) / 3);
  g.lineStyle(2, hex(WOOD.line), 1).strokeRect(x - size / 2, top, size, crateH);
  // Fruit heaped above the basket's rim, then the basket in front.
  const bw = size * 0.82;
  const bh = size * 0.32;
  const r = size * 0.1;
  const heap: readonly [number, number][] = [
    [-0.3, 0], [-0.1, 0], [0.1, 0], [0.3, 0],
    [-0.2, -1.4], [0, -1.5], [0.2, -1.4],
    [-0.08, -2.7], [0.1, -2.6],
  ];
  heap.forEach(([fx, fy], i) => {
    const cx = x + fx * bw;
    const cy = top - bh + fy * r + r * 0.4;
    g.fillStyle(hex(fruit[i % fruit.length]!), 1).fillCircle(cx, cy, r);
    g.lineStyle(1.5, hex(WOOD.line), 0.8).strokeCircle(cx, cy, r);
    g.fillStyle(0xffffff, 0.35).fillCircle(cx - r * 0.35, cy - r * 0.35, r * 0.28);
  });
  const left = x - bw / 2;
  g.fillStyle(hex(WOOD.bamboo), 1).fillRoundedRect(left, top - bh, bw, bh, 6);
  g.lineStyle(1.5, hex(WOOD.bambooDark), 1);
  for (let i = 1; i < 6; i++) g.lineBetween(left + (bw * i) / 6, top - bh + 3, left + (bw * i) / 6, top - 3);
  g.lineBetween(left + 3, top - bh / 2, left + bw - 3, top - bh / 2);
  g.lineStyle(2, hex(WOOD.line), 1).strokeRoundedRect(left, top - bh, bw, bh, 6);
}
