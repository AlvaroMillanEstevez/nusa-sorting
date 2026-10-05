import type { LevelDefinition } from '../core';

/**
 * Development only: `?timeScale=0.8` multiplies the time limit of every level, so Koke can try different
 * paces while playing. Values from 0.1 to 10; anything else, or an untimed level, leaves the level as it is.
 * The result is rounded to whole seconds (at least one).
 */
export function applyTimeScale(level: LevelDefinition, search: string): LevelDefinition {
  const raw = new URLSearchParams(search).get('timeScale');
  const scale = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 10 || level.timeLimitSeconds === undefined) return level;
  return { ...level, timeLimitSeconds: Math.max(1, Math.round(level.timeLimitSeconds * scale)) };
}
