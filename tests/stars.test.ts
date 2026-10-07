import { describe, expect, it } from 'vitest';
import {
  createGame,
  EMPTY_PROGRESS,
  LevelError,
  moveItem,
  recordWin,
  starsFor,
  tick,
  TIME_BONUS_PER_SECOND,
  totalStars,
  type LevelDefinition,
} from '../src/core';
import { front } from './helpers';

/** S0 [A A .]   S1 [A . .]: one move wins. */
const oneMove = (timeLimitSeconds?: number): LevelDefinition => ({
  id: 'one-move',
  shelves: [[['A', 'A', null]], [['A', null, null]]],
  ...(timeLimitSeconds === undefined ? {} : { timeLimitSeconds }),
});

describe('time bonus', () => {
  it('adds points for every whole second left when a timed level is won', () => {
    let state = createGame(oneMove(60));
    state = tick({ ...state, clockStarted: true }, 12_400).state;
    const result = moveItem(state, front(1, 0), front(0, 2));
    if (!result.ok) throw new Error(result.reason);
    // 47.6 s left: 47 whole seconds.
    const bonus = 47 * TIME_BONUS_PER_SECOND;
    expect(result.events).toContainEqual({ kind: 'timeBonus', seconds: 47, points: bonus, score: 100 + bonus });
    expect(result.state.combo.score).toBe(100 + bonus);
    const kinds = result.events.map((e) => e.kind);
    expect(kinds.indexOf('timeBonus')).toBeLessThan(kinds.indexOf('won'));
  });

  it('gives nothing in an untimed level, or when the level is lost', () => {
    const result = moveItem(createGame(oneMove()), front(1, 0), front(0, 2));
    expect(result.ok && result.events.some((e) => e.kind === 'timeBonus')).toBe(false);
    expect(result.ok && result.state.combo.score).toBe(100);
  });
});

describe('stars', () => {
  const thresholds = { two: 1000, three: 1600 };

  it('gives one star for any win, two and three from the level thresholds', () => {
    expect(starsFor(0, thresholds)).toBe(1);
    expect(starsFor(999, thresholds)).toBe(1);
    expect(starsFor(1000, thresholds)).toBe(2);
    expect(starsFor(1599, thresholds)).toBe(2);
    expect(starsFor(1600, thresholds)).toBe(3);
    expect(starsFor(99_999, undefined)).toBe(1);
  });

  it('rejects thresholds that are not positive whole numbers with three above two', () => {
    for (const stars of [{ two: 0, three: 10 }, { two: 500, three: 500 }, { two: 10.5, three: 20 }]) {
      expect(() => createGame({ ...oneMove(), stars })).toThrow(LevelError);
    }
    expect(() => createGame({ ...oneMove(), stars: thresholds })).not.toThrow();
  });

  it('keeps the most stars of each level and counts them all', () => {
    let record = recordWin(EMPTY_PROGRESS, 'a', 900, 2);
    expect(record).toMatchObject({ bestStars: 2, moreStars: true });
    record = recordWin(record.progress, 'a', 1200, 1);
    expect(record).toMatchObject({ bestStars: 2, moreStars: false });
    record = recordWin(record.progress, 'a', 800, 3);
    expect(record).toMatchObject({ bestStars: 3, moreStars: true });
    record = recordWin(record.progress, 'b', 500, 1);
    expect(record.progress.bestStars).toEqual({ a: 3, b: 1 });
    expect(totalStars(record.progress)).toBe(4);
  });
});

describe('star thresholds from the simulator', () => {
  it('puts two stars at the median and three at the 85th percentile of the expert wins, rounded to 10', async () => {
    const { starThresholds } = await import('../tools/levelgen/generate');
    const scores = Array.from({ length: 100 }, (_, i) => 1000 + i * 10);
    expect(starThresholds([scores.slice(0, 50), scores.slice(50)])).toEqual({ two: 1500, three: 1850 });
    // Too few distinct scores still give three above two.
    expect(starThresholds([[700, 700, 700]])).toEqual({ two: 700, three: 710 });
    expect(starThresholds([[], []])).toBeNull();
  });
});
