import type * as Phaser from 'phaser';
import type { ShelfLayout, TrackLayout } from '../../ui/boardLayout';
import { classicArt } from './classicArt';

/**
 * Everything that gives the board its look: item textures, shelves, tracks, the locked-shelf veil and the
 * roaming blocker. Scenes draw through the current art set and never pick colours or shapes themselves, so a
 * whole new look can be tried without touching game logic or layout.
 */
export interface ArtSet {
  readonly name: string;
  /** Whether shelves and rails are detailed enough to be drawn once into textures (see BakedLayer). */
  readonly bakes: boolean;
  /** Makes item textures before the game starts. Item textures missing afterwards are drawn on demand. */
  prepareItems(scene: Phaser.Scene): Promise<void>;
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
}

let current: ArtSet = classicArt;

/** The art set in use: the classic one unless another was chosen before the game started. */
export function art(): ArtSet {
  return current;
}

export function setArt(set: ArtSet): void {
  current = set;
}
