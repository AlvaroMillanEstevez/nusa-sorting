import { describe, expect, it } from 'vitest';
import { arrangementCount, createGame, LevelError, nextArrangement, withArrangement, type LevelDefinition } from '../src/core';

const level: LevelDefinition = {
  id: 'arr',
  timeLimitSeconds: 60,
  shelves: [
    [['a', 'b', null], ['c', 'a', 'b']],
    [['c', null, 'a']],
    [[null, null, null]],
  ],
  mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.5, carriers: [['b', 'c'], []] }] }],
  arrangements: [
    {
      shelves: [
        [['b', 'c', null], ['a', 'a', 'c']],
        [['b', null, 'a']],
        [[null, null, null]],
      ],
      stacks: [[['c', 'b'], []]],
    },
  ],
};

describe('arrangements', () => {
  it('counts the level as written plus its other arrangements', () => {
    expect(arrangementCount(level)).toBe(2);
    expect(arrangementCount({ ...level, arrangements: [] })).toBe(1);
  });

  it('starts at 0 and then takes a different one each attempt, going round', () => {
    expect(nextArrangement(4, undefined)).toBe(0);
    expect(nextArrangement(4, 0)).toBe(1);
    expect(nextArrangement(4, 3)).toBe(0);
    expect(nextArrangement(1, 0)).toBe(0);
    // A remembered number the level no longer has (fewer arrangements now) starts over.
    expect(nextArrangement(4, 7)).toBe(0);
  });

  it('puts the items of an arrangement in place and keeps everything else', () => {
    const { arrangements: _, ...written } = level;
    expect(withArrangement(level, 0)).toEqual(written);
    const second = withArrangement(level, 1);
    expect(second.shelves).toEqual(level.arrangements![0]!.shelves);
    expect(second.mechanics).toEqual([{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.5, carriers: [['c', 'b'], []] }] }]);
    expect(second.timeLimitSeconds).toBe(60);
    expect(second.arrangements).toBeUndefined();
    expect(() => createGame(second)).not.toThrow();
  });

  it('rejects arrangements that change more than where the items are', () => {
    const bad = (arrangement: NonNullable<LevelDefinition['arrangements']>[number]) => () =>
      withArrangement({ ...level, arrangements: [arrangement] }, 1);
    const shelves = level.arrangements![0]!.shelves;
    const stacks = level.arrangements![0]!.stacks!;
    expect(() => withArrangement(level, 2)).toThrow(LevelError);
    expect(bad({ shelves: shelves.slice(0, 2), stacks })).toThrow(/number of shelves/);
    expect(bad({ shelves: [[['b', 'c', 'a'], ['a', 'a', 'c'], ['b', 'c', 'b']], shelves[1]!, shelves[2]!], stacks })).toThrow(/layers/);
    expect(bad({ shelves, stacks: [[['c'], ['b']]] })).not.toThrow();
    expect(bad({ shelves, stacks: [[['c', 'b']]] })).toThrow(/one stack per carrier/);
    expect(bad({ shelves, stacks: [[['c', 'c'], []]] })).toThrow(/different items/);
    expect(bad({ shelves })).toThrow(/one entry per track/);
  });
});
