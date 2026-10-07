import { describe, expect, it } from 'vitest';
import { formatTime } from '../src/ui/format';

describe('formatTime', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatTime(90_000)).toBe('1:30');
    expect(formatTime(5_000)).toBe('0:05');
    expect(formatTime(600_000)).toBe('10:00');
  });

  it('rounds up partial seconds and never goes negative', () => {
    expect(formatTime(4_001)).toBe('0:05');
    expect(formatTime(1)).toBe('0:01');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-500)).toBe('0:00');
  });
});

describe('formatScore', () => {
  it('groups thousands as each language writes them', async () => {
    const { formatScore } = await import('../src/ui/format');
    expect(formatScore(12450, 'en')).toBe('12,450');
    expect(formatScore(12450, 'id')).toBe('12.450');
    expect(formatScore(950, 'id')).toBe('950');
  });
});
