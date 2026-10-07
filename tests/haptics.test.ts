import { describe, expect, it } from 'vitest';
import { HAPTIC_PATTERNS, WebHapticsService } from '../src/services/HapticsService';

describe('haptics', () => {
  it('vibrates with each moment’s pattern while enabled', () => {
    const calls: unknown[] = [];
    const haptics = new WebHapticsService({ vibrate: (p: unknown) => (calls.push(p), true) });
    expect(haptics.supported).toBe(true);
    haptics.pulse('triple');
    haptics.pulse('lose');
    expect(calls).toEqual([HAPTIC_PATTERNS.triple, [...(HAPTIC_PATTERNS.lose as number[])]]);
    haptics.setEnabled(false);
    haptics.pulse('combo');
    expect(calls).toHaveLength(2);
  });

  it('does nothing where the Vibration API is missing (iOS Safari) or throws', () => {
    const missing = new WebHapticsService({});
    expect(missing.supported).toBe(false);
    expect(() => missing.pulse('triple')).not.toThrow();
    const throwing = new WebHapticsService({ vibrate: () => { throw new Error('blocked'); } });
    expect(() => throwing.pulse('lose')).not.toThrow();
    expect(() => new WebHapticsService(undefined).pulse('combo')).not.toThrow();
  });
});
