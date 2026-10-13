import * as Phaser from 'phaser';
import beamUrl from '../../assets/art/beam.webp?url';
import boardsUrl from '../../assets/art/boards.webp?url';
import crateUrl from '../../assets/art/crate.webp?url';
import wallUrl from '../../assets/art/wall.webp?url';
import { slotAspect, type TrackLayout } from '../../ui/boardLayout';
import { WOOD } from '../../ui/art/wood';
import { CUBBY_TEXTURE, SHELF_TEXTURE } from './shelfArt';

/**
 * Everything on the board besides the shelves, in the same illustrated wood: pieces cut from the shelf picture by
 * tools/art/build_game_art.py (its top beam, a panel of boards made of it, a crate, a compartment's back wall),
 * put together here at the slot size. Scenes build these and never pick colours or shapes themselves. The small
 * details (nails, the padlock, log ends) are drawn, in the wood palette.
 */

/** The textures the board is made of; the gallery passes colour-blind versions of them. */
export interface ArtKeys {
  readonly shelf: string;
  readonly cubby: string;
  readonly beam: string;
  readonly boards: string;
  readonly crate: string;
  readonly wall: string;
}

export const ART_KEYS: ArtKeys = { shelf: SHELF_TEXTURE, cubby: CUBBY_TEXTURE, beam: 'art:beam', boards: 'art:boards', crate: 'art:crate', wall: 'art:wall' };

const PIECE_URLS: readonly (readonly [string, string])[] = [
  [ART_KEYS.beam, beamUrl],
  [ART_KEYS.boards, boardsUrl],
  [ART_KEYS.crate, crateUrl],
  [ART_KEYS.wall, wallUrl],
];

/** Downloads the wood pieces (small: about 30 KB together). */
export function loadArtPieces(textures: Phaser.Textures.TextureManager): Promise<void> {
  return Promise.all(
    PIECE_URLS.map(async ([key, url]) => {
      if (textures.exists(key)) return;
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!textures.exists(key)) textures.addImage(key, image);
    }),
  ).then(() => undefined);
}

const hex = (color: string) => Number.parseInt(color.slice(1), 16);

/** Height of one board in the boards panel, as a share of the panel (it has five). */
const BOARD_SHARE = 1 / 5;

/**
 * A length of the beam `length` long and `thickness` thick, centred on (x, y), along `angle` (radians; 0 is
 * horizontal). Its grain repeats along it, never stretched.
 */
function plank(scene: Phaser.Scene, keys: ArtKeys, x: number, y: number, length: number, thickness: number, angle = 0): Phaser.GameObjects.TileSprite {
  const frame = scene.textures.getFrame(keys.beam);
  const k = thickness / frame.height;
  const strip = scene.add.tileSprite(x, y, length / k, frame.height, keys.beam).setScale(k).setRotation(angle);
  return strip;
}

/** A panel of horizontal boards `width` × `height`, centred on (x, y), each board about `board` px tall. */
function boards(scene: Phaser.Scene, keys: ArtKeys, x: number, y: number, width: number, height: number, board: number): Phaser.GameObjects.TileSprite {
  const frame = scene.textures.getFrame(keys.boards);
  const k = board / (frame.height * BOARD_SHARE);
  return scene.add.tileSprite(x, y, width / k, height / k, keys.boards).setScale(k);
}

/** A nail head. */
function nail(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(hex(WOOD.line), 1).fillCircle(x, y, s * 0.03);
  g.fillStyle(hex(WOOD.brass), 1).fillCircle(x, y, s * 0.016);
}

/**
 * The shutter over a locked shelf, centred on (0, 0): boards you can barely see the goods through, with a dark
 * plate for the padlock and the counter label (right of centre, added by the caller).
 */
