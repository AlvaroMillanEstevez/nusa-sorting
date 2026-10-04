import type * as Phaser from 'phaser';
import type { ShelfLayout } from '../ui/boardLayout';
import { theme } from '../ui/theme';

/**
 * Draws one shelf: back board, slot guides and plank. `dx`/`dy` shift it (moving shelves draw at their own
 * origin and are then positioned as a whole).
 */
export function drawShelf(g: Phaser.GameObjects.Graphics, shelf: ShelfLayout, s: number, dx = 0, dy = 0): void {
  const { rect } = shelf;
  g.fillStyle(theme.shelfBack, 1);
  g.fillRoundedRect(rect.x + dx, rect.y + dy, rect.width, rect.height, s * 0.12);

  const guide = s * 0.9;
  g.fillStyle(theme.slotGuide, 1);
  for (const slot of shelf.slots) {
    g.fillRoundedRect(slot.x + dx - guide / 2, slot.y + dy - guide / 2, guide, guide, s * 0.1);
  }

  const plankTop = shelf.slots[0]!.y + s / 2;
  g.fillStyle(theme.shelfPlank, 1);
  g.fillRoundedRect(rect.x + dx, plankTop + dy, rect.width, rect.y + rect.height - plankTop, s * 0.05);
}
