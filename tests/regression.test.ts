import { describe, expect, it } from 'vitest';
import { createGame, moveItem, tick, type GameEvent, type LevelDefinition } from '../src/core';
import { levels } from '../src/data/levels';
import fixture from './fixtures/regression-v1.json';
import fixtureV2 from './fixtures/regression-v2.json';

/**
 * Golden recording made with the core as it was before level mechanics existed (tests/fixtures/regression-v1.json):
 * per level, the solver's solution (played untimed) plus random and blocked games, each move followed by a
 * 2.5 s tick. Levels without mechanics must replay with exactly the same events, statuses and timers.
 */
interface Step {
  from: [number, number];
  to: [number, number];
  events: GameEvent[];
  tickEvents: GameEvent[];
  status: string;
  timeLeftMs: number | null;
}

const untimed = ({ id, shelves }: LevelDefinition): LevelDefinition => ({ id, shelves });

describe.each(fixture.map((entry, i) => [entry.level, i] as const))('regression: %s', (_id, index) => {
  const level = levels[index]!;
  const games = fixture[index]!.games as unknown as Step[][];

  it.each(games.map((game, g) => [g, game] as const))('game %i replays identically', (g, steps) => {
    let state = createGame(g === 0 ? untimed(level) : level);
    for (const step of steps) {
      const result = moveItem(
        state,
        { shelf: step.from[0], layer: 0, slot: step.from[1] },
        { shelf: step.to[0], layer: 0, slot: step.to[1] },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toEqual(step.events);
      const ticked = tick(result.state, 2500);
      expect(ticked.events).toEqual(step.tickEvents);
      state = ticked.state;
      expect(state.status).toBe(step.status);
      expect(state.timeLeftMs).toBe(step.timeLeftMs);
    }
  });
});

/**
 * Second golden recording (tests/fixtures/regression-v2.json), made before the conveyor existed: the mechanic
 * levels 4-7 played by a greedy and a random player with 2.5 s or 1.2 s ticks. Besides events, statuses and
 * timers it pins triple counts, combo/score state and the blocker, so new mechanics cannot change these levels.
 * Levels 5 and 6 were re-recorded after a one-item change that removed their one-move traps; 4 and 7 are original.
 */
interface StepV2 extends Step {
  tickMs: number;
  triplesCleared: number;
  combo: unknown;
  blocker: unknown;
}

describe.each(fixtureV2.map((entry) => [entry.level, entry] as const))('regression v2: %s', (id, entry) => {
  const level = levels.find((l) => l.id === id)!;
  const games = entry.games as unknown as StepV2[][];

  it.each(games.map((game, g) => [g, game] as const))('game %i replays identically', (_g, steps) => {
    let state = createGame(level);
    for (const step of steps) {
      const result = moveItem(
        state,
        { shelf: step.from[0], layer: 0, slot: step.from[1] },
        { shelf: step.to[0], layer: 0, slot: step.to[1] },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toEqual(step.events);
      const ticked = tick(result.state, step.tickMs);
      expect(ticked.events).toEqual(step.tickEvents);
      state = ticked.state;
      expect(state.status).toBe(step.status);
      expect(state.timeLeftMs).toBe(step.timeLeftMs);
      expect(state.triplesCleared).toBe(step.triplesCleared);
      expect(state.combo).toEqual(step.combo);
      expect(state.blocker).toEqual(step.blocker);
    }
  });
});
