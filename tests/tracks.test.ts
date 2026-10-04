import { describe, expect, it } from 'vitest';
import {
  carrierOffset,
  carrierTop,
  countItems,
  countTrackItems,
  createGame,
  dropHeld,
  findTrackItem,
  firstMoves,
  isBlocked,
  isCarrierSource,
  LevelError,
  pickFromTrack,
  returnHeld,
  tick,
  type ColumnLayoutDefinition,
  type GameState,
  type LevelDefinition,
  type TrackDefinition,
  stackOf,
  startClock,
} from '../src/core';
import { front } from './helpers';

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

const up = (carriers: string[][], speed = -0.5): TrackDefinition => ({ orientation: 'vertical', speed, carriers });
const down = (carriers: string[][], speed = 0.5): TrackDefinition => ({ orientation: 'vertical', speed, carriers });

/**
 * Shelves S0 [A A .]   S1 [B B .]   S2 [C D .]
 * Track 0 (up):   [A, B] [C]      Track 1 (down): [] [C, D, D]
 * Layout: track 0 | S0 S1 S2 | track 1
 */
const twoTracks: LevelDefinition = {
  id: 'two-tracks',
  shelves: [[['A', 'A', null]], [['B', 'B', null]], [['C', 'D', null]]],
  mechanics: [{ kind: 'tracks', tracks: [up([['A', 'B'], ['C']]), down([[], ['C', 'D', 'D']])] }],
  layout: {
    columns: [
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'track', track: 1 },
    ],
  },
};

describe('tracks: data and ids', () => {
  it('builds tracks of stacks, with ids after the shelves: track by track, carrier by carrier, top first', () => {
    const state = createGame(twoTracks);
    expect(state.tracks).toHaveLength(2);
    expect(state.tracks[0]!.orientation).toBe('vertical');
    expect(state.tracks[0]!.carriers.map((c) => stackOf(c).map((i) => i.id))).toEqual([[7, 8], [9]]);
    expect(state.tracks[1]!.carriers.map((c) => stackOf(c).map((i) => i.id))).toEqual([[], [10, 11, 12]]);
    expect(countTrackItems(state)).toBe(6);
    expect(countItems(state)).toBe(12);
    expect(findTrackItem(state, 8)).toEqual({ track: 0, carrier: 0, depth: 1 });
    expect(findTrackItem(state, 12)).toEqual({ track: 1, carrier: 1, depth: 2 });
    expect(findTrackItem(state, 1)).toBeNull();
  });

  const bad: [string, Partial<LevelDefinition>, RegExp][] = [
    ['both belt kinds', { mechanics: [{ kind: 'conveyor', slots: [null], speed: 1 }, { kind: 'tracks', tracks: [] }] }, /either conveyor or tracks/],
    ['no tracks', { mechanics: [{ kind: 'tracks', tracks: [] }] }, /between 1 and 4 tracks/],
    ['a track without carriers', { mechanics: [{ kind: 'tracks', tracks: [up([]), up([['C', 'C', 'C']])] }] }, /track 0 needs between 1 and 12 carriers/],
    ['a stack too deep', { mechanics: [{ kind: 'tracks', tracks: [up([['C', 'C', 'C', 'D', 'D', 'D']])] }] }, /at most 5 items/],
    ['a zero speed', { mechanics: [{ kind: 'tracks', tracks: [up([['C', 'C', 'C']], 0)] }] }, /track 0 speed/],
    ['no items at all', { mechanics: [{ kind: 'tracks', tracks: [up([[], []])] }] }, /at least one item/],
  ];
  it.each(bad)('rejects %s', (_name, change, message) => {
    const level = { ...twoTracks, shelves: [[['A', 'A', 'B']], [['B', 'B', 'A']], [[null, null, null]]], layout: undefined, ...change } as LevelDefinition;
    expect(() => createGame(level)).toThrow(LevelError);
    expect(() => createGame(level)).toThrow(message);
  });
});