export function makeLockVeil(scene: Phaser.Scene, width: number, height: number, s: number, keys: ArtKeys = ART_KEYS): Phaser.GameObjects.Container {
  const shutter = boards(scene, keys, 0, 0, width, height, s * 0.2).setAlpha(0.96);
  const g = scene.add.graphics();
  const edge = Math.max(1, s * 0.03);
  g.lineStyle(edge, hex(WOOD.line), 1).strokeRect(-width / 2, -height / 2, width, height);
  // A dark plate behind the padlock and the counter, so the text reads on the boards.
  g.fillStyle(hex(WOOD.shutterDark), 0.95).fillRoundedRect(-width * 0.44, -s * 0.25, width * 0.88, s * 0.5, s * 0.1);
  g.lineStyle(edge, hex(WOOD.brassDark), 1).strokeRoundedRect(-width * 0.44, -s * 0.25, width * 0.88, s * 0.5, s * 0.1);
  // Brass padlock.
  const lx = -s * 0.45;
  const size = s * 0.42;
  g.lineStyle(Math.max(2, size * 0.13), hex(WOOD.brassDark), 1);
  g.beginPath();
  g.arc(lx, -size * 0.1, size * 0.24, Math.PI, 0);
  g.strokePath();
  g.fillStyle(hex(WOOD.brass), 1).fillRoundedRect(lx - size * 0.36, -size * 0.12, size * 0.72, size * 0.58, size * 0.1);
  g.lineStyle(edge, hex(WOOD.brassDark), 1).strokeRoundedRect(lx - size * 0.36, -size * 0.12, size * 0.72, size * 0.58, size * 0.1);
  g.fillStyle(hex(WOOD.line), 1).fillCircle(lx, size * 0.1, size * 0.08).fillRect(lx - size * 0.03, size * 0.12, size * 0.06, size * 0.14);
  // Nails at the corners.
  for (const [nx, ny] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    nail(g, nx * (width / 2 - s * 0.08), ny * (height / 2 - s * 0.08), s);
  }
  return scene.add.container(0, 0, [shutter, g]);
}

/** The roaming blocker: a wooden crate filling most of a slot, centred on (0, 0). */
export function makeBlocker(scene: Phaser.Scene, slotSize: number, keys: ArtKeys = ART_KEYS): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, keys.crate).setDisplaySize(slotSize * 0.84, slotSize * 0.84);
}

/** Two planks nailed across `width` × `height`, a little askew, over a darkened back: something out of use. */
function nailedPlanks(scene: Phaser.Scene, keys: ArtKeys, width: number, height: number, s: number, shade: number): Phaser.GameObjects.Container {
  const back = scene.add.graphics();
  back.fillStyle(hex(WOOD.wallShade), shade).fillRoundedRect(-width / 2, -height / 2, width, height, s * 0.06);
  const parts: Phaser.GameObjects.GameObject[] = [back];
  const nails = scene.add.graphics();
  for (const [dy, angle] of [
    [-0.18, -0.05],
    [0.2, 0.04],
  ] as const) {
    const cy = dy * height;
    const w = width * 1.02;
    parts.push(plank(scene, keys, 0, cy, w, s * 0.2, angle));
    for (const u of [-w / 2 + s * 0.14, w / 2 - s * 0.14]) nail(nails, u * Math.cos(angle), cy + u * Math.sin(angle), s);
  }
  parts.push(nails);
  return scene.add.container(0, 0, parts);
}

/** Planks nailed across a closed shelf, centred on (0, 0). */
export function makeClosedPlanks(scene: Phaser.Scene, width: number, height: number, s: number, keys: ArtKeys = ART_KEYS): Phaser.GameObjects.Container {
  return nailedPlanks(scene, keys, width, height, s, 0.75);
}

/** The inside of a fixed stack's cubby that has run out, boarded up, centred on (0, 0) (see cubbyInsideY). */
export function makeEmptyStack(scene: Phaser.Scene, slotSize: number, keys: ArtKeys = ART_KEYS): Phaser.GameObjects.Container {
  return nailedPlanks(scene, keys, slotSize * 0.86, slotSize * slotAspect() * 0.94, slotSize, 0.9);
}

/** The plate under each stack on a conveyor: a small board tray, `size` px square. */
export function makePlate(scene: Phaser.Scene, size: number, keys: ArtKeys = ART_KEYS): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, keys.boards).setDisplaySize(size, size);
}

/** The small tag on a shelf that closes once emptied, centred on (0, 0): two crossed planks and their nail. */
export function drawClosingMark(g: Phaser.GameObjects.Graphics, s: number): void {
  const r = s * 0.17;
  const edge = Math.max(1, s * 0.025);
  g.fillStyle(hex(WOOD.frameDark), 1).fillCircle(0, 0, r);
  g.lineStyle(edge, hex(WOOD.line), 1).strokeCircle(0, 0, r);
  const arm = r * 0.72;
  for (const sign of [1, -1]) {
    g.lineStyle(r * 0.42, hex(WOOD.line), 1).lineBetween(-arm, -arm * sign * 0.55, arm, arm * sign * 0.55);
    g.lineStyle(r * 0.28, hex(WOOD.crateLight), 1).lineBetween(-arm, -arm * sign * 0.55, arm, arm * sign * 0.55);
  }
  g.fillStyle(hex(WOOD.brass), 1).fillCircle(0, 0, r * 0.14);
}

