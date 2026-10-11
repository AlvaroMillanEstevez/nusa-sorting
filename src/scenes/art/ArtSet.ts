import type * as Phaser from 'phaser';
import type { ShelfLayout, TrackLayout } from '../../ui/boardLayout';
import { WOOD } from '../../ui/art/wood';
import { makeWoodArt, woodArt } from './woodArt';

/**
 * Everything that gives the board its look: shelves, tracks, the locked-shelf veil and the roaming blocker.
 * Scenes draw through the art set and never pick colours or shapes themselves. The gallery builds variants of
 * it (the same art through a colour-blindness simulation).
 */
export interface ArtSet {
  /** One shelf; `dx`/`dy` shift it (moving shelves draw at their own origin and are then moved as a whole). */
  drawShelf(g: Phaser.GameObjects.Graphics, shelf: ShelfLayout, s: number, dx?: number, dy?: number): void;
  /** Texture of the plate under each stack on a conveyor (created once), and its size in px. */
  plateTexture(scene: Phaser.Scene): { key: string; size: number };
  /** A conveyor of stacks: the static rail, and the rollers covering both ends of the loop. */
  drawStackTrack(rails: Phaser.GameObjects.Graphics, rollers: Phaser.GameObjects.Graphics, layout: TrackLayout): void;
  /** A track of shelves: guides along the column and a cap at each end of the loop. */
  drawShelfTrack(rails: Phaser.GameObjects.Graphics, rollers: Phaser.GameObjects.Graphics, layout: TrackLayout): void;
  /** The veil over a locked shelf, centred on (0, 0), with room for the counter label right of centre. */
  drawLockVeil(g: Phaser.GameObjects.Graphics, width: number, height: number, s: number): void;
  /** The roaming blocker, centred on (0, 0). */
  drawBlocker(g: Phaser.GameObjects.Graphics, slotSize: number): void;
  /** Fixed stacks: a row or column of wooden cubbies, one per carrier, that never move. */
  drawFixedStacks(g: Phaser.GameObjects.Graphics, layout: TrackLayout): void;
  /** The empty cubby of a fixed stack that has run out, centred on (0, 0): boarded up, out of use. */
  drawEmptyStack(g: Phaser.GameObjects.Graphics, slotSize: number): void;
  /** The small tag on a shelf that closes once emptied, centred on (0, 0): two crossed planks and their nails. */
  drawClosingMark(g: Phaser.GameObjects.Graphics, s: number): void;
  /** Planks nailed across a closed shelf, centred on (0, 0). */
  drawClosedPlanks(g: Phaser.GameObjects.Graphics, width: number, height: number, s: number): void;
}

let current: ArtSet = woodArt;
let currentTrim: string | null = null;

/** The art the game is drawn with. */
export function art(): ArtSet {
  return current;
}

/**
 * Themed levels trim the shelves in their accent colour (the light edges of the frame and the front board);
 * null goes back to plain wood. The back wall, behind the items, never changes.
 */
export function useShelfTrim(trim: string | null): void {
  if (trim === currentTrim) return;
  currentTrim = trim;
  current = trim ? makeWoodArt({ ...WOOD, frameLight: trim, plankLight: trim }) : woodArt;
}
