import { describe, expect, it } from 'vitest';
import { createGame, withArrangement } from '../src/core';
import { ARRANGEMENTS, arrangementOf, buildCandidate, generateArrangements, generateLevel, rearrange, ruleFailures } from '../tools/levelgen/generate';
import { constName, levelSource } from '../tools/levelgen/format';
import type { LevelRecipe } from '../tools/levelgen/recipe';
import { RECIPES, recipeFor } from '../tools/levelgen/recipes';
import { levels } from '../src/data/levels';

/** A small recipe that generates in a moment, for testing the generator itself. */
const small: LevelRecipe = {
  number: 1,
  id: 'nusa-001',
  purpose: 'Test recipe.',
  seed: 7,
  layout: 'grid',
  shelves: 4,
  types: 3,
  backLayers: { shelves: 0, layers: [1, 1] },
  emptyFront: 3,
  maxDepth: 0,
  minStartTriples: 1,
  winBand: [0, 1],
  time: { slack: 1.5, timeUp: [0, 1] },
};
import { rng } from '../tools/simulator';

describe('level generator', () => {
  it('builds the same board from the same seed, and another from another seed', () => {
    const recipe = recipeFor(3);
    expect(buildCandidate(recipe, rng(42))).toEqual(buildCandidate(recipe, rng(42)));
    expect(buildCandidate(recipe, rng(42))).not.toEqual(buildCandidate(recipe, rng(43)));
  });

  it('makes every kind a whole number of triples, with the recipe shape', () => {
    const recipe = recipeFor(9);
    for (let seed = 1; seed <= 20; seed++) {
      const board = buildCandidate(recipe, rng(seed));
      if (!board) continue;
      const counts = new Map<string, number>();
      const all = [
        ...board.shelves.flat(2),
        ...(board.mechanics ?? []).flatMap((m) => (m.kind === 'tracks' ? m.tracks.flatMap((t) => t.carriers.flat()) : [])),
      ];
      for (const item of all) if (typeof item === 'string') counts.set(item, (counts.get(item) ?? 0) + 1);
      for (const count of counts.values()) expect(count % 3).toBe(0);
      expect(board.shelves).toHaveLength(6);
      expect(board.layout?.columns.map((c) => c.kind)).toEqual(['shelves', 'track', 'shelves']);
    }
  });

  it('regenerates a level identically from its recipe, and differently with another seed', () => {
    const recipe = small;
    const first = generateLevel(recipe);
    expect(generateLevel(recipe).level).toEqual(first.level);
    expect(ruleFailures(first.level, recipe)).toEqual([]);
    const other = generateLevel(recipe, recipe.seed + 1);
    expect(other.level).not.toEqual(first.level);
    expect(() => createGame(other.level)).not.toThrow();
  });

  it('rearranges only where items are: occupied places, stacks and blocker start stay', () => {
    const level = generateLevel(recipeFor(9)).level;
    const other = rearrange(level, rng(5));
    const shape = (l: typeof level) => JSON.stringify(l, (_k, v: unknown) => (typeof v === 'string' && v !== 'nusa-009' && v !== 'vertical' && v !== 'lockedShelves' && v !== 'tracks' && v !== 'shelves' && v !== 'track' ? 'x' : v));
    expect(shape(other)).toBe(shape(level));
    expect(other.shelves).not.toEqual(level.shelves);
    expect(withArrangement({ ...level, arrangements: [arrangementOf(other)] }, 1)).toEqual(other);
  });

  it('makes arrangements that meet the rules and the band, the same each time', () => {
    const base = recipeFor(9);
    const recipe: LevelRecipe = { ...base, winBand: [0.3, 1], time: { ...base.time, timeUp: [0, 1] } };
    const level = generateLevel(base).level;
    const found = generateArrangements(level, recipe, 1);
    expect(found).toHaveLength(ARRANGEMENTS - 1);
    expect(generateArrangements(level, recipe, 1)).toEqual(found);
    const keys = new Set([level, ...found.map((f) => withArrangement({ ...level, arrangements: [f.arrangement] }, 1))].map((l) => JSON.stringify(l.shelves)));
    expect(keys.size).toBe(ARRANGEMENTS);
    for (const { arrangement, stats } of found) {
      expect(ruleFailures(withArrangement({ ...level, arrangements: [arrangement] }, 1), recipe)).toEqual([]);
      expect(stats.winRate).toBeGreaterThanOrEqual(0.3);
    }
  }, 120_000);

  it('writes a reviewable level file', () => {
    const generated = { ...generateLevel(small), arrangements: [] };
    const source = levelSource(generated);
    expect(source).toContain("export const nusa001: LevelDefinition = {");
    expect(source).toContain("id: 'nusa-001',");
    expect(source).toContain(`seed ${generated.seed}`);
    expect(source).toContain('npm run levelgen -- 1');
    expect(constName('nusa-010')).toBe('nusa010');
  });

  it('has one recipe per level, in order, with unique ids and seeds', () => {
    expect(RECIPES.map((r) => r.number)).toEqual(levels.map((_, i) => i + 1));
    expect(RECIPES.map((r) => r.id)).toEqual(RECIPES.map((r) => `nusa-${String(r.number).padStart(3, '0')}`));
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(RECIPES.map((r) => r.seed)).size).toBe(RECIPES.length);
  });
});
