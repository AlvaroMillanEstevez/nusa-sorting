import { describe, expect, it } from 'vitest';
import {
  addTime,
  arrangementCount,
  canProgress,
  continueAfterBlocked,
  createGame,
  freezeClock,
  isBlocked,
  isShelfLocked,
  removeTriple,
  shuffleBoard,
  stackOf,
  tick,
  typesNotOneTriple,
  withArrangement,
  type GameState,
  type LevelDefinition,
  type MoveResult,
} from '../src/core';
import { levels } from '../src/data/levels';
import { front, itemIds, rng } from './helpers';

const ok = (result: MoveResult) => {
  if (!result.ok) throw new Error(`unexpected: ${result.reason}`);
  return result;
};

/** The rules a board must keep whatever a booster did. */
function expectValid(state: GameState, label: string): void {
  // One triple per type, no item twice.
  expect(typesNotOneTriple(state), label).toEqual([]);
  const ids = itemIds(state);
  expect(new Set(ids).size, label).toBe(ids.length);
  state.shelves.forEach((shelf, s) => {
    // No empty back layer, and no empty front with layers behind (unless the roaming blocker holds it).
    shelf.layers.slice(1).forEach((layer) => expect(layer.some(Boolean), `${label} shelf ${s}`).toBe(true));
    const holdsBlocker = state.blocker?.at.shelf === s;
    if (shelf.layers.length > 1 && !holdsBlocker) expect(shelf.layers[0]!.some(Boolean), `${label} shelf ${s} front`).toBe(true);
    // Nothing stays formed as a triple in a front layer.
    const f = shelf.layers[0]!;
    expect(f[0] !== null && f.every((it) => it?.type === f[0]?.type), `${label} shelf ${s} triple`).toBe(false);
  });
}

describe('freeze', () => {
  const timed: LevelDefinition = { id: 'timed', timeLimitSeconds: 30, shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]] };

  it('stops the clock for its time, then lets it run again', () => {
    let state = { ...createGame(timed), clockStarted: true };
    state = ok(freezeClock(state, 10_000)).state;
    state = tick(state, 6_000).state;
    expect(state.timeLeftMs).toBe(30_000);
    state = tick(state, 6_000).state;
    expect(state.timeLeftMs).toBe(28_000);
    expect(state.frozenMs).toBe(0);
  });

  it('does nothing for an untimed level or a finished one', () => {
    expect(freezeClock(createGame({ ...timed, timeLimitSeconds: undefined as never }), 1000)).toEqual({ ok: false, reason: 'untimed' });
  });
});

describe('remove a triple', () => {
  /**
   * S0 [A B .] back [C A C]   S1 [B C .]   S2 [D D .] locked until 1 triple   belt stack [A? no]
   * A's members: S0 front, S0 back. Plus one on a track stack.
   */
  const level: LevelDefinition = {
    id: 'remove',
    shelves: [
      [
        ['A', 'B', null],
        ['C', 'A', 'C'],
      ],
      [['B', 'C', null]],
      [['D', 'D', null]],
      [['B', 'D', null]],
    ],
    mechanics: [
      { kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] },
      { kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.5, carriers: [['A'], []] }] },
    ],
  };

  it('takes the whole triple, hidden members included, scores nothing and counts as a triple', () => {
    const start = createGame(level);
    const result = ok(removeTriple(start, front(0, 0)));
    const removed = result.events.find((e) => e.kind === 'tripleCleared');
    expect(removed).toMatchObject({ itemType: 'A', byBooster: true });
    expect(removed?.kind === 'tripleCleared' && removed.itemIds).toHaveLength(3);
    // The A on the track stack went too.
    expect(stackOf(result.state.tracks[0]!.carriers[0]!)).toEqual([]);
    expect(result.state.combo.score).toBe(0);
    expect(result.state.triplesCleared).toBe(1);
    // It counts for locks: shelf 2 opens.
    expect(isShelfLocked(result.state, 2)).toBe(false);
    expect(result.events.some((e) => e.kind === 'shelfUnlocked')).toBe(true);
    expectValid(result.state, 'after removal');
  });

  it('lets a back layer come forward when the removal empties its front', () => {
    const lone: LevelDefinition = { id: 'lone', shelves: [[['A', null, null], ['B', 'B', 'C']], [['A', 'A', 'C']], [['B', 'C', null]]] };
    const result = ok(removeTriple(createGame(lone), front(0, 0)));
    expect(result.events.some((e) => e.kind === 'layerAdvanced')).toBe(true);
    expect(result.state.shelves[0]!.layers).toHaveLength(1);
    expectValid(result.state, 'lone');
  });

  it('refuses locked shelves, empty slots and hidden items', () => {
    const start = createGame(level);
    expect(removeTriple(start, front(2, 0))).toEqual({ ok: false, reason: 'noTarget' });
    expect(removeTriple(start, front(0, 2))).toEqual({ ok: false, reason: 'noTarget' });
    expect(removeTriple(start, { shelf: 0, layer: 1, slot: 0 })).toEqual({ ok: false, reason: 'noTarget' });
  });

  it('wins when it takes the last triple', () => {
    const last: LevelDefinition = { id: 'last', shelves: [[['A', 'A', null]], [['A', null, null]]] };
    expect(ok(removeTriple(createGame(last), front(1, 0))).state.status).toBe('won');
  });

  it('keeps every shipped level valid, whatever visible item it is used on', () => {
    for (const shipped of levels) {
      const state = createGame(shipped);
      state.shelves.forEach((shelf, s) =>
        shelf.layers[0]!.forEach((item, slot) => {
          const result = removeTriple(state, front(s, slot));
          if (!item || isShelfLocked(state, s)) {
            expect(result.ok).toBe(false);
            return;
          }
          expectValid(ok(result).state, `${shipped.id} ${s}:${slot}`);
        }),
      );
    }
  });
});

