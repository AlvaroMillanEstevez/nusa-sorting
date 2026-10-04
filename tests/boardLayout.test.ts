import { describe, expect, it } from 'vitest';
import { beltPose, beltSlotAt, boundsAround, computeBoardLayout, frontSlotAt, GAP, isOnBelt, nearestFreeSlot, nearestSlot, shelfAt, type Rect } from '../src/ui/boardLayout';

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

describe('status row', () => {
  it('adds a second HUD row and keeps shelves below it', () => {
    const plain = computeBoardLayout(390, 844, 7);
    const withStatus = computeBoardLayout(390, 844, 7, 3, true);
    expect(plain.statusRow).toBeNull();
    expect(withStatus.statusRow).not.toBeNull();
    expect(withStatus.hud.height).toBe(withStatus.hudRowHeight + withStatus.statusRow!.height);
    expect(withStatus.statusRow!.y).toBe(withStatus.hudRowHeight);
    for (const { rect } of withStatus.shelves) expect(rect.y).toBeGreaterThanOrEqual(withStatus.hud.height);
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

  it('finds the front slot under a point from the layout, wherever its sprite is drawn', () => {
    const s = layout.slotSize;
    layout.shelves.forEach((sh, i) =>
      sh.slots.forEach((slot, j) => {
        expect(frontSlotAt(layout, slot.x, slot.y)).toEqual({ shelf: i, slot: j });
        // The cell is a slot wide and covers the whole shelf (a lifted item, the board below) and half the gap
        // above and below it.
        expect(frontSlotAt(layout, slot.x + s * 0.49, sh.rect.y - s * GAP * 0.45)).toEqual({ shelf: i, slot: j });
        expect(frontSlotAt(layout, slot.x - s * 0.49, sh.rect.y + sh.rect.height + s * GAP * 0.45)).toEqual({ shelf: i, slot: j });
      }),
    );
    // Beside the shelf, past the half-slot margin, there is no slot.
    expect(frontSlotAt(layout, shelf.rect.x - s * 0.3, shelf.slots[0]!.y)).toBeNull();
    expect(frontSlotAt(layout, -10, -10)).toBeNull();
  });

  it('gives each slot its own cell: neighbouring cells never overlap', () => {
    const s = layout.slotSize;
    // Points along a row and down a column land in exactly one slot each, the nearest one.
    for (let dx = -0.49; dx <= 0.49; dx += 0.07) {
      const hit = frontSlotAt(layout, shelf.slots[1]!.x + dx * s, shelf.slots[1]!.y);
      expect(hit).toEqual({ shelf: 0, slot: 1 });
    }
  });

  it('returns -1 outside every shelf', () => {
    expect(shelfAt(layout, -100, -100)).toBe(-1);
  });

  it('picks the free slot nearest to the pointer', () => {
    expect(nearestFreeSlot(shelf, [0, 2], shelf.slots[1]!.x + 1)).toBe(2);
    expect(nearestFreeSlot(shelf, [0, 2], shelf.slots[0]!.x)).toBe(0);
    expect(nearestFreeSlot(shelf, [], shelf.slots[0]!.x)).toBeUndefined();
  });
});

describe('conveyor strip', () => {
  describe.each(viewports)('on %s', (_name, width, height) => {
    const layout = computeBoardLayout(width, height, 7, 3, true, 8);
    const belt = layout.belt!;

    it('draws belt items exactly as big as shelf items', () => {
      expect(belt.pitch).toBe(layout.slotSize);
    });

    it('gets its own strip below every shelf, inside the viewport', () => {
      expect(belt.slots).toBe(8);
      for (const { rect } of layout.shelves) expect(rect.y + rect.height).toBeLessThanOrEqual(belt.rect.y);
      expect(belt.rect.x).toBeGreaterThanOrEqual(0);
      expect(belt.rect.x + belt.rect.width).toBeLessThanOrEqual(width);
      expect(belt.rect.y + belt.rect.height).toBeLessThanOrEqual(height);
      expect(belt.loopX + belt.slots * belt.pitch).toBeLessThanOrEqual(belt.rect.x + belt.rect.width);
    });
  });

  const layout = computeBoardLayout(390, 844, 7, 3, false, 8);
  const belt = layout.belt!;

  it('is absent without belt slots', () => {
    expect(computeBoardLayout(390, 844, 7).belt).toBeNull();
  });

  it('wraps around invisibly: items fade out at one end and in at the other', () => {
    const end = beltPose(belt, 8 - 1e-6);
    const start = beltPose(belt, 0);
    expect(end.alpha).toBeCloseTo(0);
    expect(start.alpha).toBe(0);
    expect(end.x).toBeCloseTo(belt.loopX + 8 * belt.pitch);
    expect(start.x).toBe(belt.loopX);
    expect(beltPose(belt, 4).alpha).toBe(1);
    // Position moves continuously with the offset.
    expect(beltPose(belt, 2.25).x - beltPose(belt, 2).x).toBeCloseTo(belt.pitch / 4);
  });

  it('picks the nearest item with a generous touch area, ignoring empty slots', () => {
    const offsets = [1, null, 3.5, null, null, null, null, null];
    const at = (offset: number) => beltPose(belt, offset).x;
    expect(beltSlotAt(belt, offsets, at(1), belt.y)).toBe(0);
    // Half a pitch above the strip and a bit off to the side still counts.
    expect(beltSlotAt(belt, offsets, at(3.5) + belt.pitch * 0.6, belt.rect.y - belt.pitch * 0.45)).toBe(2);
    // Over an empty slot, the nearest item within one pitch wins; nothing beyond that.
    expect(beltSlotAt(belt, offsets, at(1.8), belt.y)).toBe(0);
    expect(beltSlotAt(belt, offsets, at(6), belt.y)).toBeNull();
    expect(beltSlotAt(belt, offsets, at(1), belt.rect.y - belt.pitch)).toBeNull();
    expect(isOnBelt(belt, at(6), belt.y)).toBe(true);
  });
});

describe('boundsAround', () => {
  it('wraps rectangles plus a margin in whole pixels, or gives null for none', () => {
    expect(boundsAround([], 5)).toBeNull();
    expect(
      boundsAround(
        [
          { x: 10.5, y: 20, width: 30, height: 10 },
          { x: 50, y: 5.2, width: 10, height: 10 },
        ],
        2,
      ),
    ).toEqual({ x: 8, y: 3, width: 54, height: 29 });
  });
});
