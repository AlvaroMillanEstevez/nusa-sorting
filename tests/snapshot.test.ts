import { describe, expect, it } from 'vitest';
import {
  createGame,
  levelFingerprint,
  pickFromTrack,
  removeTriple,
  restoreSnapshot,
  SNAPSHOT_FORMAT,
  stackOf,
  startClock,
  takeSnapshot,
  tick,
  NO_BOOSTERS_USED,
  type GameState,
  type LevelDefinition,
} from '../src/core';
import { playList } from '../src/scenes/playList';
import { applyMove, suggestedMove } from '../tools/simulator';
import { demoLevels } from './fixtures/demo-levels';

const attempt = { continuesUsed: 2, boostersUsed: { ...NO_BOOSTERS_USED, freeze: 1 } };

/** Plays up to `moves` of the expert player's moves, with some time passing between them. */
function playSome(level: LevelDefinition, moves: number): GameState {
  let state = startClock(createGame(level));
  for (let i = 0; i < moves && state.status === 'playing'; i++) {
    const move = suggestedMove(state);
    if (!move) break;
    const result = applyMove(state, move);
    if (!result.ok) break;
    state = tick(result.state, 700).state;
  }
  return state;
}

/** Through JSON, as the save stores it. */
const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('game snapshot', () => {
  it.each(demoLevels.map((level) => [level.id, level] as const))('restores %s exactly after some moves', (_id, level) => {
    for (const moves of [0, 3, 8]) {
      const state = playSome(level, moves);
      if (state.status !== 'playing') continue;
      const restored = restoreSnapshot(roundTrip(takeSnapshot(level, 0, state, attempt)), level);
      expect(restored).toEqual({ state, ...attempt });
    }
  });

  it('restores every shipped level as it starts', () => {
    for (const { level } of playList) {
      const state = createGame(level);
      expect(restoreSnapshot(roundTrip(takeSnapshot(level, 0, state, attempt)), level)?.state).toEqual(state);
    }
  });

  it('keeps locks, the roaming blocker and its generator, tracks and their time', () => {
    const level = demoLevels.find((l) => l.mechanics?.some((m) => m.kind === 'roamingBlocker') && l.mechanics.some((m) => m.kind === 'tracks'))!;
    const state = playSome(level, 10);
    expect(state.status).toBe('playing');
    expect(state.triplesCleared).toBeGreaterThan(0);
    const restored = restoreSnapshot(roundTrip(takeSnapshot(level, 0, state, attempt)), level)!.state;
    expect(restored.blocker).toEqual(state.blocker);
    expect(restored.unlockAt).toEqual(state.unlockAt);
    expect(restored.triplesCleared).toBe(state.triplesCleared);
    expect(restored.tracks).toEqual(state.tracks);
    expect(restored.trackTimeMs).toBe(state.trackTimeMs);
    expect(restored.combo).toEqual(state.combo);
  });

  it('puts an item held from a track back on its carrier', () => {
    const level = demoLevels.find((l) => l.mechanics?.some((m) => m.kind === 'conveyor'))!;
    const state = startClock(createGame(level));
    const carrier = state.tracks[0]!.carriers.findIndex((c) => stackOf(c).length > 0);
    const held = pickFromTrack(state, { track: 0, carrier });
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    const restored = restoreSnapshot(roundTrip(takeSnapshot(level, 0, held.state, attempt)), level)!.state;
    expect(restored.held).toBeNull();
    expect(restored.tracks).toEqual(state.tracks);
  });

  it('keeps a board a booster changed (a triple taken from the back layers)', () => {
    const level = demoLevels.find((l) => l.shelves.some((shelf) => shelf.length > 1))!;
    const state = createGame(level);
    const removed = removeTriple(state, { shelf: 0, layer: 0, slot: state.shelves[0]!.layers[0]!.findIndex((item) => item !== null) });
    expect(removed.ok).toBe(true);
    if (!removed.ok || removed.state.status !== 'playing') return;
    expect(restoreSnapshot(roundTrip(takeSnapshot(level, 0, removed.state, attempt)), level)?.state).toEqual(removed.state);
  });

  describe('is dropped, without throwing, when', () => {
    const level = demoLevels[6]!;
    const state = playSome(level, 4);
    const good = roundTrip(takeSnapshot(level, 0, state, attempt)) as Record<string, unknown>;
    const withState = (change: (s: Record<string, unknown>) => void) => {
      const copy = roundTrip(good) as Record<string, unknown>;
      change(copy.state as Record<string, unknown>);
      return copy;
    };
    const shelvesOf = (s: Record<string, unknown>) => s.shelves as { layers: ({ id: number; type: string } | null)[][] }[];
    const firstItem = (s: Record<string, unknown>) => shelvesOf(s).flatMap((shelf) => shelf.layers.flat()).find((item) => item !== null)!;

    it('it is good (control)', () => expect(restoreSnapshot(good, level)).not.toBeNull());
    it('the format changed', () => expect(restoreSnapshot({ ...good, format: SNAPSHOT_FORMAT + 1 }, level)).toBeNull());
    it('it is for another level', () => expect(restoreSnapshot(good, demoLevels[5]!)).toBeNull());
    it('the level changed since', () => {
      const changed = { ...level, timeLimitSeconds: (level.timeLimitSeconds ?? 60) + 10 };
      expect(levelFingerprint(changed)).not.toBe(levelFingerprint(level));
      expect(restoreSnapshot(good, changed)).toBeNull();
    });
    it('the game was over', () => expect(restoreSnapshot(withState((s) => (s.status = 'lost')), level)).toBeNull());
    it('an item changed kind', () => expect(restoreSnapshot(withState((s) => (firstItem(s).type = 'nope')), level)).toBeNull());
    it('an item appears twice', () =>
      expect(
        restoreSnapshot(
          withState((s) => {
            const shelves = shelvesOf(s);
            const empty = shelves.flatMap((shelf) => shelf.layers[0]!.map((item, i) => ({ layer: shelf.layers[0]!, i, item }))).find((spot) => spot.item === null)!;
            empty.layer[empty.i] = { ...firstItem(s) };
          }),
          level,
        ),
      ).toBeNull());
    it('a single item is missing (not a whole triple)', () =>
      expect(
        restoreSnapshot(
          withState((s) => {
            const layer = shelvesOf(s).flatMap((shelf) => shelf.layers).find((l) => l.some((item) => item !== null))!;
            layer[layer.findIndex((item) => item !== null)] = null;
          }),
          level,
        ),
      ).toBeNull());
    it('a number is out of shape', () => {
      expect(restoreSnapshot(withState((s) => (s.timeLeftMs = -5)), level)).toBeNull();
      expect(restoreSnapshot(withState((s) => (s.trackTimeMs = 'soon')), level)).toBeNull();
      expect(restoreSnapshot(withState((s) => (s.triplesCleared = 99)), level)).toBeNull();
    });
    it('it is not a snapshot at all', () => {
      for (const junk of [null, undefined, 3, 'x', [], {}, { format: SNAPSHOT_FORMAT }]) expect(restoreSnapshot(junk, level)).toBeNull();
    });
  });
});
