import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core';
import { levels } from '../src/data/levels';
import type { Rect } from '../src/ui/boardLayout';
import { isWide, itemSize, layoutForLevel, MIN_ITEM_PX } from '../src/ui/levelLayout';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Desktop windows as CrazyGames shows them (in world units: bigger windows are drawn at a larger interface
 * scale, so they lay out as 960×540), and the shortest of them.
 */
const WIDE_SCREENS = [
  [960, 540],
  [907, 510],
  [821, 462],
] as const;

describe('the wide layout (desktop windows)', () => {
  it('is used on desktop windows, not on phones in either orientation', () => {
    for (const [w, h] of WIDE_SCREENS) expect(isWide(w, h), `${w}x${h}`).toBe(true);
    expect(isWide(390, 844)).toBe(false);
    expect(isWide(844, 390)).toBe(false);
  });

  it.each(WIDE_SCREENS)('at %ix%i every level fits: HUD and boosters beside the board, nothing off screen, items big enough', (w, h) => {
    for (const [i, level] of levels.entries()) {
      const layout = layoutForLevel(level, createGame(level), w, h);
      const side = layout.side!;
      expect(side, `level ${i + 1}`).toBeDefined();
      const board = [...layout.shelves.map((s) => s.rect), ...layout.tracks.map((t) => t.rect)];
      for (const rect of board) {
        expect(overlaps(rect, side.hud), `level ${i + 1}: HUD over the board`).toBe(false);
        expect(overlaps(rect, side.boosters), `level ${i + 1}: boosters over the board`).toBe(false);
        expect(rect.y, `level ${i + 1}: under the awning`).toBeGreaterThanOrEqual(layout.hud.height);
        expect(rect.x + rect.width, `level ${i + 1}`).toBeLessThanOrEqual(w);
        expect(rect.y + rect.height, `level ${i + 1}`).toBeLessThanOrEqual(h);
      }
      for (const rect of [side.hud, side.boosters]) {
        expect(rect.x, `level ${i + 1}`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, `level ${i + 1}`).toBeLessThanOrEqual(w);
        expect(rect.y + rect.height, `level ${i + 1}`).toBeLessThanOrEqual(h);
      }
      expect(itemSize(layout), `level ${i + 1}`).toBeGreaterThanOrEqual(MIN_ITEM_PX);
    }
  });
});
