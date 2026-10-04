import { describe, expect, it } from 'vitest';
import {
  createGame,
  firstMoves,
  isCarrierSource,
  LevelError,
  itemDepths,
  oneMoveTraps,
  startTriples,
  trapWithin,
  tripleDepthIssues,
  validateLevel,
  type LevelDefinition,
} from '../src/core';

/*
 * S0 [D . .] back [A B C]   S1 [A B .]   S2 [C A B]   S3 [C D D]
 * Moving D from S0 into S1 empties S0, its full back layer advances and no free slot is left.
 */
const trap: LevelDefinition = {
  id: 'trap',
  shelves: [
    [
      ['D', null, null],
      ['A', 'B', 'C'],
    ],
    [['A', 'B', null]],
    [['C', 'A', 'B']],
    [['C', 'D', 'D']],
  ],
};

describe('one-move traps', () => {
  it('finds a first move that loses on the spot, and rejects the level', () => {
    expect(() => createGame(trap)).not.toThrow();
    const traps = oneMoveTraps(createGame(trap));
    expect(traps).toContainEqual({ from: { shelf: 0, layer: 0, slot: 0 }, to: { shelf: 1, layer: 0, slot: 2 } });
    expect(() => validateLevel(trap)).toThrow(LevelError);
    expect(() => validateLevel(trap)).toThrow(/first move\(s\) lose at once, e\.g\. shelf 0 slot 0 to shelf 1 slot 2/);
  });

  it('accepts levels where every first move keeps the game going', () => {
    const safe: LevelDefinition = { id: 'safe', shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]] };
    expect(oneMoveTraps(createGame(safe))).toEqual([]);
    expect(() => validateLevel(safe)).not.toThrow();
  });

  it('also checks moves from the belt', () => {
    // Dropping the belt's C into the only free slot fills the board without a triple.
    const beltTrap: LevelDefinition = {
      id: 'belt-trap',
      shelves: [[['A', 'B', null]], [['C', 'C', 'A']]],
      mechanics: [{ kind: 'conveyor', slots: ['C', 'A', 'B', 'B'], speed: 1 }],
    };
    expect(oneMoveTraps(createGame(beltTrap)).some((move) => isCarrierSource(move.from))).toBe(true);
    expect(() => validateLevel(beltTrap)).toThrow(/track 0 carrier/);
  });

  it('only considers moves the player can make: no locked shelves', () => {
    const level: LevelDefinition = {
      id: 'locked',
      shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', 'C', 'C']], [['C', null, null]]],
      mechanics: [{ kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] }],
    };
    const moves = firstMoves(createGame(level));
    expect(moves.some((m) => !isCarrierSource(m.from) && m.from.shelf === 2)).toBe(false);
    expect(moves.some((m) => m.to.shelf === 2)).toBe(false);
  });
});

/*
 * S0 [. E B] back [D B C]   S1 [. E C]   S2 [D A E]   S3 [B C D]   S4 [. A A]
 * No single move loses, but E from S0 to S1 and then B from S0 to S4 empty S0: its back layer advances and
 * fills the board without a triple.
 */
const twoMoveTrap: LevelDefinition = {
  id: 'two-move-trap',
  shelves: [
    [
      [null, 'E', 'B'],
      ['D', 'B', 'C'],
    ],
    [[null, 'E', 'C']],
    [['D', 'A', 'E']],
    [['B', 'C', 'D']],
    [[null, 'A', 'A']],
  ],
};

describe('traps within a few moves', () => {
  it('finds a two-move sequence that loses, even when no single move does', () => {
    const state = createGame(twoMoveTrap);
    expect(oneMoveTraps(state)).toEqual([]);
    expect(trapWithin(state, 1)).toBeNull();
    const trap = trapWithin(state, 2);
    expect(trap).toHaveLength(2);
    expect(trap![0]!.from).toEqual({ shelf: 0, layer: 0, slot: 1 });
  });

  it('finds one-move traps too, and none on a roomy board', () => {
    expect(trapWithin(createGame(trap), 2)).toHaveLength(1);
    const roomy: LevelDefinition = { id: 'roomy', shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]], [[null, null, null]]] };
    expect(trapWithin(createGame(roomy), 2)).toBeNull();
  });
});

describe('how deep triples are buried', () => {
  // A: front, front, layer 2. B: front, layer 1, layer 2. C: three on the locked shelf's front (depth 1 each).
  const level: LevelDefinition = {
    id: 'depths',
    shelves: [
      [
        ['A', 'B', null],
        ['C', 'B', null],
        ['A', null, 'B'],
      ],
      [['A', null, null]],
      [['C', 'C', null]],
      [[null, null, null]],
    ],
    mechanics: [{ kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] }],
  };

  it('measures each item by layer, one deeper on a locked shelf, and by place in a track stack', () => {
    const depths = itemDepths(createGame(level));
    expect(depths.get('A')).toEqual([0, 0, 2]);
    expect(depths.get('B')).toEqual([0, 1, 2]);
    expect(depths.get('C')).toEqual([1, 1, 1]);
    const belt = itemDepths(createGame({ id: 'belt', shelves: [[['A', 'A', null]], [[null, null, null]]], mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.5, carriers: [['B', 'A'], ['B', 'B']] }] }] }));
    expect(belt.get('A')).toEqual([0, 0, 1]);
    expect(belt.get('B')).toEqual([0, 0, 1]);
  });

  it('reports triples whose last item is more than maxDepth layers deeper than their first', () => {
    const state = createGame(level);
    expect(tripleDepthIssues(state, 2)).toEqual([]);
    expect(tripleDepthIssues(state, 1)).toEqual([
      { type: 'A', triple: 0, spread: 2 },
      { type: 'B', triple: 0, spread: 2 },
    ]);
  });

  it('counts the triples that can be completed with what is in view and the layer behind it', () => {
    // A: 2 within reach (the third is two layers back); B: 2 in reach; C is on a locked shelf.
    expect(startTriples(createGame(level))).toBe(0);
    expect(startTriples(createGame(twoMoveTrap))).toBe(5);
  });
});
