import { describe, expect, it } from 'vitest';
import {
  carrierOfShelf,
  carrierOffset,
  countTrackItems,
  createGame,
  firstMoves,
  freeFrontSlots,
  isBlocked,
  isCarrierSource,
  moveItem,
  pickFromTrack,
  tick,
  validateLevel,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type Position,
  startClock,
} from '../src/core';
import { boardKinds, front, movingShelfCost, movingShelfSeconds } from './helpers';

function apply(state: GameState, from: Position, to: Position) {
  const result = moveItem(state, from, to);
  if (!result.ok) throw new Error(`unexpected invalid move: ${result.reason}`);
  return result;
}

/**
 * Fixed:  S0 [A A .]   S1 [A B B]
 * Riding track 0 (vertical, down):  S2 [B . .]   S3 [C C .] back [C . .]
 * Layout: S0 S1 | shelf track 0
 */
const shelfTrack = (mechanics: MechanicDefinition[] = []): LevelDefinition => ({
  id: 'shelf-track',
  shelves: [
    [['A', 'A', null]],
    [['A', 'B', 'B']],
    [['B', null, null]],
    [
      ['C', 'C', null],
      ['C', null, null],
    ],
  ],
  mechanics: [
    ...mechanics,
    { kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.3, carriers: [{ shelf: 2 }, { shelf: 3 }] }] },
  ],
  layout: { columns: [{ kind: 'shelves', shelves: [0, 1] }, { kind: 'shelfTrack', track: 0 }] },
});

describe('shelves riding a track: data', () => {
  it('builds a track of shelves that stay ordinary shelves of the level', () => {
    const state = createGame(shelfTrack());
    expect(state.tracks[0]!.carriers).toEqual([
      { kind: 'shelf', shelf: 2 },
      { kind: 'shelf', shelf: 3 },
    ]);
    expect(carrierOfShelf(state, 3)).toEqual({ track: 0, carrier: 1 });
    expect(carrierOfShelf(state, 0)).toBeNull();
    expect(countTrackItems(state)).toBe(0);
    // Their items are shelf items with ordinary ids.
    expect(state.shelves[2]!.layers[0]![0]).toEqual({ id: 6, type: 'B' });
  });

  const bad: [string, Partial<LevelDefinition>, RegExp][] = [
    [
      'stacks and shelves on one track',
      { mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.3, carriers: [{ shelf: 2 }, []] }] }] },
      /only stacks or only shelves/,
    ],
    [
      'a horizontal track of shelves',
      { mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.3, carriers: [{ shelf: 2 }, { shelf: 3 }] }] }] },
      /carries shelves, so it must be vertical/,
    ],
    [
      'an unknown shelf',
      { mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.3, carriers: [{ shelf: 2 }, { shelf: 9 }] }] }] },
      /carries shelf 9, which does not exist/,
    ],
    ['a carried shelf also in a column', { layout: { columns: [{ kind: 'shelves', shelves: [0, 1, 2] }, { kind: 'shelfTrack', track: 0 }] } }, /shelf 2 must appear in exactly one column or shelf track \(found 2\)/],
    ['a shelf track in a stack column', { layout: { columns: [{ kind: 'shelves', shelves: [0, 1] }, { kind: 'track', track: 0 }] } }, /use a shelfTrack column/],
  ];
  it.each(bad)('rejects %s', (_name, change, message) => {
    expect(() => createGame({ ...shelfTrack(), ...change })).toThrow(message);
  });
});

describe('shelves riding a track: rules', () => {
  it('takes, drops, reorders and clears triples on a moving shelf like on a fixed one', () => {
    let state = createGame(shelfTrack());
    // Reorder inside the moving shelf.
    state = apply(state, front(2, 0), front(2, 2)).state;
    // Two Bs from the fixed shelf complete BBB on the moving one.
    state = apply(state, front(1, 1), front(2, 0)).state;
    const triple = apply(state, front(1, 2), front(2, 1));
    expect(boardKinds(triple.events)).toEqual(['moved', 'tripleCleared']);
    expect(triple.events.find((e) => e.kind === 'tripleCleared')).toMatchObject({ shelf: 2 });
  });

  it('advances back layers on a moving shelf', () => {
    // S3 [C C .] back [C . .]: moving its two Cs out leaves the front empty, so the back layer comes forward.
    let state = createGame(shelfTrack());
    state = apply(state, front(3, 0), front(2, 1)).state;
    const result = apply(state, front(3, 1), front(2, 2));
    expect(boardKinds(result.events)).toEqual(['moved', 'layerAdvanced']);
    expect(result.state.shelves[3]!.layers).toHaveLength(1);
    expect(result.state.shelves[3]!.layers[0]![0]).toMatchObject({ type: 'C' });
  });

  it('counts free slots of moving shelves as space for the blocked defeat', () => {
    const state = createGame(shelfTrack());
    expect(freeFrontSlots(state, 3)).toEqual([2]);
    expect(isBlocked(state)).toBe(false);
  });

  it('takes nothing with pickFromTrack from a shelf carrier (shelves are moved with moveItem)', () => {
    expect(pickFromTrack(createGame(shelfTrack()), { track: 0, carrier: 0 })).toEqual({ ok: false, reason: 'invalidPosition' });
  });

  it('moves shelves along the track with game time, and stops when not playing', () => {
    const state = tick(startClock(createGame(shelfTrack())), 2000).state;
    expect(carrierOffset(state.tracks[0]!, 0, state.trackTimeMs)).toBeCloseTo(0.6);
  });

  it('includes moving shelves in first moves and in the one-move trap check', () => {
    const moves = firstMoves(createGame(shelfTrack()));
    expect(moves.some((m) => !isCarrierSource(m.from) && m.from.shelf === 2)).toBe(true);
    expect(moves.some((m) => m.to.shelf === 3)).toBe(true);
    expect(() => validateLevel(shelfTrack())).not.toThrow();
  });
});

