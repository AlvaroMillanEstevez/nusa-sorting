import { describe, expect, it } from 'vitest';
import { createGame, startClock, tick, type GameState } from '../src/core';
import { levels } from '../src/data/levels';
import { layoutForLevel, liveBoard } from '../src/ui/levelLayout';

/**
 * CrazyGames asks for the same behaviour at any refresh rate (60, 144, 165 Hz): the clock, the tracks and the
 * combo window advance by the time elapsed, never by frames. Ten seconds ticked in frames of each rate must
 * end in the same state.
 */
const RATES = [60, 144, 165];
const SECONDS = 10;

function run(state: GameState, hz: number): GameState {
  const frame = 1000 / hz;
  for (let i = 0; i < SECONDS * hz; i++) state = tick(state, frame).state;
  return state;
}

describe('refresh rates', () => {
  // A fast belt with combos doubled (25), the roaming blocker on a belt (29), two tracks of shelves (40).
  it.each([25, 29, 40])('level %i plays the same at 60, 144 and 165 Hz', (n) => {
    const level = levels[n - 1]!;
    const start = startClock(createGame(level));
    // A combo window running, as after a triple.
    const started: GameState = { ...start, combo: { ...start.combo, combo: 2, windowLeftMs: 4000 } };
    const [a, ...others] = RATES.map((hz) => run(started, hz));
    for (const b of others) {
      expect(b.timeLeftMs!).toBeCloseTo(a!.timeLeftMs!, 3);
      expect(b.trackTimeMs).toBeCloseTo(a!.trackTimeMs, 3);
      expect(b.combo.windowLeftMs).toBeCloseTo(a!.combo.windowLeftMs, 3);
      expect(b.combo.combo).toBe(a!.combo.combo);
      expect(b.status).toBe(a!.status);
    }
    // Where the tracks' carriers are follows from the time alone.
    const layout = layoutForLevel(level, start, 1080, 607);
    const where = (state: GameState) => JSON.stringify(liveBoard(layout, state).layout, (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
    for (const b of others) expect(where(b)).toBe(where(a!));
  });
});
