import { describe, expect, it } from 'vitest';
import {
  countItems,
  createGame,
  findItem,
  isWon,
  itemAt,
  LevelError,
  moveItem,
  type GameEvent,
  type GameState,
  type LevelDefinition,
  type Position,
} from '../src/core';
import { front, itemIds, rng, validMoves } from './helpers';

/**
 * S0: front [A A B], back [B C C]
 * S1: front [B A .]
 * S2: front [C . .]
 */
const testLevel: LevelDefinition = {
  id: 'test',
  shelves: [
    [
      ['A', 'A', 'B'],
      ['B', 'C', 'C'],
    ],
    [['B', 'A', null]],
    [['C', null, null]],
  ],
};

function apply(state: GameState, from: Position, to: Position) {
  const result = moveItem(state, from, to);
  if (!result.ok) throw new Error(`unexpected invalid move: ${result.reason}`);
  return result;
}

describe('createGame', () => {
  it('assigns unique ids to every item', () => {
    const state = createGame(testLevel);
    const ids = itemIds(state);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
  });

  it('rejects malformed levels', () => {
    expect(() => createGame({ id: 'x', shelves: [] })).toThrow(LevelError);
    expect(() => createGame({ id: 'x', shelves: [[['A', 'A']]] })).toThrow(LevelError);
    expect(() => createGame({ id: 'x', shelves: [[['A', 'A', null]]] })).toThrow(/multiple of 3/);
    expect(() => createGame({ id: 'x', shelves: [[['A', 'A', 'A']]] })).toThrow(/complete triple/);
    expect(() =>
      createGame({
        id: 'x',
        shelves: [
          [
            [null, null, null],
            ['A', 'A', 'A'],
          ],
        ],
      }),
    ).toThrow(/empty front layer/);
  });
});

describe('findItem', () => {
  it('locates items in front and back layers, and returns null when gone', () => {
    const state = createGame(testLevel);
    const back = itemAt(state, { shelf: 0, layer: 1, slot: 2 })!;
    expect(findItem(state, back.id)).toEqual({ shelf: 0, layer: 1, slot: 2 });
    expect(findItem(state, 999)).toBeNull();
  });
});

describe('moveItem: invalid moves leave the state untouched', () => {
  const cases: [string, Position, Position, string][] = [
    ['target slot occupied', front(1, 0), front(2, 0), 'targetOccupied'],
    ['same position', front(1, 0), front(1, 0), 'samePosition'],
    ['same shelf', front(1, 0), front(1, 2), 'sameShelf'],
    ['source in back layer', { shelf: 0, layer: 1, slot: 0 }, front(2, 1), 'notFrontLayer'],
    ['target in back layer', front(1, 0), { shelf: 0, layer: 1, slot: 0 }, 'notFrontLayer'],
    ['target shelf full', front(1, 0), front(0, 0), 'shelfFull'],
    ['empty source', front(1, 2), front(2, 1), 'sourceEmpty'],
    ['shelf out of range', front(9, 0), front(2, 1), 'invalidPosition'],
    ['slot out of range', front(1, 0), front(2, 3), 'invalidPosition'],
  ];

  it.each(cases)('%s', (_name, from, to, reason) => {
    const state = createGame(testLevel);
    const snapshot = structuredClone(state);
    const result = moveItem(state, from, to);
    expect(result).toEqual({ ok: false, reason });
    expect(state).toEqual(snapshot);
  });

  it('rejects moves once the game is won', () => {
    const won = createGame({ id: 'empty', shelves: [[[null, null, null]], [[null, null, null]]] });
    expect(moveItem(won, front(0, 0), front(1, 0))).toEqual({ ok: false, reason: 'gameOver' });
  });
});

describe('moveItem: valid moves', () => {
  it('moves the item without mutating the previous state', () => {
    const state = createGame(testLevel);
    const snapshot = structuredClone(state);
    const moved = itemAt(state, front(1, 0))!;
    const result = apply(state, front(1, 0), front(2, 1));
    expect(state).toEqual(snapshot);
    expect(itemAt(result.state, front(1, 0))).toBeNull();
    expect(itemAt(result.state, front(2, 1))).toEqual(moved);
    expect(result.events).toEqual([{ kind: 'moved', itemId: moved.id, from: front(1, 0), to: front(2, 1) }]);
  });

  it('solves the test level with a known sequence', () => {
    let state = createGame(testLevel);
    const events: GameEvent[] = [];
    const steps: [Position, Position][] = [
      [front(0, 2), front(1, 2)], // S0 [A A .], S1 [B A B]
      [front(1, 1), front(0, 2)], // S0 [A A A] clears, back [B C C] advances; S1 [B . B]
      [front(0, 0), front(1, 1)], // S1 [B B B] clears; S0 [. C C]
      [front(2, 0), front(0, 0)], // S0 [C C C] clears; board empty
    ];
    for (const [from, to] of steps) {
      expect(isWon(state)).toBe(false);
      const result = apply(state, from, to);
      state = result.state;
      events.push(...result.events);
    }
    expect(isWon(state)).toBe(true);
    expect(countItems(state)).toBe(0);
    expect(events.map((e) => e.kind)).toEqual([
      'moved',
      'moved',
      'tripleCleared',
      'layerAdvanced',
      'moved',
      'tripleCleared',
      'moved',
      'tripleCleared',
      'won',
    ]);
    expect(events.filter((e) => e.kind === 'won')).toHaveLength(1);
  });

  it('cascades: an advanced layer that is already a triple clears too', () => {
    const state = createGame({
      id: 'cascade',
      shelves: [
        [
          ['A', null, null],
          ['B', 'B', 'B'],
          ['C', 'C', 'C'],
        ],
        [['A', 'A', null]],
      ],
    });
    const result = apply(state, front(0, 0), front(1, 2));
    expect(result.events.map((e) => e.kind)).toEqual([
      'moved',
      'tripleCleared',
      'layerAdvanced',
      'tripleCleared',
      'layerAdvanced',
      'tripleCleared',
      'won',
    ]);
    expect(result.state.shelves[0]!.layers).toHaveLength(1);
    expect(countItems(result.state)).toBe(0);
  });
});

describe('invariants under random play', () => {
  it('item count only drops in steps of 3 and items are never duplicated', () => {
    const level: LevelDefinition = {
      id: 'random',
      shelves: [
        [
          ['A', 'B', 'C'],
          ['D', 'A', 'B'],
        ],
        [
          ['C', 'D', null],
          ['A', 'B', 'C'],
        ],
        [
          ['D', 'A', null],
          ['B', 'C', 'D'],
        ],
        [['A', 'B', null]],
        [['C', 'D', 'D']],
        [['A', 'B', 'C']],
      ],
    };
    let totalCleared = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const random = rng(seed);
      let state = createGame(level);
      const allIds = new Set(itemIds(state));
      for (let step = 0; step < 200; step++) {
        const moves = validMoves(state);
        if (moves.length === 0) break;
        const [from, to] = moves[Math.floor(random() * moves.length)]!;
        const before = countItems(state);
        const result = apply(state, from, to);
        state = result.state;

        const ids = itemIds(state);
        const cleared = result.events.filter((e) => e.kind === 'tripleCleared').length;
        totalCleared += cleared;
        expect(before - ids.length).toBe(cleared * 3);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(allIds.has(id)).toBe(true);
        if (isWon(state)) break;
      }
    }
    // Guard against a vacuous test: random play must actually clear triples.
    expect(totalCleared).toBeGreaterThan(0);
  });
});
