import { describe, expect, it } from 'vitest';
import {
  createGame,
  firstMoves,
  isCarrierSource,
  LevelError,
  oneMoveTraps,
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
