import { describe, expect, it } from 'vitest';
import { areConfusable, ITEM_KINDS, parseItemType, STARTER_KINDS } from '../src/data/itemCatalog';
import { KIND_ORDER, levelTypes, TYPES_WITHOUT_LOOK_ALIKES, TYPES_WITHOUT_VARIANTS } from '../tools/levelgen/types';

describe('the order levels take item types in', () => {
  it('starts with the starter set and covers the whole catalogue once', () => {
    expect(KIND_ORDER.slice(0, STARTER_KINDS.length)).toEqual(STARTER_KINDS);
    expect([...KIND_ORDER].sort()).toEqual(ITEM_KINDS.map((k) => k.id).sort());
    expect(TYPES_WITHOUT_VARIANTS).toBe(26);
  });

  it('keeps look-alikes apart for as long as it can', () => {
    const early = levelTypes(TYPES_WITHOUT_LOOK_ALIKES);
    for (const a of early) for (const b of early) expect(areConfusable(a, b), `${a} ${b}`).toBe(false);
    // Each confusable group has one kind left over for the end.
    expect(TYPES_WITHOUT_LOOK_ALIKES).toBe(23);
  });

  it('uses colour variants only once every kind is in', () => {
    expect(levelTypes(26).every((t) => parseItemType(t)?.variant === 'original')).toBe(true);
    expect(levelTypes(27).at(-1)).toBe(`${KIND_ORDER[0]}:alt1`);
    expect(levelTypes(53).at(-1)).toBe(`${KIND_ORDER[0]}:alt2`);
    expect(new Set(levelTypes(78)).size).toBe(78);
    expect(() => levelTypes(79)).toThrow();
  });
});
