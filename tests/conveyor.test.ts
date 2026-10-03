import { describe, expect, it } from 'vitest';
import {
  beltSlotOffset,
  countItems,
  createGame,
  dropHeld,
  isBlocked,
  LevelError,
  moveItem,
  pickFromBelt,
  returnHeld,
  tick,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type Position,
} from '../src/core';
import { front } from './helpers';

const belt = (slots: (string | null)[], speed = 1): MechanicDefinition => ({ kind: 'conveyor', slots, speed });

/** S0 [A A .]   S1 [B B .]   belt [A . B .] */
const basic: LevelDefinition = {
  id: 'belt-basic',
  shelves: [[['A', 'A', null]], [['B', 'B', null]]],
  mechanics: [belt(['A', null, 'B', null])],
};

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

const pickAndDrop = (state: GameState, beltSlot: number, to: Position) =>
  ok(dropHeld(ok(pickFromBelt(state, beltSlot)).state, to));

describe('conveyor level format', () => {
  it('counts belt items for the multiple-of-3 rule', () => {
    expect(() => createGame(basic)).not.toThrow();
    expect(() => createGame({ ...basic, mechanics: [belt(['A', null, null, null])] })).toThrow(/"B" appears 2 times/);
    expect(countItems(createGame(basic))).toBe(6);
  });

  it('gives belt items ids after the shelf items, so shelf ids do not change', () => {
    const withBelt = createGame(basic);
    const shelfIds = withBelt.shelves.flatMap((s) => s.layers.flat()).flatMap((i) => (i ? [i.id] : []));
    expect(shelfIds).toEqual([1, 2, 3, 4]);
    expect(withBelt.conveyor!.slots.map((i) => i?.id ?? null)).toEqual([5, null, 6, null]);
  });

  // Shelves that are complete on their own, so each case fails only for the belt rule it breaks.
  const complete: LevelDefinition['shelves'] = [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]];
  const invalid: [string, MechanicDefinition, RegExp][] = [
    ['no slots', belt([]), /between 1 and 12 slots/],
    ['too many slots', belt(['C', 'C', 'C', ...Array<null>(10).fill(null)]), /between 1 and 12 slots/],
    ['zero speed', belt(['C', 'C', 'C'], 0), /speed/],
    ['too fast', belt(['C', 'C', 'C'], 5), /speed/],
    ['NaN speed', belt(['C', 'C', 'C'], Number.NaN), /speed/],
  ];
  it.each(invalid)('rejects %s', (_name, mechanic, message) => {
    expect(() => createGame({ id: 'x', shelves: complete, mechanics: [mechanic] })).toThrow(LevelError);
    expect(() => createGame({ id: 'x', shelves: complete, mechanics: [mechanic] })).toThrow(message);
  });

  it('rejects an empty belt and a second belt', () => {
    expect(() =>
      createGame({ id: 'x', shelves: [[['A', 'A', 'B']], [['B', 'B', 'A']], [[null, null, null]]], mechanics: [belt([null, null])] }),
    ).toThrow(/at least one item/);
    expect(() => createGame({ ...basic, mechanics: [belt(['A', null, 'B']), belt([null])] })).toThrow(/only once/);
  });
});

