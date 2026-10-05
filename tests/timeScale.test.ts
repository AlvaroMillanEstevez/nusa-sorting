import { describe, expect, it } from 'vitest';
import type { LevelDefinition } from '../src/core';
import { applyTimeScale } from '../src/dev/timeScale';

const level: LevelDefinition = { id: 'timed', timeLimitSeconds: 120, shelves: [[['A', 'A', null]], [['A', null, null]]] };

describe('applyTimeScale (dev only)', () => {
  it('multiplies the time limit, rounded to whole seconds', () => {
    expect(applyTimeScale(level, '?timeScale=0.8').timeLimitSeconds).toBe(96);
    expect(applyTimeScale(level, '?level=3&timeScale=1.5').timeLimitSeconds).toBe(180);
    expect(applyTimeScale(level, '?timeScale=0.333').timeLimitSeconds).toBe(40);
  });

  it('leaves the level alone without a usable scale, or without a time limit', () => {
    for (const search of ['', '?timeScale', '?timeScale=', '?timeScale=abc', '?timeScale=0', '?timeScale=-1', '?timeScale=50']) {
      expect(applyTimeScale(level, search)).toBe(level);
    }
    const untimed: LevelDefinition = { id: 'untimed', shelves: level.shelves };
    expect(applyTimeScale(untimed, '?timeScale=0.5')).toBe(untimed);
  });
});
