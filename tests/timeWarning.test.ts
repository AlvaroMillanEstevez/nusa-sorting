import { describe, expect, it } from 'vitest';
import { lowTimeThresholdMs, timeStage } from '../src/ui/timeWarning';

describe('time warnings', () => {
  it('warns at 30 s left, or at a third of the time on shorter levels', () => {
    expect(lowTimeThresholdMs(180_000)).toBe(30_000);
    expect(lowTimeThresholdMs(90_000)).toBe(30_000);
    expect(lowTimeThresholdMs(60_000)).toBe(20_000);
  });

  it('goes from normal to low to critical in the last 10 s', () => {
    expect(timeStage(31_000, 120_000)).toBe('normal');
    expect(timeStage(30_000, 120_000)).toBe('low');
    expect(timeStage(10_001, 120_000)).toBe('low');
    expect(timeStage(10_000, 120_000)).toBe('critical');
    expect(timeStage(25_000, 60_000)).toBe('normal');
    expect(timeStage(20_000, 60_000)).toBe('low');
  });

  it('skips the low stage when a third of the level is within the last 10 s', () => {
    expect(timeStage(11_000, 24_000)).toBe('normal');
    expect(timeStage(9_000, 24_000)).toBe('critical');
  });
});