describe('column layouts (structure)', () => {
  const withLayout = (layout: ColumnLayoutDefinition | undefined): LevelDefinition => {
    const { layout: _original, ...rest } = twoTracks;
    return layout ? { ...rest, layout } : rest;
  };
  const shelves = { kind: 'shelves', shelves: [0, 1, 2] } as const;

  it('accepts every shelf and track in exactly one column', () => {
    expect(() => createGame(twoTracks)).not.toThrow();
  });

  it.each([
    ['no layout with vertical tracks', undefined, /column layout/],
    ['four columns', { columns: [{ kind: 'track', track: 0 }, shelves, { kind: 'track', track: 1 }, { kind: 'shelves', shelves: [0] }] }, /1 to 3 columns/],
    ['a missing shelf', { columns: [{ kind: 'track', track: 0 }, { kind: 'shelves', shelves: [0, 1] }, { kind: 'track', track: 1 }] }, /shelf 2 must appear in exactly one column or shelf track \(found 0\)/],
    ['a shelf twice', { columns: [{ kind: 'shelves', shelves: [0, 1] }, { kind: 'track', track: 0 }, { kind: 'shelves', shelves: [1, 2] }] }, /shelf 1 must appear/],
    ['a missing track', { columns: [{ kind: 'track', track: 0 }, shelves] }, /track 1 must appear/],
    ['an unknown shelf', { columns: [{ kind: 'shelves', shelves: [0, 1, 2, 7] }, { kind: 'track', track: 0 }, { kind: 'track', track: 1 }] }, /shelf 7, which does not exist/],
    ['an empty shelf column', { columns: [{ kind: 'shelves', shelves: [] }, { kind: 'track', track: 0 }, { kind: 'track', track: 1 }] }, /at least one shelf/],
  ] as [string, ColumnLayoutDefinition | undefined, RegExp][])('rejects %s', (_name, layout, message) => {
    expect(() => createGame(withLayout(layout))).toThrow(message);
  });

  it('keeps tracks in columns vertical', () => {
    const level: LevelDefinition = {
      ...twoTracks,
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 1, carriers: [['A', 'B'], ['C']] }, down([[], ['C', 'D', 'D']])] }],
    };
    expect(() => createGame(level)).toThrow(/track 0 is in a column, so it must be vertical/);
  });

  it('allows a single horizontal track without a layout, and nothing more', () => {
    const base = { id: 'h', shelves: [[['A', 'A', null]], [['B', 'B', null]], [['C', null, null]]] } as LevelDefinition;
    const horizontal: TrackDefinition = { orientation: 'horizontal', speed: 1, carriers: [['A', 'B'], ['C'], ['C']] };
    expect(() => createGame({ ...base, mechanics: [{ kind: 'tracks', tracks: [horizontal] }] })).not.toThrow();
    const empty: TrackDefinition = { orientation: 'horizontal', speed: 1, carriers: [[]] };
    expect(() => createGame({ ...base, mechanics: [{ kind: 'tracks', tracks: [horizontal, empty] }] })).toThrow(/column layout/);
  });
});

describe('stacks', () => {
  it('offers only the top item; taking it shows the next one', () => {
    let state = createGame(twoTracks);
    const ref = { track: 0, carrier: 0 };
    expect(carrierTop(state, ref)).toEqual({ id: 7, type: 'A' });
    const picked = ok(pickFromTrack(state, ref));
    expect(picked.events).toEqual([{ kind: 'beltItemTaken', itemId: 7, from: ref }]);
    state = picked.state;
    expect(carrierTop(state, ref)).toEqual({ id: 8, type: 'B' });
    expect(countTrackItems(state)).toBe(6);

    // Placing A completes AAA; the B now on top can be taken next.
    state = ok(dropHeld(state, front(0, 2))).state;
    state = ok(dropHeld(ok(pickFromTrack(state, ref)).state, front(1, 2))).state;
    expect(stackOf(state.tracks[0]!.carriers[0]!)).toEqual([]);
    expect(pickFromTrack(state, ref)).toEqual({ ok: false, reason: 'carrierEmpty' });
  });

  it('returns a held item to the top of its own stack', () => {
    const state = createGame(twoTracks);
    const ref = { track: 1, carrier: 1 };
    const held = ok(pickFromTrack(state, ref)).state;
    expect(stackOf(held.tracks[1]!.carriers[1]!).map((i) => i.id)).toEqual([11, 12]);
    const back = ok(returnHeld(held));
    expect(back.events).toEqual([{ kind: 'beltItemReturned', itemId: 10, to: ref }]);
    expect(stackOf(back.state.tracks[1]!.carriers[1]!).map((i) => i.id)).toEqual([10, 11, 12]);
    expect(back.state.held).toBeNull();
  });

  it('lets only carrier tops be first moves, from every track', () => {
    const sources = firstMoves(createGame(twoTracks)).flatMap((m) => (isCarrierSource(m.from) ? [m.from] : []));
    const distinct = new Set(sources.map((s) => `${s.track}:${s.carrier}`));
    expect([...distinct].sort()).toEqual(['0:0', '0:1', '1:1']);
  });
});

describe('several tracks moving', () => {
  it('moves each track with its own speed and direction, from the same game clock', () => {
    const state: GameState = tick(startClock(createGame(twoTracks)), 1000).state;
    const [upTrack, downTrack] = state.tracks;
    // Up at 0.5 carriers/s: carrier 0 of 2 moves from 0 back to 1.5; down at 0.5: carrier 0 moves to 0.5.
    expect(carrierOffset(upTrack!, 0, state.trackTimeMs)).toBeCloseTo(1.5);
    expect(carrierOffset(downTrack!, 0, state.trackTimeMs)).toBeCloseTo(0.5);
    expect(state.trackTimeMs).toBe(1000);
  });

  it('counts any track item as a way to keep playing, but never as free space', () => {
    const state = createGame(twoTracks);
    expect(isBlocked(state)).toBe(false);
  });
});
