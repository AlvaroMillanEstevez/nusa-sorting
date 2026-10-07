import { afterEach, describe, expect, it } from 'vitest';
import { ITEM_KINDS } from '../src/data/itemCatalog';
import { createGame } from '../src/core';
import { levels } from '../src/data/levels';
import { setSlotAspect, shelfHeightUnits, shelfLayoutAt, slotAspect } from '../src/ui/boardLayout';
import { BASELINE, ITEM_BOUNDS, itemFit, placeItem } from '../src/ui/itemFit';
import { itemSize, layoutForLevel, MIN_ITEM_PX } from '../src/ui/levelLayout';

afterEach(() => setSlotAspect(1));

describe('slot aspect', () => {
  it('is square by default, so the game looks exactly as before', () => {
    expect(slotAspect()).toBe(1);
    const shelf = shelfLayoutAt(0, 0, 100);
    expect(shelf.slotHeight).toBe(100);
    expect(shelf.slots[0]!.y).toBeCloseTo(58);
    expect(itemFit('es-teh-manis', 1)).toEqual({ scale: 1, drop: 0 });
    expect(placeItem(58, 100, 0.95, itemFit('sate', 1))).toEqual({ y: 58, size: 95 });
  });

  it('makes shelves taller and stands square items on the base', () => {
    setSlotAspect(1.2);
    expect(shelfHeightUnits()).toBeCloseTo(1.46);
    const shelf = shelfLayoutAt(0, 0, 100);
    expect(shelf.slotHeight).toBeCloseTo(120);
    // The base (top of the front board) is at y = 8 + 120; a square item stands on it.
    expect(shelf.slots[0]!.y + 50).toBeCloseTo(128);
  });

  it('keeps the value between 1 and 1.6', () => {
    setSlotAspect(0.5);
    expect(slotAspect()).toBe(1);
    setSlotAspect(3);
    expect(slotAspect()).toBe(1.6);
  });
});

describe('items in tall slots', () => {
  it('knows where every icon of the catalogue is drawn', () => {
    for (const kind of ITEM_KINDS) expect(ITEM_BOUNDS[kind.id], kind.id).toBeDefined();
  });

  it('grows only items tall by nature, uniformly, never wider than the slot nor above its height', () => {
    for (const kind of ITEM_KINDS) {
      const fit = itemFit(kind.id, 1.2);
      const [left, top, right, bottom] = ITEM_BOUNDS[kind.id]!;
      expect(fit.scale, kind.id).toBeGreaterThanOrEqual(1);
      expect(fit.scale, kind.id).toBeLessThanOrEqual(1.2);
      expect(((right - left) / 100) * fit.scale, kind.id).toBeLessThanOrEqual(1);
      expect(((bottom - top) / 100) * fit.scale, kind.id).toBeLessThanOrEqual(1.2);
    }
    expect(itemFit('es-teh-manis', 1.2).scale).toBeGreaterThan(1);
    expect(itemFit('sate', 1.2).scale).toBe(1);
  });

  it('rests every item on the same base line, the floating ones too', () => {
    const s = 100;
    const foot = (kind: string) => {
      const at = placeItem(0, s, 1, itemFit(kind, 1.2));
      return at.y - at.size / 2 + (ITEM_BOUNDS[kind]![3] / 100) * at.size;
    };
    // Square slots: the peci cap floats well above the bowl of bakso; in tall slots their feet line up.
    expect(Math.abs(ITEM_BOUNDS.peci![3] - ITEM_BOUNDS.bakso![3])).toBeGreaterThan(10);
    const line = foot('bakso');
    for (const kind of ['peci', 'kendang', 'sate', 'rambutan']) expect(foot(kind), kind).toBeCloseTo(line, 5);
    // A tall item that grew stands within a few px of the same line (the base line is a share of its size).
    expect(Math.abs(foot('es-teh-manis') - line)).toBeLessThan(2);
    expect(line).toBeCloseTo(s / 2 - (1 - BASELINE / 100) * s, 5);
  });

  it('keeps items big enough on phones in every three-column level with slots 1.2 tall', () => {
    setSlotAspect(1.2);
    for (const level of levels.filter((l) => (l.layout?.columns.length ?? 0) === 3)) {
      for (const [w, h] of [
        [390, 844],
        [844, 390],
      ] as const) {
        expect(itemSize(layoutForLevel(level, createGame(level), w, h)), `${level.id} ${w}x${h}`).toBeGreaterThanOrEqual(MIN_ITEM_PX);
      }
    }
  });
});
