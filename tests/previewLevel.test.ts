import { describe, expect, it } from 'vitest';
import { createGame, dropHeld, moveItem, pickFromTrack, startClock, tick, validateLevel, type GameState } from '../src/core';
import { previewLevel } from '../src/dev/previewLevel';
import { isBeltSource, suggestedMove } from '../tools/simulator';

describe('the preview video board', () => {
  it('is valid, and the autoplay wins it quickly with a long combo, belt picks, a fresh and a spoiled triple and both closing shelves closed', () => {
    expect(() => validateLevel(previewLevel)).not.toThrow();
    let state: GameState = startClock(createGame(previewLevel));
    let moves = 0;
    let beltPicks = 0;
    let maxCombo = 0;
    const freshness: string[] = [];
    while (state.status === 'playing' && moves < 30) {
      const move = suggestedMove(state);
      expect(move).not.toBeNull();
      const [from, to] = move!;
      let result;
      if (isBeltSource(from)) {
        beltPicks++;
        const picked = pickFromTrack(state, from);
        result = picked.ok ? dropHeld(picked.state, to) : picked;
      } else {
        result = moveItem(state, from, to);
      }
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      moves++;
      for (const e of result.events) if (e.kind === 'tripleCleared' && e.freshness) freshness.push(e.freshness);
      maxCombo = Math.max(maxCombo, result.state.combo.combo);
      // A move every 0.65 s, as the autoplay plays it.
      state = tick(result.state, 650).state;
    }
    expect(state.status).toBe('won');
    // Its whole game fits the video's ten seconds of play.
    expect(moves).toBeLessThanOrEqual(14);
    expect(freshness).toContain('fresh');
    expect(freshness).toContain('spoiled');
    expect(beltPicks).toBeGreaterThanOrEqual(3);
    expect(maxCombo).toBeGreaterThanOrEqual(5);
    expect(state.closed.filter(Boolean)).toHaveLength(2);
  });
});