describe('mechanics stack on moving shelves', () => {
  it('locks a moving shelf until N triples, then lets it give and take', () => {
    const state = createGame(shelfTrack([{ kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 1 }] }]));
    expect(moveItem(state, front(1, 1), front(2, 1))).toEqual({ ok: false, reason: 'shelfLocked' });
    expect(moveItem(state, front(2, 0), front(3, 2))).toEqual({ ok: false, reason: 'shelfLocked' });
    const unlocked = apply(state, front(1, 0), front(0, 2)); // AAA
    expect(boardKinds(unlocked.events)).toContain('shelfUnlocked');
    expect(moveItem(unlocked.state, front(1, 1), front(2, 1)).ok).toBe(true);
  });

  it('lets the roaming blocker sit on, and jump to, slots of moving shelves', () => {
    const blockerOn = (start: { shelf: number; slot: number }, seed: number) =>
      createGame(shelfTrack([{ kind: 'roamingBlocker', start, seed }]));
    const state = blockerOn({ shelf: 2, slot: 1 }, 1);
    expect(moveItem(state, front(1, 1), front(2, 1))).toEqual({ ok: false, reason: 'slotBlocked' });
    expect(freeFrontSlots(state, 2)).toEqual([2]);

    // After a triple it jumps among every empty unlocked slot, moving shelves included.
    const jumped = Array.from({ length: 30 }, (_, seed) => {
      // AAA on S0 frees S0 and triggers a jump; the blocker starts on S3's free slot.
      const s0 = blockerOn({ shelf: 3, slot: 2 }, seed);
      return apply(s0, front(1, 0), front(0, 2)).state.blocker!.at.shelf;
    });
    expect(jumped.some((shelf) => shelf === 2 || shelf === 3)).toBe(true);
    expect(jumped.some((shelf) => shelf === 0)).toBe(true);
  });

  it('keeps the layer behind a moving shelf while the blocker is on it, and advances it once it leaves', () => {
    // The blocker starts on S3's free slot; both C go to S2, leaving S3's front with only the blocker.
    const emptied = (seed: number) => {
      let state = createGame(shelfTrack([{ kind: 'roamingBlocker', start: { shelf: 3, slot: 2 }, seed }]));
      state = apply(state, front(3, 0), front(2, 1)).state;
      return apply(state, front(3, 1), front(2, 2));
    };
    const held = emptied(1);
    expect(boardKinds(held.events)).toEqual(['moved']);
    expect(held.state.shelves[3]!.layers).toHaveLength(2);

    // AAA on S0 makes the blocker jump; once it lands off S3, S3's back layer comes forward.
    const triple = (seed: number) => apply(emptied(seed).state, front(1, 0), front(0, 2));
    const away = Array.from({ length: 50 }, (_, s) => s).find((s) => triple(s).state.blocker!.at.shelf !== 3)!;
    expect(triple(away).events).toContainEqual({ kind: 'layerAdvanced', shelf: 3, remainingLayers: 1 });
    const stays = Array.from({ length: 50 }, (_, s) => s).find((s) => triple(s).state.blocker!.at.shelf === 3)!;
    expect(triple(stays).state.shelves[3]!.layers).toHaveLength(2);
  });
});

describe('simulated player and moving shelves', () => {
  it('pays extra time to drop on or take from a moving shelf, more when it moves faster', () => {
    const state = createGame(shelfTrack());
    expect(movingShelfCost(state, front(0, 0), front(1, 0))).toBe(0);
    expect(movingShelfCost(state, front(0, 0), front(2, 1))).toBeCloseTo(movingShelfSeconds(0.3));
    expect(movingShelfCost(state, front(2, 0), front(0, 2))).toBeCloseTo(movingShelfSeconds(0.3));
    expect(movingShelfSeconds(1)).toBeGreaterThan(movingShelfSeconds(0.3));
  });
});
