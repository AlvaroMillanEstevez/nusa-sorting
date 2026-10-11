import { describe, expect, it } from 'vitest';
import {
  canProgress,
  carrierOffset,
  continueAfterBlocked,
  createGame,
  dropHeld,
  freeFrontSlots,
  isShelfClosed,
  LevelError,
  moveItem,
  pickFromTrack,
  removeTriple,
  restoreSnapshot,
  shuffleBoard,
  stackOf,
  takeSnapshot,
  NO_BOOSTERS_USED,
  type GameState,
  type LevelDefinition,
  type MoveResult,
} from '../src/core';
import { demoLevels } from './fixtures/demo-levels';
import { itemIds, rng } from './helpers';

const ok = (result: MoveResult) => {
  if (!result.ok) throw new Error(`unexpected: ${result.reason}`);
  return result;
};
const front = (shelf: number, slot: number) => ({ shelf, layer: 0, slot });
const kinds = (result: MoveResult) => (result.ok ? result.events.map((e) => e.kind) : []);

/** Two fixed stacks in a column beside two shelves. */
const fixedStacks: LevelDefinition = {
  id: 'fixed',
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'track', track: 0 },
    ],
  },
  shelves: [[['a', 'b', null]], [['a', null, null]], [[null, null, null]]],
  mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0, carriers: [['a', 'b', 'c'], ['b', 'c', 'c']] }] }],
};

describe('fixed stacks', () => {
  it('are a track of speed 0 whose carriers stay in the middle of their slots, whatever the time', () => {
    const state = createGame(fixedStacks);
    const track = state.tracks[0]!;
    for (const time of [0, 1234, 99_999]) {
      expect(carrierOffset(track, 0, time)).toBe(0.5);
      expect(carrierOffset(track, 1, time)).toBe(1.5);
    }
  });

  it('give only their top item, and the next one comes up; an empty one gives nothing and takes nothing', () => {
    let state = createGame(fixedStacks);
    const picked = ok(pickFromTrack(state, { track: 0, carrier: 0 }));
    expect(picked.state.held?.item.type).toBe('a');
    expect(stackOf(picked.state.tracks[0]!.carriers[0]!).map((i) => i.type)).toEqual(['b', 'c']);
    // Placed on the shelf with two 'a': a triple.
    const dropped = ok(dropHeld(picked.state, front(0, 2)));
    expect(kinds(dropped)).not.toContain('tripleCleared');
    state = ok(dropHeld(ok(pickFromTrack(dropped.state, { track: 0, carrier: 0 })).state, front(1, 1))).state;
    state = ok(pickFromTrack(state, { track: 0, carrier: 0 })).state;
    state = ok(dropHeld(state, front(1, 2))).state;
    expect(stackOf(state.tracks[0]!.carriers[0]!)).toEqual([]);
    expect(pickFromTrack(state, { track: 0, carrier: 0 })).toEqual({ ok: false, reason: 'carrierEmpty' });
  });

  it('are checked: stacks only, at most six, at most eight deep', () => {
    const withStacks = (carriers: readonly (readonly string[] | { shelf: number })[], extraShelves = 0): LevelDefinition => ({
      ...fixedStacks,
      shelves: [...fixedStacks.shelves, ...Array.from({ length: extraShelves }, () => [['x', 'x', 'x'] as (string | null)[]])],
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0, carriers }] }],
    });
    expect(() => createGame(withStacks([['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c']]))).toThrow(LevelError);
    expect(() => createGame(withStacks(Array.from({ length: 7 }, () => ['a'])))).toThrow(LevelError);
    expect(() => createGame({ ...fixedStacks, layout: { columns: [{ kind: 'shelves', shelves: [0] }, { kind: 'shelfTrack', track: 0 }] }, mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0, carriers: [{ shelf: 1 }] }] }] })).toThrow(LevelError);
  });

  it('keep their items when the board is shuffled, while shelves and moving stacks mix', () => {
    const level = demoLevels.find((l) => l.id === 'level017')!;
    const state = createGame(level);
    for (let seed = 1; seed <= 20; seed++) {
      const shuffled = shuffleBoard(state, rng(seed));
      if (!shuffled.ok) continue;
      expect(shuffled.state.tracks[0]).toEqual(state.tracks[0]);
      expect(itemIds(shuffled.state).sort()).toEqual(itemIds(state).sort());
    }
  });

  it('can lose a whole triple to "remove a triple", hidden members included', () => {
    const state = createGame(fixedStacks);
    // The 'b' in view on shelf 0: its two others are hidden in the stacks (second in one, on top of the other).
    const result = ok(removeTriple(state, front(0, 1)));
    const left = itemIds(result.state).length;
    expect(left).toBe(itemIds(state).length - 3);
    expect([...result.state.tracks[0]!.carriers.flatMap((c) => stackOf(c))].filter((i) => i.type === 'b')).toHaveLength(0);
  });
});

