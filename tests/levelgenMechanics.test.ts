import { describe, expect, it } from 'vitest';
import { createGame, itemDepths } from '../src/core';
import { buildCandidate, ruleFailures } from '../tools/levelgen/generate';
import type { LevelRecipe } from '../tools/levelgen/recipe';
import { rng } from '../tools/simulator';

/** Shelves | a column of fixed stacks | shelves, two of the shelves closing once emptied. */
const recipe: LevelRecipe = {
  number: 26,
  id: 'nusa-026',
  purpose: 'Test recipe for the new mechanics.',
  seed: 26,
  layout: [
    { kind: 'shelves', count: 3 },
    { kind: 'track', speed: 0, carriers: 4 },
    { kind: 'shelves', count: 3 },
  ],
  types: 8,
  backLayers: { shelves: 2, layers: [2, 2] },
  emptyFront: 6,
  fixedStacks: { depth: [2, 4], empty: 0 },
  closing: 2,
  maxDepth: 4,
  minStartTriples: 1,
  winBand: [0, 1],
  time: { slack: 1.5, timeUp: [0, 1] },
};

describe('the level generator with fixed stacks and closing shelves', () => {
  it('builds boards with a column of fixed stacks as deep as asked, and fixed shelves that close', () => {
    let built = 0;
    for (let seed = 1; seed <= 40 && built < 5; seed++) {
      const level = buildCandidate(recipe, rng(seed));
      if (!level) continue;
      built++;
      const state = createGame(level);
      const fixed = state.tracks.find((track) => track.speed === 0)!;
      expect(fixed.carriers).toHaveLength(4);
      for (const carrier of fixed.carriers) expect(carrier.kind === 'stack' && carrier.stack.length >= 2 && carrier.stack.length <= 4).toBe(true);
      expect(state.closesWhenEmpty.filter(Boolean)).toHaveLength(2);
      // Depths count the fixed stacks like any track's.
      expect([...itemDepths(state).values()].flat().some((depth) => depth >= 2)).toBe(true);
    }
    expect(built).toBe(5);
  });

  it('judges such boards with every rule (traps within two moves, depth, a solution)', () => {
    let judged = 0;
    for (let seed = 1; seed <= 40 && judged < 3; seed++) {
      const level = buildCandidate(recipe, rng(seed));
      if (!level) continue;
      judged++;
      expect(Array.isArray(ruleFailures(level, recipe))).toBe(true);
    }
    expect(judged).toBe(3);
  }, 120_000);
});
