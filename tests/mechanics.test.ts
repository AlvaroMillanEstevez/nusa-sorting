import { describe, expect, it } from 'vitest';
import {
  createGame,
  freeFrontSlots,
  isBlocked,
  isShelfLocked,
  itemAt,
  LevelError,
  moveItem,
  tick,
  triplesToUnlock,
  type GameEvent,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type Position,
} from '../src/core';
import { front } from './helpers';

function apply(state: GameState, from: Position, to: Position) {
  const result = moveItem(state, from, to);
  if (!result.ok) throw new Error(`unexpected invalid move: ${result.reason}`);
  return result;
}

const kinds = (events: readonly GameEvent[]) => events.map((e) => e.kind);
const COMBO: MechanicDefinition = { kind: 'combo' };

/**
 * S0 [A A .]   S1 [A B B]   S2 [B . .]
 * Move A S1→S0 clears AAA, then B S2→S1 clears BBB.
 */
const twoTriples: LevelDefinition = {
  id: 'two-triples',
  shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]],
};

describe('level format', () => {
  it('a level without mechanics, or with an empty list, has only the default combo', () => {
    for (const level of [twoTriples, { ...twoTriples, mechanics: [] }]) {
      const state = createGame(level);
      expect(state.combo).toMatchObject({ combo: 0, score: 0, windowMs: 5000, pointsPerTriple: 100 });
      expect(state.blocker).toBeNull();
      expect(state.tracks).toEqual([]);
      expect(state.held).toBeNull();
      expect(state.unlockAt).toEqual([null, null, null]);
      expect(state.triplesCleared).toBe(0);
    }
  });

  it('counts and scores triples in a level without mechanics, with the default combo', () => {
    let state = createGame(twoTriples);
    const first = apply(state, front(1, 0), front(0, 2));
    expect(kinds(first.events)).toEqual(['moved', 'tripleCleared', 'comboChanged', 'scoreChanged']);
    expect(first.state.combo.score).toBe(100);
    state = first.state;
    expect(state.triplesCleared).toBe(1);
  });

  const invalid: [string, MechanicDefinition[], RegExp][] = [
    ['duplicate kinds', [COMBO, COMBO], /only once/],
    ['zero combo window', [{ kind: 'combo', windowSeconds: 0 }], /window/],
    ['empty multiplier table', [{ kind: 'combo', multipliers: [] }], /multipliers/],
    ['negative multiplier', [{ kind: 'combo', multipliers: [1, -2] }], /multipliers/],
    ['locked shelf out of range', [{ kind: 'lockedShelves', shelves: [{ shelf: 9, triplesRequired: 1 }] }], /does not exist/],
    ['shelf locked twice', [{ kind: 'lockedShelves', shelves: [{ shelf: 0, triplesRequired: 1 }, { shelf: 0, triplesRequired: 1 }] }], /twice/],
    ['too many triples required', [{ kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 3 }] }], /between 1 and 2/],
    ['all shelves locked', [{ kind: 'lockedShelves', shelves: [0, 1, 2].map((shelf) => ({ shelf, triplesRequired: 1 })) }], /at least one shelf/],
    ['blocker on an item', [COMBO, { kind: 'roamingBlocker', start: { shelf: 0, slot: 0 }, seed: 1 }], /empty slot/],
    ['blocker off the board', [COMBO, { kind: 'roamingBlocker', start: { shelf: 0, slot: 5 }, seed: 1 }], /outside/],
    ['blocker removed too early', [COMBO, { kind: 'roamingBlocker', start: { shelf: 2, slot: 1 }, seed: 1, removeAtCombo: 1 }], /at least 2/],
    [
      'blocker on a locked shelf',
      [COMBO, { kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] }, { kind: 'roamingBlocker', start: { shelf: 2, slot: 1 }, seed: 1 }],
      /locked shelf/,
    ],
  ];

  it.each(invalid)('rejects %s', (_name, mechanics, message) => {
    expect(() => createGame({ ...twoTriples, mechanics })).toThrow(LevelError);
    expect(() => createGame({ ...twoTriples, mechanics })).toThrow(message);
  });
});