describe('belt movement', () => {
  it('is a deterministic function of game time, looping around', () => {
    let state = createGame({ ...basic, mechanics: [belt(['A', null, 'B', null], 0.5)] });
    expect(beltSlotOffset(state.conveyor!, 0)).toBe(0);
    state = tick(state, 1000).state;
    expect(beltSlotOffset(state.conveyor!, 0)).toBeCloseTo(0.5);
    expect(beltSlotOffset(state.conveyor!, 3)).toBeCloseTo(3.5);
    state = tick(state, 2000).state;
    // Slot 3 has gone past the end (K = 4) and reappeared at the start.
    expect(beltSlotOffset(state.conveyor!, 3)).toBeCloseTo(0.5);
  });

  it('moves left with a negative speed and wraps the other way', () => {
    const state = tick(createGame({ ...basic, mechanics: [belt(['A', null, 'B', null], -1)] }), 1500).state;
    expect(beltSlotOffset(state.conveyor!, 0)).toBeCloseTo(2.5);
    expect(beltSlotOffset(state.conveyor!, 2)).toBeCloseTo(0.5);
  });

  it('stops when the game is not being played', () => {
    const won = pickAndDrop(pickAndDrop(createGame(basic), 0, front(0, 2)).state, 2, front(1, 2)).state;
    expect(won.status).toBe('won');
    expect(tick(won, 5000).state).toBe(won);

    const timed = createGame({ ...basic, timeLimitSeconds: 1 });
    const lost = tick(timed, 1000).state;
    expect(lost.status).toBe('lost');
    expect(tick(lost, 5000).state.conveyor!.elapsedMs).toBe(lost.conveyor!.elapsedMs);
  });
});

describe('taking items from the belt', () => {
  it('lifts the item, leaving its slot empty and still moving', () => {
    const state = createGame(basic);
    const picked = ok(pickFromBelt(state, 0));
    expect(picked.events).toEqual([{ kind: 'beltItemTaken', itemId: 5, beltSlot: 0 }]);
    expect(picked.state.conveyor!.slots[0]).toBeNull();
    expect(picked.state.conveyor!.held).toEqual({ item: { id: 5, type: 'A' }, beltSlot: 0 });
    // Held items still count: picking does not win or lose anything.
    expect(countItems(picked.state)).toBe(6);
    const later = tick(picked.state, 750).state;
    expect(beltSlotOffset(later.conveyor!, 0)).toBeCloseTo(0.75);
  });

  it('rejects empty slots, a second pick, missing belts and finished games without changing the state', () => {
    const state = createGame(basic);
    const snapshot = structuredClone(state);
    expect(pickFromBelt(state, 1)).toEqual({ ok: false, reason: 'beltSlotEmpty' });
    expect(pickFromBelt(state, 9)).toEqual({ ok: false, reason: 'invalidPosition' });
    expect(state).toEqual(snapshot);
    const holding = ok(pickFromBelt(state, 0)).state;
    expect(pickFromBelt(holding, 2)).toEqual({ ok: false, reason: 'alreadyHolding' });
    expect(pickFromBelt(createGame({ id: 'plain', shelves: basic.shelves.slice(0, 1).concat([[['A', 'B', 'B']], [['B', null, null]]]) }), 0)).toEqual({
      ok: false,
      reason: 'noConveyor',
    });
    expect(returnHeld(state)).toEqual({ ok: false, reason: 'nothingHeld' });
    expect(dropHeld(state, front(0, 2))).toEqual({ ok: false, reason: 'nothingHeld' });
  });

  it('places the held item like a normal move, forming triples, and wins when the belt is empty too', () => {
    const first = pickAndDrop(createGame(basic), 0, front(0, 2));
    expect(first.events.map((e) => e.kind)).toEqual(['beltItemPlaced', 'tripleCleared']);
    expect(first.events[0]).toEqual({ kind: 'beltItemPlaced', itemId: 5, beltSlot: 0, to: front(0, 2) });
    expect(first.state.status).toBe('playing');
    const second = pickAndDrop(first.state, 2, front(1, 2));
    expect(second.events.map((e) => e.kind)).toEqual(['beltItemPlaced', 'tripleCleared', 'won']);
  });

  it('keeps holding after an invalid drop, then returns the item to its slot wherever the belt is', () => {
    let state = ok(pickFromBelt(createGame(basic), 0)).state;
    const snapshot = structuredClone(state);
    expect(dropHeld(state, front(0, 0))).toEqual({ ok: false, reason: 'targetOccupied' });
    expect(dropHeld(state, { shelf: 0, layer: 1, slot: 2 })).toEqual({ ok: false, reason: 'invalidPosition' });
    expect(dropHeld(state, front(5, 0))).toEqual({ ok: false, reason: 'invalidPosition' });
    expect(state).toEqual(snapshot);

    state = tick(state, 1250).state;
    const returned = ok(returnHeld(state));
    expect(returned.events).toEqual([{ kind: 'beltItemReturned', itemId: 5, beltSlot: 0 }]);
    expect(returned.state.conveyor!.slots[0]).toEqual({ id: 5, type: 'A' });
    expect(returned.state.conveyor!.held).toBeNull();
    expect(beltSlotOffset(returned.state.conveyor!, 0)).toBeCloseTo(1.25);
  });

  it('respects locked shelves and blocked slots when dropping', () => {
    const level: LevelDefinition = {
      id: 'belt-obstacles',
      shelves: [[['A', 'A', null]], [['B', 'B', null]], [['C', 'C', null]]],
      mechanics: [
        { kind: 'combo' },
        { kind: 'lockedShelves', shelves: [{ shelf: 1, triplesRequired: 1 }] },
        { kind: 'roamingBlocker', start: { shelf: 2, slot: 2 }, seed: 1 },
        belt(['A', 'B', 'C']),
      ],
    };
    const holding = ok(pickFromBelt(createGame(level), 1)).state;
    expect(dropHeld(holding, front(1, 2))).toEqual({ ok: false, reason: 'shelfLocked' });
    const holdingC = ok(pickFromBelt(createGame(level), 2)).state;
    expect(dropHeld(holdingC, front(2, 2))).toEqual({ ok: false, reason: 'slotBlocked' });
  });

  it('never accepts items: moves can only target shelves', () => {
    // There is no belt Position; the only ways onto the belt are returning a held item to its own slot.
    const state = createGame(basic);
    expect(moveItem(state, front(0, 0), { shelf: 2, layer: 0, slot: 0 })).toEqual({ ok: false, reason: 'invalidPosition' });
  });
});

