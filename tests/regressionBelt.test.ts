import { describe, expect, it } from 'vitest';
import { createGame, dropHeld, moveItem, pickFromBelt, returnHeld, tick, type GameState, type MoveResult } from '../src/core';
import { levels } from '../src/data/levels';
import { computeBoardLayout } from '../src/ui/boardLayout';
import fixture from './fixtures/regression-v3.json';
import layoutsFixture from './fixtures/layouts-v1.json';

/**
 * Golden recordings made before the belt became a set of tracks with stacks (tests/fixtures/regression-v3.json):
 * levels 8 and 9 played by the solver, random and greedy players, with belt picks, drops, invalid drops and
 * returns, and ticks. All belt calls go through this adapter, so a new belt API only needs a new adapter.
 */
const belt = {
  pick: (state: GameState, slot: number): MoveResult => pickFromBelt(state, slot),
  drop: (state: GameState, shelf: number, slot: number): MoveResult => dropHeld(state, { shelf, layer: 0, slot }),
  back: (state: GameState): MoveResult => returnHeld(state),
  /** Events as the recording names them. */
  events: (events: readonly unknown[]): unknown[] => [...events],
  snapshot: (s: GameState) => ({
    status: s.status,
    loseReason: s.loseReason,
    timeLeftMs: s.timeLeftMs,
    triplesCleared: s.triplesCleared,
    belt: s.conveyor
      ? {
          slots: s.conveyor.slots.map((i) => i?.id ?? null),
          elapsedMs: s.conveyor.elapsedMs,
          held: s.conveyor.held ? { id: s.conveyor.held.item.id, beltSlot: s.conveyor.held.beltSlot } : null,
        }
      : null,
    shelves: s.shelves.map((sh) => sh.layers.map((l) => l.map((i) => i?.id ?? null))),
  }),
};

type Action =
  | { kind: 'move'; from: [number, number]; to: [number, number] }
  | { kind: 'pick'; belt: number }
  | { kind: 'drop'; to: [number, number] }
  | { kind: 'return' }
  | { kind: 'tick'; ms: number };
interface Step {
  action: Action;
  ok: boolean;
  events: unknown[];
  after: unknown;
}

describe.each(fixture.map((entry) => [entry.level, entry] as const))('belt regression: %s', (id, entry) => {
  const level = levels.find((l) => l.id === id)!;
  it.each((entry.games as unknown as Step[][]).map((game, g) => [g, game] as const))('game %i replays identically', (_g, steps) => {
    let state = createGame(level);
    for (const { action, ok, events, after } of steps) {
      let result: MoveResult;
      if (action.kind === 'move') {
        result = moveItem(state, { shelf: action.from[0], layer: 0, slot: action.from[1] }, { shelf: action.to[0], layer: 0, slot: action.to[1] });
      } else if (action.kind === 'pick') result = belt.pick(state, action.belt);
      else if (action.kind === 'drop') result = belt.drop(state, action.to[0], action.to[1]);
      else if (action.kind === 'return') result = belt.back(state);
      else {
        const ticked = tick(state, action.ms);
        result = { ok: true, state: ticked.state, events: ticked.events };
      }
      expect(result.ok).toBe(ok);
      if (result.ok) {
        state = result.state;
        expect(belt.events(result.events)).toEqual(events);
      } else {
        expect([result.reason]).toEqual(events);
      }
      expect(belt.snapshot(state)).toEqual(after);
    }
  });
});

/** Layouts of levels 1-9 as they were before column layouts existed (tests/fixtures/layouts-v1.json). */
describe('automatic layout is unchanged', () => {
  it.each(layoutsFixture.map((entry) => [entry.level, entry] as const))('%s', (id, entry) => {
    const level = levels.find((l) => l.id === id)!;
    const state = createGame(level);
    for (const { w, h, layout } of entry.layouts) {
      const now = computeBoardLayout(w, h, level.shelves.length, 3, state.combo !== null, state.conveyor?.slots.length ?? 0);
      expect(JSON.parse(JSON.stringify(now))).toEqual(layout);
    }
  });
});
