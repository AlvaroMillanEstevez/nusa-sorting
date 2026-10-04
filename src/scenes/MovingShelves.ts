import * as Phaser from 'phaser';
import type { BoardLayout } from '../ui/boardLayout';
import type { LiveBoard } from '../ui/levelLayout';
import { drawShelf } from './shelfArt';

/** Under every item (back-layer items start at depth 1). */
const DEPTH_MOVING_SHELF = 0.5;

/**
 * Shelves riding tracks: each is drawn once at its own origin and then moved as a whole every frame to where
 * liveBoard puts it, fading at the ends of its loop. Fixed shelves are drawn by the scene's board graphics.
 */
export class MovingShelves {
  private readonly shelves = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Redraws the moving shelves of a board (none for boards without shelf tracks). */
  relayout(base: BoardLayout, moving: readonly boolean[]): void {
    for (const g of this.shelves.values()) g.destroy();
    this.shelves.clear();
    moving.forEach((isMoving, shelf) => {
      if (!isMoving) return;
      const layout = base.shelves[shelf]!;
      const g = this.scene.add.graphics().setDepth(DEPTH_MOVING_SHELF);
      drawShelf(g, layout, base.slotSize, -layout.rect.x, -layout.rect.y);
      this.shelves.set(shelf, g);
    });
  }

  /** Per frame: follow the live positions. Allocates nothing. */
  update(live: LiveBoard): void {
    for (const [shelf, g] of this.shelves) {
      const { rect } = live.layout.shelves[shelf]!;
      g.setPosition(rect.x, rect.y).setAlpha(live.shelfAlpha[shelf]!);
    }
  }
}
