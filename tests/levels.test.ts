import { describe, expect, it } from 'vitest';
import { countItems, createGame, isWon, tick, validateLevel, type GameState, type MechanicDefinition } from '../src/core';
import { BASE_LEVEL_COUNT, levels } from '../src/data/levels';
import { validateLevelLayout } from '../src/ui/levelLayout';
import { applyMove, greedyWinRate, simulate, solve } from './helpers';

describe.each(levels.map((level) => [level.id, level] as const))('level %s', (_id, level) => {
  it('is a valid, timed level with no first move that loses on the spot', () => {
    expect(() => validateLevel(level)).not.toThrow();
    // Items at least MIN_ITEM_PX on a phone in portrait and landscape.
    expect(() => validateLevelLayout(level)).not.toThrow();
    expect(level.timeLimitSeconds).toBeGreaterThan(0);
  });

  it('has 3-8 shelves, 4-5 item types and something hidden (a back layer or a stack)', () => {
    const state = createGame(level);
    const shelfTypes = level.shelves.flat(2).filter((t) => t !== null);
    const trackTypes = state.tracks.flatMap((t) => t.carriers.flatMap((c) => c.stack.map((i) => i.type)));
    const types = new Set([...shelfTypes, ...trackTypes]);
    expect(level.shelves.length).toBeGreaterThanOrEqual(3);
    expect(level.shelves.length).toBeLessThanOrEqual(8);
    expect(types.size).toBeGreaterThanOrEqual(4);
    expect(types.size).toBeLessThanOrEqual(5);
    const backLayer = level.shelves.some((layers) => layers.length > 1);
    const deepStack = state.tracks.some((t) => t.carriers.some((c) => c.stack.length > 1));
    expect(backLayer || deepStack).toBe(true);
  });

  it('is solvable even if the player never chains a combo', () => {
    const start = createGame(level);
    const solution = solve(start);
    expect(solution).toBeDefined();

    // Replay as the solver assumed: no clock, and every combo window runs out between moves.
    let state: GameState = { ...start, timeLeftMs: null };
    for (const move of solution!) {
      const result = applyMove(state, move);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = state.combo ? tick(result.state, state.combo.windowMs).state : result.state;
    }
    expect(isWon(state)).toBe(true);
    expect(countItems(state)).toBe(0);
  }, 60_000);
});

const kindsOf = (index: number) => (levels[index]!.mechanics ?? []).map((m: MechanicDefinition) => m.kind).sort();

describe('level progression', () => {
  it('has unique ids', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
  });

  it('starts with base levels, then one demo per mechanic, then both obstacles combined', () => {
    expect(levels).toHaveLength(BASE_LEVEL_COUNT + 9);
    for (let i = 0; i < BASE_LEVEL_COUNT; i++) expect(kindsOf(i)).toEqual([]);
    expect(kindsOf(3)).toEqual(['combo']);
    expect(kindsOf(4)).toEqual(['lockedShelves']);
    // The blocker is removed by reaching a combo, so it always comes with the combo mechanic.
    expect(kindsOf(5)).toEqual(['combo', 'roamingBlocker']);
    expect(kindsOf(6)).toEqual(['combo', 'lockedShelves', 'roamingBlocker']);
    expect(kindsOf(7)).toEqual(['conveyor']);
    expect(kindsOf(8)).toEqual(['conveyor', 'lockedShelves']);
    expect(kindsOf(9)).toEqual(['tracks']);
    expect(kindsOf(10)).toEqual(['tracks']);
    expect(kindsOf(11)).toEqual(['lockedShelves', 'tracks']);
  });

  it('gives levels 10-12 the requested column layouts', () => {
    const shape = (index: number) => {
      const level = levels[index]!;
      const state = createGame(level);
      return level.layout!.columns.map((c) => {
        if (c.kind === 'shelves') return 'shelves';
        return state.tracks[c.track]!.speed < 0 ? 'track up' : 'track down';
      });
    };
    expect(shape(9)).toEqual(['shelves', 'track down', 'shelves']);
    expect(shape(10)).toEqual(['track up', 'shelves', 'track down']);
    expect(shape(11)[0]).toMatch(/^track/);
    // Level 12: stacks three deep on its track.
    const deepest = Math.max(...createGame(levels[11]!).tracks.flatMap((t) => t.carriers.map((c) => c.stack.length)));
    expect(deepest).toBe(3);
  });

  it('runs the second conveyor faster than the first', () => {
    const speedOf = (index: number) => {
      const belt = levels[index]!.mechanics!.find((m) => m.kind === 'conveyor');
      return belt?.kind === 'conveyor' ? Math.abs(belt.speed) : 0;
    };
    expect(speedOf(8)).toBeGreaterThan(speedOf(7));
  });

  it('base levels get harder: a simulated player wins less often on each one', () => {
    const rates = levels.slice(0, BASE_LEVEL_COUNT).map((level) => greedyWinRate(createGame(level)));
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThan(rates[i - 1]!);
    // The hardest level must still be beatable by the simulated player sometimes.
    expect(rates.at(-1)).toBeGreaterThan(0.2);
  }, 30_000);

  it('obstacles make running out of space a real way to lose', () => {
    const blocked = levels.map((level) => simulate(createGame(level)).blockedRate);
    const baseWorst = Math.max(...blocked.slice(0, BASE_LEVEL_COUNT));
    // Locked shelves, the roaming blocker and the tight conveyor level each cause more blocked defeats
    // than any base level.
    for (const index of [4, 5, 6, 8]) expect(blocked[index]).toBeGreaterThan(baseWorst);
  }, 60_000);
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
