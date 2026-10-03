import { describe, expect, it } from 'vitest';
import { clampScroll, computeLevelGrid, scrollToShow, tileAt } from '../src/ui/levelGrid';

const screens: [string, number, number][] = [
  ['phone portrait', 390, 844],
  ['small phone', 320, 568],
  ['phone landscape', 844, 390],
  ['desktop', 1280, 720],
];

describe.each(screens)('level grid on %s', (_name, width, height) => {
  it.each([9, 25, 100])('fits %i tiles across, big enough for a finger, never overlapping', (count) => {
    const grid = computeLevelGrid(width, height, count);
    expect(grid.tiles).toHaveLength(count);
    expect(grid.tileSize).toBeGreaterThanOrEqual(72);
    for (const t of grid.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(width);
    }
    for (let i = 1; i < count; i++) {
      const a = grid.tiles[i - 1]!;
      const b = grid.tiles[i]!;
      // Reading order: left to right, then the next row below.
      expect(b.y > a.y || (b.y === a.y && b.x > a.x + a.width)).toBe(true);
    }
  });

  it('scrolls only when the tiles do not fit, and can reach the last tile', () => {
    const many = computeLevelGrid(width, height, 100);
    expect(many.maxScroll).toBeGreaterThan(0);
    const last = many.tiles.at(-1)!;
    const scroll = scrollToShow(many, 99);
    const y = many.header.height + last.y - scroll + last.height / 2;
    expect(y).toBeLessThanOrEqual(height);
    expect(tileAt(many, last.x + last.width / 2, y, scroll)).toBe(99);
  });
});

describe('scrolling helpers', () => {
  const grid = computeLevelGrid(390, 844, 25);

  it('keeps scroll within bounds', () => {
    expect(clampScroll(grid, -50)).toBe(0);
    expect(clampScroll(grid, 1e6)).toBe(grid.maxScroll);
  });

  it('finds tiles under the pointer, but never under the header or in gaps', () => {
    const first = grid.tiles[0]!;
    const centre = (i: number) => [grid.tiles[i]!.x + grid.tiles[i]!.width / 2, grid.header.height + grid.tiles[i]!.y + grid.tiles[i]!.height / 2] as const;
    expect(tileAt(grid, ...centre(0), 0)).toBe(0);
    expect(tileAt(grid, ...centre(7), 0)).toBe(7);
    expect(tileAt(grid, first.x + first.width / 2, grid.header.height / 2, 0)).toBeNull();
    expect(tileAt(grid, first.x + first.width + 6, grid.header.height + first.y + 10, 0)).toBeNull();
  });

  it('fits nine levels on a phone without scrolling', () => {
    expect(computeLevelGrid(390, 844, 9).maxScroll).toBe(0);
  });
});
