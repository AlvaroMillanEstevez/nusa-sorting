/** How urgent the clock looks: normal, running low (amber, once), or the last seconds (red, beating). */
export type TimeStage = 'normal' | 'low' | 'critical';

/** The last seconds: the clock turns red, beats and ticks every second. */
export const CRITICAL_TIME_MS = 10_000;
/** Time is running low at 30 seconds left, or at a third of the level's time if that comes later. */
export const LOW_TIME_MS = 30_000;

export function lowTimeThresholdMs(totalMs: number): number {
  return Math.min(LOW_TIME_MS, totalMs / 3);
}

export function timeStage(timeLeftMs: number, totalMs: number): TimeStage {
  if (timeLeftMs <= CRITICAL_TIME_MS) return 'critical';
  if (timeLeftMs <= lowTimeThresholdMs(totalMs)) return 'low';
  return 'normal';
}
