/**
 * Player progress, keyed by level id (never by position), so adding or reordering levels keeps saves valid.
 */
export interface Progress {
  /** Ids of levels completed at least once. */
  readonly completed: readonly string[];
  /** Best score per level id; only levels that keep a score appear. */
  readonly bestScores: Readonly<Record<string, number>>;
}

export const EMPTY_PROGRESS: Progress = { completed: [], bestScores: {} };

export function isCompleted(progress: Progress, levelId: string): boolean {
  return progress.completed.includes(levelId);
}

/**
 * Linear unlocking: the first level is always open; any other opens once the level before it in the
 * current list is completed. A level already completed stays open even if the list is reordered.
 */
export function isUnlocked(progress: Progress, levelIds: readonly string[], index: number): boolean {
  const id = levelIds[index];
  if (id === undefined) return false;
  if (index === 0 || isCompleted(progress, id)) return true;
  return isCompleted(progress, levelIds[index - 1]!);
}

/** Index of the first level not completed yet, or null when every level is done. */
export function firstIncomplete(progress: Progress, levelIds: readonly string[]): number | null {
  const index = levelIds.findIndex((id) => !isCompleted(progress, id));
  return index === -1 ? null : index;
}

export interface WinRecord {
  readonly progress: Progress;
  /** True when the score beats a best score saved before. */
  readonly newBest: boolean;
  /** Best score for the level after this win, or null if the level keeps no score. */
  readonly best: number | null;
  readonly firstClear: boolean;
}

/** Records a completed level and its score (null for levels without scoring). */
export function recordWin(progress: Progress, levelId: string, score: number | null): WinRecord {
  const firstClear = !isCompleted(progress, levelId);
  const completed = firstClear ? [...progress.completed, levelId] : progress.completed;
  const previous = progress.bestScores[levelId];
  if (score === null) {
    return { progress: { ...progress, completed }, newBest: false, best: previous ?? null, firstClear };
  }
  const improves = previous === undefined || score > previous;
  const bestScores = improves ? { ...progress.bestScores, [levelId]: score } : progress.bestScores;
  return {
    progress: { completed, bestScores },
    newBest: previous !== undefined && score > previous,
    best: improves ? score : previous,
    firstClear,
  };
}
