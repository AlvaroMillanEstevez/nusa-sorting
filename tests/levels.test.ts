import { describe, expect, it } from 'vitest';
import { countItems, createGame, isWon, moveItem } from '../src/core';
import { levels } from '../src/data/levels';
import { greedyWinRate, solve } from './helpers';

describe.each(levels.map((level) => [level.id, level] as const))('level %s', (_id, level) => {
  it('is a valid, timed level', () => {
    expect(() => createGame(level)).not.toThrow();
    expect(level.timeLimitSeconds).toBeGreaterThan(0);
  });

  it('has 6-8 shelves, 4-5 item types and at least one back layer', () => {
    const types = new Set(level.shelves.flat(2).filter((t) => t !== null));
    expect(level.shelves.length).toBeGreaterThanOrEqual(6);
    expect(level.shelves.length).toBeLessThanOrEqual(8);
    expect(types.size).toBeGreaterThanOrEqual(4);
    expect(types.size).toBeLessThanOrEqual(5);
    expect(level.shelves.some((layers) => layers.length > 1)).toBe(true);
  });

  it('is solvable', () => {
    const start = createGame(level);
    const solution = solve(start);
    expect(solution).toBeDefined();

    let state = start;
    for (const [from, to] of solution!) {
      const result = moveItem(state, from, to);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(isWon(state)).toBe(true);
    expect(countItems(state)).toBe(0);
  });
});

describe('level progression', () => {
  it('has three levels with unique ids', () => {
    expect(levels).toHaveLength(3);
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
  });

  it('gets harder: a simulated player wins less often on each level', () => {
    const rates = levels.map((level) => greedyWinRate(createGame(level)));
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThan(rates[i - 1]!);
    // The hardest level must still be beatable by the simulated player sometimes.
    expect(rates.at(-1)).toBeGreaterThan(0.2);
  }, 30_000);
});

describe('solver sanity check', () => {
  it('reports an unsolvable level as unsolvable', () => {
    // Two of each type are in front and the third is behind S1. Emptying S1 uses every free slot,
    // and its back layer then fills the board without a triple.
    const doomed = createGame({
      id: 'doomed',
      shelves: [
        [['C', null, 'B']],
        [
          ['B', 'A', 'C'],
          ['A', 'B', 'C'],
        ],
        [[null, null, 'A']],
      ],
    });
    expect(solve(doomed)).toBeUndefined();
  });
});