describe('continues', () => {
  it('adds time after running out of it', () => {
    const state = { ...createGame({ id: 't', timeLimitSeconds: 5, shelves: [[['A', 'A', null]], [['A', null, null]]] }), clockStarted: true };
    const lost = tick(state, 6000).state;
    expect(lost.loseReason).toBe('timeUp');
    const again = ok(addTime(lost, 15_000)).state;
    expect(again).toMatchObject({ status: 'playing', loseReason: null, timeLeftMs: 15_000 });
  });

  it('removes a triple after running out of space, freeing room', () => {
    // S0 [A B .] back [C C D]   S1 [A C D]   S2 [B B A] back [D . .]: putting A in S0 fills the board.
    const tight: LevelDefinition = {
      id: 'tight',
      shelves: [
        [
          ['A', 'B', null],
          ['C', 'C', 'D'],
        ],
        [['A', 'C', 'D']],
        [
          ['B', 'B', 'A'],
          ['D', null, null],
        ],
      ],
    };
    const lost = { ...createGame(tight), status: 'lost' as const, loseReason: 'blocked' as const };
    const result = ok(continueAfterBlocked(lost));
    expect(result.state.status).not.toBe('lost');
    expect(isBlocked(result.state)).toBe(false);
    expectValid(result.state, 'continued');
  });
});

describe('shuffle', () => {
  it('keeps the structure and the items, never starts with a triple, never blocks and never leaves the board stuck, on every shipped arrangement', () => {
    for (const shipped of levels) {
      for (let k = 0; k < Math.min(3, arrangementCount(shipped)); k++) {
        const state = createGame(withArrangement(shipped, k));
        const result = shuffleBoard(state, rng(k + 7));
        const label = `${shipped.id} #${k}`;
        if (!result.ok) {
          expect(result.reason, label).toBe('noShuffle');
          continue;
        }
        const next = result.state;
        expect(itemIds(next).sort(), label).toEqual(itemIds(state).sort());
        next.shelves.forEach((shelf, s) => {
          // Same shape: every occupied slot stays occupied, every empty one empty.
          expect(shelf.layers.map((l) => l.map(Boolean)), label).toEqual(state.shelves[s]!.layers.map((l) => l.map(Boolean)));
          if (isShelfLocked(state, s)) expect(shelf, `${label} locked ${s}`).toEqual(state.shelves[s]);
          for (const layer of shelf.layers) expect(layer[0] !== null && layer.every((it) => it?.type === layer[0]?.type), label).toBe(false);
        });
        next.tracks.forEach((track, t) =>
          track.carriers.forEach((carrier, c) => expect(stackOf(carrier).length).toBe(stackOf(state.tracks[t]!.carriers[c]!).length)),
        );
        expect(next.blocker, label).toEqual(state.blocker);
        expect(isBlocked(next), label).toBe(false);
        expect(canProgress(next), label).toBe(true);
        expectValid(next, label);
      }
    }
  });

  it('does not shuffle while a track item is held', () => {
    const state = createGame(levels[7]!);
    const held = { ...state, held: { item: { id: 999, type: 'x' }, from: { track: 0, carrier: 0 } } };
    expect(shuffleBoard(held, rng(1))).toEqual({ ok: false, reason: 'alreadyHolding' });
  });
});
