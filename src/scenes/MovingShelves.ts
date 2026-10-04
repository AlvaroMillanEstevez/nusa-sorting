import * as Phaser from 'phaser';
import type { BoardLayout } from '../ui/boardLayout';
import type { LiveBoard } from '../ui/levelLayout';
import { art } from './art/ArtSet';
import { BakedLayer } from './art/BakedLayer';

/** Under every item (back-layer items start at depth 1). */
const DEPTH_MOVING_SHELF = 0.5;

/**
 * Shelves riding tracks: each is drawn once at its own origin and then moved as a whole every frame to where
 * liveBoard puts it, fading at the ends of its loop. Fixed shelves are drawn by the scene's board graphics.
 */
export class MovingShelves {
  private readonly shelves = new Map<number, BakedLayer>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Redraws the moving shelves of a board (none for boards without shelf tracks). */
  relayout(base: BoardLayout, moving: readonly boolean[]): void {
    for (const g of this.shelves.values()) g.destroy();
    this.shelves.clear();
    moving.forEach((isMoving, shelf) => {
      if (!isMoving) return;
      const layout = base.shelves[shelf]!;
      const s = base.slotSize;
      const { width, height } = layout.rect;
      // Drawn at its own origin; the bounds leave room for the brackets under the board.
      const layer = new BakedLayer(this.scene, DEPTH_MOVING_SHELF);
      layer.draw({ x: -s * 0.1, y: -s * 0.05, width: width + s * 0.2, height: height + s * 0.3 }, (g) =>
        art().drawShelf(g, layout, s, -layout.rect.x, -layout.rect.y),
      );
      this.shelves.set(shelf, layer);
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
