import type * as Phaser from 'phaser';
import type { BoardLayout } from '../ui/boardLayout';
import type { LiveBoard } from '../ui/levelLayout';
import { placeShelf, SHELF_TEXTURE, shelfFrame } from './art/shelfArt';

/** Above the fixed shelves and under every item (back-layer items start at depth 1). */
const DEPTH_MOVING_SHELF = 0.5;

/**
 * Shelves riding tracks: the same picture as fixed shelves, moved as a whole every frame to where liveBoard puts
 * it, fading at the ends of its loop. Fixed shelves are placed by the scene.
 */
export class MovingShelves {
  private readonly shelves = new Map<number, { image: Phaser.GameObjects.Image; dx: number; dy: number }>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places the moving shelves of a board (none for boards without shelf tracks). */
  relayout(base: BoardLayout, moving: readonly boolean[]): void {
    for (const { image } of this.shelves.values()) image.destroy();
    this.shelves.clear();
    moving.forEach((isMoving, shelf) => {
      if (!isMoving) return;
      const layout = base.shelves[shelf]!;
      const image = placeShelf(this.scene.add.image(0, 0, SHELF_TEXTURE).setDepth(DEPTH_MOVING_SHELF), layout, base.slotSize);
      // Where the picture sits from the shelf box's corner, kept as the box moves.
      const frame = shelfFrame(layout, base.slotSize);
      this.shelves.set(shelf, { image, dx: frame.x - layout.rect.x, dy: frame.y - layout.rect.y });
    });
  }

  /** Per frame: follow the live positions. Allocates nothing. */
  update(live: LiveBoard): void {
    for (const [shelf, { image, dx, dy }] of this.shelves) {
      const { rect } = live.layout.shelves[shelf]!;
      image.setPosition(rect.x + dx, rect.y + dy).setAlpha(live.shelfAlpha[shelf]!);
    }
  }
}