describe('combo and score', () => {
  const level: LevelDefinition = { ...twoTriples, mechanics: [COMBO] };

  it('scores the first triple and grows the combo for a triple inside the window', () => {
    let state = createGame(level);
    const first = apply(state, front(1, 0), front(0, 2));
    expect(first.events).toContainEqual({ kind: 'comboChanged', combo: 1, windowMs: 5000 });
    expect(first.events).toContainEqual({ kind: 'scoreChanged', score: 100, delta: 100, shelf: 0 });
    state = tick(first.state, 4000).state;

    const second = apply(state, front(2, 0), front(1, 0));
    expect(second.events).toContainEqual({ kind: 'comboChanged', combo: 2, windowMs: 5000 });
    expect(second.events).toContainEqual({ kind: 'scoreChanged', score: 250, delta: 150, shelf: 1 });
    expect(second.state.combo).toMatchObject({ combo: 2, maxCombo: 2, score: 250 });
    expect(second.state.status).toBe('won');
  });

  it('breaks the combo when the window runs out, with a single comboChanged event', () => {
    const first = apply(createGame(level), front(1, 0), front(0, 2));
    const expired = tick(first.state, 5000);
    expect(expired.events).toEqual([{ kind: 'comboChanged', combo: 0, windowMs: 0 }]);
    expect(expired.state.combo).toMatchObject({ combo: 0, windowLeftMs: 0, score: 100 });
    expect(tick(expired.state, 1000).events).toEqual([]);

    const second = apply(expired.state, front(2, 0), front(1, 0));
    expect(second.events).toContainEqual({ kind: 'scoreChanged', score: 200, delta: 100, shelf: 1 });
    expect(second.state.combo).toMatchObject({ combo: 1, maxCombo: 1 });
  });

  it('runs the window on untimed levels too', () => {
    const state = apply(createGame(level), front(1, 0), front(0, 2)).state;
    expect(state.timeLeftMs).toBeNull();
    expect(tick(state, 2000).state.combo?.windowLeftMs).toBe(3000);
  });

  it('counts triples chained by advancing layers', () => {
    const cascade: LevelDefinition = {
      id: 'cascade',
      mechanics: [COMBO],
      shelves: [
        [
          ['A', null, null],
          ['B', 'B', 'B'],
          ['C', 'C', 'C'],
        ],
        [['A', 'A', null]],
      ],
    };
    const result = apply(createGame(cascade), front(0, 0), front(1, 2));
    const scores = result.events.filter((e) => e.kind === 'scoreChanged').map((e) => e.delta);
    expect(scores).toEqual([100, 150, 200]);
    expect(result.state.combo).toMatchObject({ combo: 3, score: 450 });
    expect(result.state.triplesCleared).toBe(3);
  });

  it('uses the multiplier table from the level data, repeating its last entry', () => {
    const custom: LevelDefinition = {
      ...twoTriples,
      mechanics: [{ kind: 'combo', pointsPerTriple: 10, multipliers: [2] }],
    };
    const first = apply(createGame(custom), front(1, 0), front(0, 2));
    const second = apply(first.state, front(2, 0), front(1, 0));
    expect(second.state.combo?.score).toBe(40);
  });
});

