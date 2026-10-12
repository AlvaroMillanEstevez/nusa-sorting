import type * as Phaser from 'phaser';
import type { LevelDefinition } from '../core';
import type { Rect, ShelfLayout } from '../ui/boardLayout';

/**
 * A way for a development mock-up of other art (?artpilot) to dress the game without the game knowing about it:
 * empty in the game itself, so it always looks as it does by default.
 */
export interface ArtHooks {
  /** Before a level's items are made: their textures, and how they sit in their slots. */
  dressLevel(scene: Phaser.Scene, level: LevelDefinition): void;
  /** The fixed shelves, drawn over the default ones; returns what it made, destroyed on the next redraw. */
  drawShelves(scene: Phaser.Scene, shelves: readonly ShelfLayout[], slotSize: number): Phaser.GameObjects.GameObject[];
  /** The backdrop of a level without a theme over the whole `screen` (`wide`: desktop layout), or null. */
  backdrop(scene: Phaser.Scene, screen: Rect, wide: boolean): Phaser.GameObjects.GameObject | null;
}

let hooks: ArtHooks | null = null;

export const artHooks = (): ArtHooks | null => hooks;

/** Development only: installs a mock-up's hooks before the game starts. */
export function setArtHooks(next: ArtHooks | null): void {
  hooks = next;
}
