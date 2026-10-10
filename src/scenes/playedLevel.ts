import { arrangementCount, withArrangement, type LevelDefinition } from '../core';
import { restoreSnapshot, type RestoredGame } from '../core/snapshot';
import { applyBeltOverrides } from '../dev/beltOverrides';
import { applyTimeScale } from '../dev/timeScale';
import { playList } from './playList';

/** The level at `index` as it is played: with arrangement `arrangement`, and in development the URL's tuning. */
export function playedLevel(index: number, arrangement: number): LevelDefinition {
  const level = withArrangement(playList[index]!.level, arrangement);
  // Development only: ?beltSpeed= and ?beltSlots= retune the conveyor, ?timeScale= the time limit.
  return import.meta.env.DEV ? applyTimeScale(applyBeltOverrides(level, window.location.search), window.location.search) : level;
}

/** A level in progress picked up from the save. */
export interface ResumedLevel extends RestoredGame {
  readonly levelIndex: number;
  readonly arrangement: number;
  readonly level: LevelDefinition;
}

/**
 * The level in progress a saved snapshot holds, if it still fits the game (same level, same arrangement, same
 * format); null otherwise. Never throws.
 */
export function resumeFromSnapshot(raw: unknown): ResumedLevel | null {
  try {
    if (typeof raw !== 'object' || raw === null) return null;
    const { levelId, arrangement } = raw as { levelId?: unknown; arrangement?: unknown };
    const levelIndex = playList.findIndex((entry) => entry.level.id === levelId);
    if (levelIndex === -1 || typeof arrangement !== 'number' || !Number.isInteger(arrangement)) return null;
    if (arrangement < 0 || arrangement >= arrangementCount(playList[levelIndex]!.level)) return null;
    const level = playedLevel(levelIndex, arrangement);
    const restored = restoreSnapshot(raw, level);
    return restored && { ...restored, levelIndex, arrangement, level };
  } catch {
    return null;
  }
}