describe('locked shelves', () => {
  /**
   * S0 [A A .]   S1 [A B B]   S2 [B C C] locked until 1 triple   S3 [C . .]
   */
  const level: LevelDefinition = {
    id: 'locked',
    mechanics: [{ kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] }],
    shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', 'C', 'C']], [['C', null, null]]],
  };

  it('neither gives nor takes items while locked, leaving the state untouched', () => {
    const state = createGame(level);
    expect(isShelfLocked(state, 2)).toBe(true);
    expect(triplesToUnlock(state, 2)).toBe(1);
    expect(freeFrontSlots(state, 2)).toEqual([]);
    const snapshot = structuredClone(state);
    expect(moveItem(state, front(2, 0), front(3, 1))).toEqual({ ok: false, reason: 'shelfLocked' });
    expect(moveItem(state, front(3, 0), front(0, 2))).toMatchObject({ ok: true });
    expect(state).toEqual(snapshot);
  });

  it('unlocks once the required triples are cleared, then plays normally to a win', () => {
    let state = createGame(level);
    const first = apply(state, front(1, 0), front(0, 2));
    expect(kinds(first.events)).toEqual(['moved', 'tripleCleared', 'comboChanged', 'scoreChanged', 'shelfUnlocked']);
    state = first.state;
    expect(isShelfLocked(state, 2)).toBe(false);

    state = apply(state, front(2, 0), front(1, 0)).state; // BBB
    const last = apply(state, front(3, 0), front(2, 0)); // CCC
    expect(last.state.status).toBe('won');
    expect(last.events.filter((e) => e.kind === 'shelfUnlocked')).toHaveLength(0);
  });

  it('treats locked shelves as unavailable for the blocked defeat', () => {
    // The only free slots are on the locked shelf, so nothing can move.
    expect(() =>
      createGame({
        id: 'locked-start',
        mechanics: [{ kind: 'lockedShelves', shelves: [{ shelf: 1, triplesRequired: 1 }] }],
        shelves: [
          [['A', 'B', 'A']],
          [['B', null, null]],
          [['A', 'B', 'C']],
          [
            ['C', 'C', 'D'],
            ['D', 'D', null],
          ],
        ],
      }),
    ).toThrow(/starts blocked/);
  });
});

