import { describe, expect, it } from 'vitest';
import { arrangementCount, withArrangement } from '../src/core';
import { levels } from '../src/data/levels';
import { levelStats, ruleFailures } from '../tools/levelgen/generate';
import { recipeFor } from '../tools/levelgen/recipes';
import { expectInBands } from './helpers';

/** Fewest arrangements a level may ship with: reshuffles outside the band are discarded, so some have fewer than 8. */
const MIN_ARRANGEMENTS = 4;

describe.each(levels.map((level, i) => [i + 1, level] as const))('level %i arrangements', (number, level) => {
  const recipe = recipeFor(number);

  it('has several, all different', () => {
    expect(arrangementCount(level)).toBeGreaterThanOrEqual(MIN_ARRANGEMENTS);
    const all = Array.from({ length: arrangementCount(level) }, (_, i) => JSON.stringify(withArrangement(level, i)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('each meets every rule and lands in the bands with the level’s time', () => {
    for (let i = 1; i < arrangementCount(level); i++) {
      const arranged = withArrangement(level, i);
      expect(ruleFailures(arranged, recipe), `arrangement ${i}`).toEqual([]);
      expectInBands(levelStats(arranged), recipe, `arrangement ${i}`);
    }
  }, 1_200_000);
});