/** Four shelves; shelf 1 holds two items and closes once emptied, shelf 3 has a layer behind. */
const closing: LevelDefinition = {
  id: 'closing',
  shelves: [[['a', 'b', null]], [['c', 'a', null]], [['b', 'c', null]], [['a', null, 'b'], ['c', null, null]]],
  mechanics: [{ kind: 'closingShelves', shelves: [1, 3] }],
};

describe('shelves that close', () => {
  it('close for good once emptied, then take nothing; free slots on them no longer count', () => {
    let state = createGame(closing);
    expect(state.closesWhenEmpty).toEqual([false, true, false, true]);
    state = ok(moveItem(state, front(1, 0), front(2, 2))).state;
    expect(isShelfClosed(state, 1)).toBe(false);
    const emptied = ok(moveItem(state, front(1, 1), front(0, 2)));
    expect(kinds(emptied)).toContain('shelfClosed');
    expect(isShelfClosed(emptied.state, 1)).toBe(true);
    expect(freeFrontSlots(emptied.state, 1)).toEqual([]);
    expect(moveItem(emptied.state, front(2, 0), front(1, 0))).toEqual({ ok: false, reason: 'shelfClosed' });
  });

  it('wait for their last layer: emptying the front brings the one behind forward instead', () => {
    let state = createGame(closing);
    state = ok(moveItem(state, front(3, 0), front(0, 2))).state;
    const second = ok(moveItem(state, front(3, 2), front(2, 2)));
    expect(kinds(second)).toContain('layerAdvanced');
    expect(kinds(second)).not.toContain('shelfClosed');
    expect(isShelfClosed(second.state, 3)).toBe(false);
  });

  it('close when a triple empties them too, and the roaming blocker never jumps onto a closed one', () => {
    const level: LevelDefinition = {
      id: 'closing-blocker',
      shelves: [[['a', 'a', null]], [['a', null, null]], [[null, 'b', 'b']], [['b', 'c', 'c'], ['c', null, null]]],
      mechanics: [
        { kind: 'closingShelves', shelves: [0] },
        { kind: 'roamingBlocker', start: { shelf: 2, slot: 0 }, seed: 11, removeAtCombo: 9 },
      ],
    };
    const state = createGame(level);
    const result = ok(moveItem(state, front(1, 0), front(0, 2)));
    expect(kinds(result)).toEqual(expect.arrayContaining(['tripleCleared', 'shelfClosed', 'blockerMoved']));
    expect(result.state.blocker!.at.shelf).not.toBe(0);
  });

  it('wait while the roaming blocker holds a slot on them', () => {
    const level: LevelDefinition = {
      id: 'closing-held',
      shelves: [[['a', null, null]], [['a', 'a', null]], [['b', 'b', 'b'].map((x, i) => (i === 2 ? null : x)) as (string | null)[]], [['b', null, null]]],
      mechanics: [
        { kind: 'closingShelves', shelves: [0] },
        { kind: 'roamingBlocker', start: { shelf: 0, slot: 1 }, seed: 5, removeAtCombo: 9 },
      ],
    };
    const state = createGame(level);
    const result = ok(moveItem(state, front(0, 0), front(3, 1)));
    expect(kinds(result)).not.toContain('shelfClosed');
  });

  it('count for the defeat: closing the last free slots loses to space', () => {
    const level: LevelDefinition = {
      id: 'closing-loss',
      shelves: [[['a', 'b', 'c']], [['b', 'c', 'a']], [['c', 'a', null]], [['b', null, null]]],
      mechanics: [{ kind: 'closingShelves', shelves: [3] }],
    };
    const state = createGame(level);
    // Moving shelf 3's only item to the last free slot elsewhere empties it: it closes, and no slot is left.
    const result = ok(moveItem(state, front(3, 0), front(2, 2)));
    expect(isShelfClosed(result.state, 3)).toBe(true);
    expect(result.state.loseReason).toBe('blocked');
  });

  it('are checked: they must exist, start with something on them, and never ride a track', () => {
    expect(() => createGame({ ...closing, mechanics: [{ kind: 'closingShelves', shelves: [9] }] })).toThrow(LevelError);
    expect(() => createGame({ ...closing, shelves: [...closing.shelves, [[null, null, null]]], mechanics: [{ kind: 'closingShelves', shelves: [4] }] })).toThrow(LevelError);
    const ridden: LevelDefinition = {
      id: 'ridden',
      layout: { columns: [{ kind: 'shelves', shelves: [0] }, { kind: 'shelfTrack', track: 0 }] },
      shelves: [[['a', 'a', null]], [['a', null, null]]],
      mechanics: [
        { kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.3, carriers: [{ shelf: 1 }] }] },
        { kind: 'closingShelves', shelves: [1] },
      ],
    };
    expect(() => createGame(ridden)).toThrow(LevelError);
  });

  it('never get items from a shuffle once closed, and a removed triple can close one', () => {
    let state = createGame(closing);
    state = ok(moveItem(state, front(1, 0), front(2, 2))).state;
    state = ok(moveItem(state, front(1, 1), front(0, 2))).state;
    expect(isShelfClosed(state, 1)).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const shuffled = shuffleBoard(state, rng(seed));
      if (shuffled.ok) expect(shuffled.state.shelves[1]!.layers[0]).toEqual([null, null, null]);
    }
    // Shelf 3's front 'a' and 'b' are both of triples spread over the board; removing the 'a' triple leaves its
    // 'b', so it stays open; the closed shelf 1 is untouched.
    const removed = ok(removeTriple(state, front(3, 0)));
    expect(removed.state.closed[1]).toBe(true);
  });

  it('are kept by the snapshot of a level in progress, with the fixed stacks', () => {
    const level = demoLevels.find((l) => l.id === 'level017')!;
    let state = createGame(level);
    // Empty the closing shelf 3 (onde-onde, durian) into free slots of shelf 2.
    state = ok(moveItem(state, front(3, 0), front(2, 0))).state;
    state = ok(moveItem(state, front(3, 1), front(2, 2))).state;
    expect(state.closed[3]).toBe(true);
    expect(state.status).toBe('playing');
    const restored = restoreSnapshot(JSON.parse(JSON.stringify(takeSnapshot(level, 0, state, { continuesUsed: 0, boostersUsed: NO_BOOSTERS_USED }))), level);
    expect(restored?.state).toEqual(state);
    // A snapshot claiming a shelf closed that is not one that closes is dropped.
    const forged = JSON.parse(JSON.stringify(takeSnapshot(level, 0, state, { continuesUsed: 0, boostersUsed: NO_BOOSTERS_USED })));
    forged.state.closed[0] = true;
    expect(restoreSnapshot(forged, level)).toBeNull();
  });

  it('keep the stuck check safe: a board it calls stuck has no way on, closing shelves or not', () => {
    // From the demos with closing shelves, random play: whenever canProgress says no, no single move clears a
    // triple or brings a layer forward either (a quick check of soundness; the exact search is in stuck.test.ts).
    for (const id of ['level016', 'level017']) {
      const level = demoLevels.find((l) => l.id === id)!;
      const random = rng(id.length);
      for (let game = 0; game < 20; game++) {
        let state: GameState = createGame(level);
        for (let step = 0; step < 40 && state.status === 'playing'; step++) {
          const shelves = state.shelves.flatMap((shelf, s) => shelf.layers[0]!.flatMap((item, slot) => (item ? [front(s, slot)] : [])));
          const targets = state.shelves.flatMap((_, s) => freeFrontSlots(state, s).map((slot) => front(s, slot)));
          if (!shelves.length || !targets.length) break;
          const result = moveItem(state, shelves[Math.floor(random() * shelves.length)]!, targets[Math.floor(random() * targets.length)]!);
          if (!result.ok) continue;
          if (result.state.loseReason === 'stuck') {
            const before = result.state;
            const reopened = { ...before, status: 'playing' as const, loseReason: null };
            expect(canProgress(reopened)).toBe(false);
            // No move from there makes progress.
            for (const from of reopened.shelves.flatMap((shelf, s) => shelf.layers[0]!.flatMap((item, slot) => (item ? [front(s, slot)] : []))))
              for (const to of reopened.shelves.flatMap((_, s) => freeFrontSlots(reopened, s).map((slot) => front(s, slot)))) {
                const next = moveItem(reopened, from, to);
                if (next.ok) expect(next.events.some((e) => e.kind === 'tripleCleared' || e.kind === 'layerAdvanced')).toBe(false);
              }
          }
          state = result.state;
        }
      }
    }
  });

  it('continue after a defeat: removing a triple works with closed shelves and fixed stacks', () => {
    const level = demoLevels.find((l) => l.id === 'level017')!;
    const lost = { ...createGame(level), status: 'lost' as const, loseReason: 'blocked' as const };
    const result = continueAfterBlocked(lost);
    expect(result.ok).toBe(true);
  });
});