describe('roaming blocker', () => {
  /** S0 [A A .]   S1 [A B B]   S2 [B . .]   S3 [. . .]  blocker on S3 slot 0 */
  const level = (seed: number, removeAtCombo = 7): LevelDefinition => ({
    id: 'blocker',
    mechanics: [COMBO, { kind: 'roamingBlocker', start: { shelf: 3, slot: 0 }, seed, removeAtCombo }],
    shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]], [[null, null, null]]],
  });

  it('cannot receive items, even when reordering', () => {
    const state = createGame(level(1));
    expect(freeFrontSlots(state, 3)).toEqual([1, 2]);
    expect(moveItem(state, front(2, 0), front(3, 0))).toEqual({ ok: false, reason: 'slotBlocked' });
    const moved = apply(state, front(2, 0), front(3, 1)).state;
    expect(moveItem(moved, front(3, 1), front(3, 0))).toEqual({ ok: false, reason: 'slotBlocked' });
  });

  it('jumps to another empty slot after a triple, the same way for the same seed', () => {
    const jump = (seed: number) => apply(createGame(level(seed)), front(1, 0), front(0, 2));
    const first = jump(42);
    const event = first.events.find((e) => e.kind === 'blockerMoved');
    expect(event).toMatchObject({ kind: 'blockerMoved', from: { shelf: 3, slot: 0 } });
    const to = first.state.blocker!.at;
    expect(to).not.toEqual({ shelf: 3, slot: 0 });
    expect(itemAt(first.state, { shelf: to.shelf, layer: 0, slot: to.slot })).toBeNull();
    expect(jump(42).state.blocker).toEqual(first.state.blocker);

    const destinations = new Set(Array.from({ length: 20 }, (_, seed) => JSON.stringify(jump(seed).state.blocker!.at)));
    expect(destinations.size).toBeGreaterThan(1);
  });

  it('does not move without a triple', () => {
    const result = apply(createGame(level(1)), front(2, 0), front(3, 1));
    expect(result.state.blocker?.at).toEqual({ shelf: 3, slot: 0 });
    expect(kinds(result.events)).toEqual(['moved']);
  });

  it('disappears for good when the combo reaches the threshold', () => {
    // Pick a seed whose first jump keeps S1 slot 0 usable for the second triple.
    const seed = Array.from({ length: 50 }, (_, s) => s).find((s) => {
      const at = apply(createGame(level(s, 2)), front(1, 0), front(0, 2)).state.blocker!.at;
      return !(at.shelf === 1 && at.slot === 0);
    })!;
    const first = apply(createGame(level(seed, 2)), front(1, 0), front(0, 2));
    const second = apply(first.state, front(2, 0), front(1, 0));
    expect(second.events).toContainEqual({ kind: 'blockerRemoved', at: first.state.blocker!.at });
    expect(second.events.some((e) => e.kind === 'blockerMoved')).toBe(false);
    expect(second.state.blocker).toBeNull();
  });

  it('stays put when there is no other empty slot, and a blocked slot does not count as free', () => {
    /*
     * S0 [A A .] back [C C E]   S1 [A . .] back [E E C]   S2 [▣ D D] back [F . .]   S3 [D F F]
     * A into S0 clears; S0 and S1 then refill from behind. The only empty slot left is the blocker's.
     */
    const state = createGame({
      id: 'stuck-blocker',
      mechanics: [COMBO, { kind: 'roamingBlocker', start: { shelf: 2, slot: 0 }, seed: 3 }],
      shelves: [
        [
          ['A', 'A', null],
          ['C', 'C', 'E'],
        ],
        [
          ['A', null, null],
          ['E', 'E', 'C'],
        ],
        [
          [null, 'D', 'D'],
          ['F', null, null],
        ],
        [['D', 'F', 'F']],
      ],
    });
    const result = apply(state, front(1, 0), front(0, 2));
    expect(result.events.some((e) => e.kind === 'blockerMoved')).toBe(false);
    expect(result.state.blocker?.at).toEqual({ shelf: 2, slot: 0 });
    expect(isBlocked(result.state)).toBe(true);
    expect(result.state).toMatchObject({ status: 'lost', loseReason: 'blocked' });
  });

  it('rejects levels whose only empty slot is blocked', () => {
    const shelves: LevelDefinition['shelves'] = [
      [['A', 'B', 'C']],
      [
        ['B', 'C', null],
        ['A', 'A', 'B'],
      ],
      [
        ['C', 'D', 'D'],
        ['D', null, null],
      ],
    ];
    expect(() => createGame({ id: 'free', shelves })).not.toThrow();
    expect(() =>
      createGame({
        id: 'blocked-start',
        shelves,
        mechanics: [COMBO, { kind: 'roamingBlocker', start: { shelf: 1, slot: 2 }, seed: 1 }],
      }),
    ).toThrow(/starts blocked/);
  });
});

describe('mechanics stack freely', () => {
  it('runs a roaming blocker without declaring the combo mechanic, removed by the default combo', () => {
    const level = (seed: number): LevelDefinition => ({
      id: 'blocker-default-combo',
      mechanics: [{ kind: 'roamingBlocker', start: { shelf: 3, slot: 0 }, seed, removeAtCombo: 2 }],
      shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]], [[null, null, null]]],
    });
    // A seed whose first jump keeps S1 slot 0 free for the second triple.
    const seed = Array.from({ length: 50 }, (_, s) => s).find((s) => {
      const at = apply(createGame(level(s)), front(1, 0), front(0, 2)).state.blocker!.at;
      return !(at.shelf === 1 && at.slot === 0);
    })!;
    const first = apply(createGame(level(seed)), front(1, 0), front(0, 2));
    const second = apply(first.state, front(2, 0), front(1, 0));
    expect(second.events).toContainEqual({ kind: 'blockerRemoved', at: first.state.blocker!.at });
    expect(second.state.blocker).toBeNull();
  });
});