/** A wooden log seen end-on (a conveyor's roller). */
function roller(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, edge: number): void {
  g.fillStyle(hex(WOOD.log), 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(1, r * 0.08), hex(WOOD.logLight), 1).strokeCircle(x, y, r * 0.68);
  g.lineStyle(Math.max(1, r * 0.06), hex(WOOD.logDark), 1).strokeCircle(x, y, r * 0.4);
  g.fillStyle(hex(WOOD.logDark), 1).fillCircle(x, y, r * 0.14);
  g.lineStyle(edge, hex(WOOD.line), 1).strokeCircle(x, y, r);
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

/** What a track is made of: pieces under its carriers and pieces over them (covering the loop's ends). */
export interface TrackPieces {
  readonly under: Phaser.GameObjects.GameObject[];
  readonly over: Phaser.GameObjects.GameObject[];
}

/**
 * A conveyor of stacks: under the carriers, a dark wooden bed between two beams; over them, log rollers at both
 * ends of the loop, covering where carriers fade out and back in (drawn into `rollers`).
 */
export function makeStackTrack(scene: Phaser.Scene, rollers: Phaser.GameObjects.Graphics, layout: TrackLayout, keys: ArtKeys = ART_KEYS): TrackPieces {
  const { rect, cross, slotSize } = layout;
  const t = slotSize * 0.92;
  const pole = slotSize * 0.13;
  const horizontal = layout.orientation === 'horizontal';
  const length = horizontal ? rect.width : rect.height;
  const mid = horizontal ? rect.x + rect.width / 2 : rect.y + rect.height / 2;
  const at = (along: number, across: number): [number, number] => (horizontal ? [along, across] : [across, along]);
  const angle = horizontal ? 0 : Math.PI / 2;
  // The bed: the back wall's dark wood, its grain along the conveyor.
  const wall = scene.textures.getFrame(keys.wall);
  const k = t / wall.width;
  // Upright, the wall's grain runs down it: turned a quarter for a horizontal conveyor.
  const bed = scene.add.tileSprite(...at(mid, cross), wall.width, length / k, keys.wall).setScale(k).setRotation(horizontal ? Math.PI / 2 : 0);
  const rails = [-1, 1].map((side) => plank(scene, keys, ...at(mid, cross + side * (t / 2 - pole * 0.2)), length, pole, angle));
  const r = Math.max(t / 2, slotSize * 0.5);
  for (const [x, y] of trackEnds(layout)) roller(rollers, x, y, r, Math.max(1, slotSize * 0.025));
  return { under: [bed, ...rails], over: [] };
}

/**
 * A track of shelves: beams up both sides of the column, and over the loop's ends a beam across each, with log
 * ends (drawn into `rollers`).
 */
export function makeShelfTrack(scene: Phaser.Scene, rollers: Phaser.GameObjects.Graphics, layout: TrackLayout, keys: ArtKeys = ART_KEYS): TrackPieces {
  const { rect } = layout;
  // The poles and caps keep the proportions they were drawn with (about 0.77 of a slot).
  const s = layout.slotSize * 0.77;
  const pole = Math.max(4, s * 0.13);
  const cy = rect.y + rect.height / 2;
  const sides = [rect.x - pole / 2 - s * 0.035, rect.x + rect.width + pole / 2 + s * 0.035].map((x) => plank(scene, keys, x, cy, rect.height, pole, Math.PI / 2));
  const cap = s * 0.3;
  const ends: Phaser.GameObjects.GameObject[] = [];
  for (const y of [rect.y, rect.y + rect.height]) {
    const w = rect.width + pole * 4;
    ends.push(plank(scene, keys, rect.x + rect.width / 2, y, w, cap));
    for (const ex of [rect.x - pole * 2 + cap / 2, rect.x + rect.width + pole * 2 - cap / 2]) {
      rollers.fillStyle(hex(WOOD.logLight), 1).fillEllipse(ex, y, cap * 0.5, cap * 0.8);
      rollers.lineStyle(Math.max(1, s * 0.03), hex(WOOD.logDark), 1).strokeEllipse(ex, y, cap * 0.5, cap * 0.8);
    }
  }
  return { under: sides, over: ends };
}
