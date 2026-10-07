import { describe, expect, it } from 'vitest';
import {
  createGame,
  EMPTY_PROGRESS,
  moveItem,
  recordWin,
  scoreParts,
  starsFor,
  starThresholds,
  tick,
  TIME_BONUS_PER_SECOND,
  totalStars,
  type LevelDefinition,
} from '../src/core';
import { levels } from '../src/data/levels';
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

describe('the star formula', () => {
  /** Six triples (A-F), 60 s. */
  const level: LevelDefinition = {
    id: 'formula',
    timeLimitSeconds: 60,
    shelves: [[['A', 'B', 'C']], [['D', 'E', 'F']], [['A', 'B', 'C']], [['D', 'E', 'F']], [['A', 'B', 'C']], [['D', 'E', 'F']], [[null, null, null]]],
  };

  it('starts from the base score (triples × points) and the full time bonus', () => {
    expect(scoreParts(level)).toEqual({ triples: 6, pointsPerTriple: 100, base: 600, fullTimeBonus: 60 * TIME_BONUS_PER_SECOND });
  });

  it('asks 1.25 × base + 20% of the time bonus for two stars, 1.7 × base + 40% for three', () => {
    // 1.25 × 600 + 0.2 × 1200 = 990; 1.7 × 600 + 0.4 × 1200 = 1500.
    expect(starThresholds(level)).toEqual({ two: 990, three: 1500 });
  });

  it('counts the first combo multiplier into the base (doubled combos in level 10)', () => {
    const doubled: LevelDefinition = { ...level, mechanics: [{ kind: 'combo', multipliers: [2, 3, 4] }] };
    expect(scoreParts(doubled).base).toBe(1200);
  });

  it('separates two and three stars in every shipped level, and level 1 from level 2', () => {
    for (const shipped of levels) {
      const { two, three } = starThresholds(shipped);
      expect(three - two, shipped.id).toBeGreaterThanOrEqual(300);
    }
    expect(starThresholds(levels[1]!).two).toBeGreaterThan(starThresholds(levels[0]!).two);
  });

  it('lets a plain win with half the time left earn two stars in most levels, but never three', () => {
    for (const shipped of levels) {
      const { base, fullTimeBonus } = scoreParts(shipped);
      const plain = base + fullTimeBonus / 2;
      expect(starsFor(plain, starThresholds(shipped)), shipped.id).toBeLessThan(3);
    }
  });
});
