import { describe, expect, it } from 'vitest';
import { arrangementCount, withArrangement } from '../src/core';
import { levels } from '../src/data/levels';
import { levelStats, ruleFailures, starThresholds } from '../tools/levelgen/generate';
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

  it('each meets every rule and lands in the bands with the level’s time; the stars come from them all', () => {
    const expertWins = [levelStats(withArrangement(level, 0)).expert.wonScores];
    for (let i = 1; i < arrangementCount(level); i++) {
      const arranged = withArrangement(level, i);
      expect(ruleFailures(arranged, recipe), `arrangement ${i}`).toEqual([]);
      const stats = levelStats(arranged);
      expectInBands(stats, recipe, `arrangement ${i}`);
      expertWins.push(stats.expert.wonScores);
    }
    // Two stars at the expert's median win, three at its 85th percentile, over every arrangement.
    expect(level.stars).toEqual(starThresholds(expertWins));
  }, 1_200_000);
});
