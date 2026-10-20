import { describe, expect, it } from 'vitest';
import {
  createGame,
  dropHeld,
  freshOf,
  isBlocked,
  canProgress,
  LevelError,
  moveItem,
  pickFromTrack,
  removeTriple,
  restoreSnapshot,
  takeSnapshot,
  type GameEvent,
  type GameState,
  type LevelDefinition,
  type MoveResult,
} from '../src/core';
import { front } from './helpers';

const ok = (result: MoveResult): { state: GameState; events: readonly GameEvent[] } => {
  if (!result.ok) throw new Error(`unexpected invalid move: ${result.reason}`);
  return result;
};

/** S0 [A A .]  S1 [A B .]  S2 [B B .]  S3 [. C .] with [C C .] behind: A is fresh with `moves` moves, B is not. */
const level = (moves: number, extra: Partial<LevelDefinition> = {}): LevelDefinition => ({
  id: 'fresh',
  shelves: [[['A', 'A', null]], [['A', 'B', null]], [['B', 'B', null]], [[null, 'C', null], ['C', 'C', null]]],
  mechanics: [{ kind: 'fresh', foods: [{ type: 'A', moves }] }],
  ...extra,
});

describe('fresh foods ("basi")', () => {
  it('counts down one per player move and spoils every item of the type at 0', () => {
    let state = createGame(level(3));
    expect(freshOf(state, 'A')).toEqual({ type: 'A', movesLeft: 3, spoiled: false });
    expect(freshOf(state, 'B')).toBeUndefined();
    state = ok(moveItem(state, front(2, 0), front(3, 0))).state;
    state = ok(moveItem(state, front(3, 0), front(2, 0))).state;
    expect(freshOf(state, 'A')!.movesLeft).toBe(1);
    const spoiled = ok(moveItem(state, front(2, 0), front(3, 0)));
    expect(freshOf(spoiled.state, 'A')).toEqual({ type: 'A', movesLeft: 0, spoiled: true });
    expect(spoiled.events).toContainEqual({ kind: 'spoiled', itemType: 'A' });
  });

  it('scores a fresh triple with a bonus of half a triple, even on its very last move', () => {
    const state = createGame(level(3));
    const won = ok(moveItem(state, front(1, 0), front(0, 2)));
    const triple = won.events.find((e) => e.kind === 'tripleCleared');
    expect(triple).toMatchObject({ itemType: 'A', freshness: 'fresh' });
    expect(won.state.combo.score).toBe(150);
    // With one move left, the move that makes the triple still finds it fresh.
    let last = createGame(level(3));
    last = ok(moveItem(last, front(2, 0), front(3, 0))).state;
    last = ok(moveItem(last, front(3, 0), front(2, 0))).state;
    const onTime = ok(moveItem(last, front(1, 0), front(0, 2)));
    expect(onTime.events.find((e) => e.kind === 'tripleCleared')).toMatchObject({ freshness: 'fresh' });
    expect(onTime.events.some((e) => e.kind === 'spoiled')).toBe(false);
  });

  it('still clears a spoiled triple, for no points, and breaks the combo', () => {
    let state = createGame(level(3));
    // B first: a combo of 1 and 100 points.
    state = ok(moveItem(state, front(1, 1), front(2, 2))).state;
    expect(state.combo.score).toBe(100);
    expect(state.combo.combo).toBe(1);
    state = ok(moveItem(state, front(3, 1), front(2, 0))).state;
    state = ok(moveItem(state, front(2, 0), front(2, 1))).state;
    expect(freshOf(state, 'A')!.spoiled).toBe(true);
    const thrown = ok(moveItem(state, front(1, 0), front(0, 2)));
    expect(thrown.events.find((e) => e.kind === 'tripleCleared')).toMatchObject({ itemType: 'A', freshness: 'spoiled' });
    expect(thrown.state.combo.score).toBe(100);
    expect(thrown.state.combo.combo).toBe(0);
    expect(thrown.events).toContainEqual({ kind: 'comboChanged', combo: 0, windowMs: 0 });
    // It still counts for locks and the blocker.
    expect(thrown.state.triplesCleared).toBe(2);
  });

  it('stops counting once the type is gone, and does not count boosters as moves', () => {
    let state = createGame(level(4));
    state = ok(moveItem(state, front(1, 0), front(0, 2))).state;
    const left = freshOf(state, 'A')!.movesLeft;
    state = ok(moveItem(state, front(2, 0), front(1, 0))).state;
    expect(freshOf(state, 'A')!.movesLeft).toBe(left);
    const boosted = ok(removeTriple(createGame(level(4)), front(2, 0)));
    expect(freshOf(boosted.state, 'A')!.movesLeft).toBe(4);
  });

  it('removes a fresh or a spoiled triple with the booster, scoring nothing either way', () => {
    const fresh = ok(removeTriple(createGame(level(3)), front(0, 0)));
    expect(fresh.events.find((e) => e.kind === 'tripleCleared')).toMatchObject({ byBooster: true, freshness: 'fresh' });
    expect(fresh.state.combo.score).toBe(0);
    let state = createGame(level(3));
    for (const [from, to] of [
      [front(2, 0), front(3, 0)],
      [front(3, 0), front(2, 0)],
      [front(2, 0), front(3, 0)],
    ] as const)
      state = ok(moveItem(state, from, to)).state;
    const spoiled = ok(removeTriple(state, front(0, 0)));
    expect(spoiled.events.find((e) => e.kind === 'tripleCleared')).toMatchObject({ byBooster: true, freshness: 'spoiled' });
    expect(spoiled.state.combo.score).toBe(0);
  });

  it('spoils items wherever they are, in back layers and track stacks, and counts a track move as one move', () => {
    const withTrack = createGame({
      id: 'fresh-track',
      shelves: [[['B', 'B', null]], [['C', null, null], ['A', 'C', 'C']], [[null, null, 'A']]],
      mechanics: [
        { kind: 'fresh', foods: [{ type: 'A', moves: 3 }] },
        { kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 1, carriers: [['B'], ['A']] }] },
      ],
    });
    const picked = ok(pickFromTrack(withTrack, { track: 0, carrier: 0 }));
    expect(freshOf(picked.state, 'A')!.movesLeft).toBe(3);
    const dropped = ok(dropHeld(picked.state, front(0, 2)));
    expect(freshOf(dropped.state, 'A')!.movesLeft).toBe(2);
    // Nothing blocks or gets stuck because of it.
    expect(isBlocked(dropped.state)).toBe(false);
    expect(canProgress(dropped.state)).toBe(true);
  });

  it('is part of the snapshot: countdowns and spoiled types come back, and a forged countdown is refused', () => {
    const def = level(5);
    let state = createGame(def);
    state = ok(moveItem(state, front(2, 0), front(3, 0))).state;
    state = ok(moveItem(state, front(3, 0), front(2, 0))).state;
    const attempt = { continuesUsed: 0, boostersUsed: { freeze: 0, removeTriple: 0, shuffle: 0 } };
    const snapshot = JSON.parse(JSON.stringify(takeSnapshot(def, 0, state, attempt)));
    expect(restoreSnapshot(snapshot, def)?.state.fresh).toEqual([{ type: 'A', movesLeft: 3, spoiled: false }]);
    expect(restoreSnapshot({ ...snapshot, state: { ...snapshot.state, fresh: [{ type: 'A', movesLeft: 9, spoiled: false }] } }, def)).toBeNull();
    expect(restoreSnapshot({ ...snapshot, state: { ...snapshot.state, fresh: [] } }, def)).toBeNull();
  });

  it('checks its foods: in the level, once each, with a sensible countdown', () => {
    expect(() => createGame(level(2))).toThrow(LevelError);
    expect(() => createGame({ ...level(5), mechanics: [{ kind: 'fresh', foods: [{ type: 'Z', moves: 5 }] }] })).toThrow(/not in the level/);
    expect(() =>
      createGame({
        ...level(5),
        mechanics: [
          {
            kind: 'fresh',
            foods: [
              { type: 'A', moves: 5 },
              { type: 'A', moves: 6 },
            ],
          },
        ],
      }),
    ).toThrow(/twice/);
  });
});
