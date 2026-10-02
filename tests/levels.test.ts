import { describe, expect, it } from 'vitest';
import { countItems, createGame, isWon, moveItem } from '../src/core';
import { levels } from '../src/data/levels';
import { solve } from './helpers';

describe.each(levels.map((level) => [level.id, level] as const))('level %s', (_id, level) => {
  it('is a valid level', () => {
    expect(() => createGame(level)).not.toThrow();
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

describe('solver sanity check', () => {
  it('reports an unsolvable level as unsolvable', () => {
    const stuck = createGame({ id: 'stuck', shelves: [[['A', 'A', 'B']], [['B', 'B', 'A']]] });
    expect(solve(stuck)).toBeUndefined();
  });
});