describe('belt and the end of the game', () => {
  it('forms no triples on the belt', () => {
    const state = createGame({
      id: 'belt-triple',
      shelves: [[['B', 'B', null]], [['B', null, null]]],
      mechanics: [belt(['A', 'A', 'A'])],
    });
    const later = tick(state, 10_000);
    expect(later.events).toEqual([]);
    expect(later.state.conveyor!.slots.every((slot) => slot?.type === 'A')).toBe(true);
  });

  it('counts the belt as a source but never as free space', () => {
    /*
     * S0 [A B .]   S1 [C C A]   belt [C A B B]
     * Dropping C into the last free slot fills every shelf without a triple: blocked, though the belt still has items.
     */
    const state = createGame({
      id: 'belt-blocked',
      shelves: [[['A', 'B', null]], [['C', 'C', 'A']]],
      mechanics: [belt(['C', 'A', 'B', 'B'])],
    });
    expect(isBlocked(state)).toBe(false);
    const result = pickAndDrop(state, 0, front(0, 2));
    expect(result.state).toMatchObject({ status: 'lost', loseReason: 'blocked' });
    expect(result.events.at(-1)).toEqual({ kind: 'lost', reason: 'blocked' });
    expect(result.state.conveyor!.slots.filter(Boolean)).toHaveLength(3);
  });

  it('lets a single shelf with free space start unblocked when the belt can feed it', () => {
    const level = (mechanics: MechanicDefinition[]): LevelDefinition => ({
      id: 'belt-feeds',
      shelves: [
        [
          ['A', 'A', null],
          ['B', 'B', 'B'],
        ],
      ],
      mechanics,
    });
    const state = createGame(level([belt(['A'])]));
    const result = pickAndDrop(state, 0, front(0, 2));
    expect(result.events.map((e) => e.kind)).toEqual(['beltItemPlaced', 'tripleCleared', 'layerAdvanced', 'tripleCleared', 'won']);
  });
});
