/** Moments that vibrate the device briefly. */
export type Haptic = 'triple' | 'combo' | 'lose';

/** Vibration boundary. Scenes ask for a moment by name and never touch device APIs directly. */
export interface HapticsService {
  readonly enabled: boolean;
  /** Whether the device can vibrate at all (the setting is only offered where it can). */
  readonly supported: boolean;
  setEnabled(enabled: boolean): void;
  pulse(haptic: Haptic): void;
}

/** Vibration patterns in ms (on, off, on...): short enough never to get in the way. */
export const HAPTIC_PATTERNS: Readonly<Record<Haptic, number | readonly number[]>> = {
  triple: 12,
  combo: [18, 40, 28],
  lose: [40, 60, 40, 60, 80],
};

type Vibrate = (pattern: number | number[]) => boolean;

/**
 * Vibrates through the Vibration API (Android browsers). Where it does not exist (iOS Safari, most computers)
 * or throws, it does nothing.
 */
export class WebHapticsService implements HapticsService {
  private on = true;
  private readonly vibrate: Vibrate | null;

  constructor(nav: { vibrate?: unknown } | undefined = typeof navigator === 'undefined' ? undefined : navigator) {
    const vibrate = nav?.vibrate;
    this.vibrate = typeof vibrate === 'function' ? (pattern) => (vibrate as Vibrate).call(nav, pattern) : null;
  }

  get enabled(): boolean {
    return this.on;
  }

  get supported(): boolean {
    return this.vibrate !== null;
  }

  setEnabled(enabled: boolean): void {
    this.on = enabled;
  }

  pulse(haptic: Haptic): void {
    if (!this.on || !this.vibrate) return;
    const pattern = HAPTIC_PATTERNS[haptic];
    try {
      this.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
    } catch {
      // Some browsers throw outside a user gesture or in iframes: no vibration then.
    }
  }
}

export class NoopHapticsService implements HapticsService {
  enabled = true;
  readonly supported = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  pulse(_haptic: Haptic): void {}
}
