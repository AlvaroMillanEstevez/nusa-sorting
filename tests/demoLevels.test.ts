import { describe, expect, it } from 'vitest';
import { countItems, createGame, isWon, tick, validateLevel, type GameState } from '../src/core';
import { validateLevelLayout } from '../src/ui/levelLayout';
import { applyMove, solve } from './helpers';
import { demoLevels } from './fixtures/demo-levels';

/**
 * The demo levels left the game but stay as fixtures: golden recordings and mechanic tests play them, so they
 * must remain valid and solvable.
 */
describe.each(demoLevels.map((level) => [level.id, level] as const))('demo level %s', (_id, level) => {
  it('is valid, with no first move that loses on the spot, and fits a phone', () => {
    expect(() => validateLevel(level)).not.toThrow();
    expect(() => validateLevelLayout(level)).not.toThrow();
  });

  it('is solvable even if the player never chains a combo', () => {
    const start = createGame(level);
    const solution = solve(start);
    expect(solution).toBeDefined();
    // Replay as the solver assumed: no clock, and every combo window runs out between moves.
    let state: GameState = { ...start, timeLeftMs: null };
    for (const move of solution!) {
      const result = applyMove(state, move);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = state.combo ? tick(result.state, state.combo.windowMs).state : result.state;
    }
    expect(isWon(state)).toBe(true);
    expect(countItems(state)).toBe(0);
  }, 60_000);
});
