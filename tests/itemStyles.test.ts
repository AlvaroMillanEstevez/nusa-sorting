import { describe, expect, it } from 'vitest';
import { levels } from '../src/data/levels';
import { ITEM_STYLES } from '../src/ui/itemStyles';

describe('item styles', () => {
  it('gives every item type used in levels its own style', () => {
    const types = new Set(levels.flatMap((level) => level.shelves.flat(2)).filter((t) => t !== null));
    for (const type of types) expect(ITEM_STYLES[type]).toBeDefined();
  });

  it('makes every type differ in both color and shape', () => {
    const styles = Object.values(ITEM_STYLES);
    expect(new Set(styles.map((s) => s.color)).size).toBe(styles.length);
    expect(new Set(styles.map((s) => s.shape)).size).toBe(styles.length);
  });
});
