import { describe, expect, it } from 'vitest';
import { computeBoardLayout, nearestFreeSlot, nearestSlot, shelfAt, type Rect } from '../src/ui/boardLayout';

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const viewports: [string, number, number][] = [
  ['phone portrait', 390, 844],
  ['phone landscape', 844, 390],
  ['desktop', 1440, 900],
  ['tiny', 320, 480],
];

describe.each(viewports)('computeBoardLayout on %s', (_name, width, height) => {
  const layout = computeBoardLayout(width, height, 7);

  it('keeps every shelf inside the viewport and below the HUD', () => {
    for (const { rect } of layout.shelves) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(layout.hud.height);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    }
  });

  it('never overlaps shelves', () => {
    layout.shelves.forEach((a, i) =>
      layout.shelves.forEach((b, j) => {
        if (i < j) expect(overlaps(a.rect, b.rect)).toBe(false);
      }),
    );
  });

  it('finds each shelf at its slot centers', () => {
    layout.shelves.forEach((shelf, i) => {
      shelf.slots.forEach((slot, j) => {
        expect(shelfAt(layout, slot.x, slot.y)).toBe(i);
        expect(nearestSlot(shelf, slot.x)).toBe(j);
      });
    });
  });
});

describe('layout orientation', () => {
  it('uses more columns in landscape than in portrait', () => {
    const cols = (w: number, h: number) =>
      new Set(computeBoardLayout(w, h, 7).shelves.map((s) => Math.round(s.rect.x))).size;
    expect(cols(844, 390)).toBeGreaterThan(cols(390, 844));
  });
});

describe('hit testing helpers', () => {
  const layout = computeBoardLayout(800, 600, 7);
  const shelf = layout.shelves[0]!;

  it('returns -1 outside every shelf', () => {
    expect(shelfAt(layout, -100, -100)).toBe(-1);
  });

  it('picks the free slot nearest to the pointer', () => {
    expect(nearestFreeSlot(shelf, [0, 2], shelf.slots[1]!.x + 1)).toBe(2);
    expect(nearestFreeSlot(shelf, [0, 2], shelf.slots[0]!.x)).toBe(0);
    expect(nearestFreeSlot(shelf, [], shelf.slots[0]!.x)).toBeUndefined();
  });
});
