import { describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS, firstIncomplete, isUnlocked, recordWin, type Progress } from '../src/core';

const ids = ['a', 'b', 'c', 'd'];

describe('unlocking', () => {
  it('opens only the first level with no progress', () => {
    expect(ids.map((_, i) => isUnlocked(EMPTY_PROGRESS, ids, i))).toEqual([true, false, false, false]);
    expect(isUnlocked(EMPTY_PROGRESS, ids, 9)).toBe(false);
  });

  it('opens the next level once one is completed', () => {
    const progress: Progress = { completed: ['a', 'b'], bestScores: {} };
    expect(ids.map((_, i) => isUnlocked(progress, ids, i))).toEqual([true, true, true, false]);
  });

  it('works by level id, so reordering or inserting levels keeps progress', () => {
    const progress: Progress = { completed: ['a', 'b'], bestScores: {} };
    // A new level 'x' inserted after 'a', and 'b' moved to the end.
    const reordered = ['a', 'x', 'c', 'b'];
    expect(reordered.map((_, i) => isUnlocked(progress, reordered, i))).toEqual([true, true, false, true]);
    expect(firstIncomplete(progress, reordered)).toBe(1);
  });
});

describe('where to start', () => {
  it('is the first level not completed, or null when all are done', () => {
    expect(firstIncomplete(EMPTY_PROGRESS, ids)).toBe(0);
    expect(firstIncomplete({ completed: ['a', 'c'], bestScores: {} }, ids)).toBe(1);
    expect(firstIncomplete({ completed: ids, bestScores: {} }, ids)).toBeNull();
  });

  it('ignores completed ids of levels that no longer exist', () => {
    expect(firstIncomplete({ completed: ['gone', 'a'], bestScores: {} }, ids)).toBe(1);
  });
});

describe('recording a win', () => {
  it('marks the level completed once and keeps the best score', () => {
    const first = recordWin(EMPTY_PROGRESS, 'a', 500);
    expect(first).toMatchObject({ newBest: false, best: 500, firstClear: true });
    expect(first.progress).toEqual({ completed: ['a'], bestScores: { a: 500 } });

    const better = recordWin(first.progress, 'a', 800);
    expect(better).toMatchObject({ newBest: true, best: 800, firstClear: false });
    expect(better.progress.completed).toEqual(['a']);

    const worse = recordWin(better.progress, 'a', 300);
    expect(worse).toMatchObject({ newBest: false, best: 800 });
    expect(worse.progress.bestScores.a).toBe(800);
  });

  it('records levels without a score as completed only', () => {
    const result = recordWin(EMPTY_PROGRESS, 'b', null);
    expect(result).toMatchObject({ newBest: false, best: null, firstClear: true });
    expect(result.progress).toEqual({ completed: ['b'], bestScores: {} });
  });

  it('does not change the progress it was given', () => {
    const progress: Progress = { completed: ['a'], bestScores: { a: 100 } };
    const snapshot = structuredClone(progress);
    recordWin(progress, 'a', 900);
    recordWin(progress, 'b', 50);
    expect(progress).toEqual(snapshot);
  });
});
