/**
 * Stars for a won level: always at least one; two and three when the score reaches the level's thresholds. The
 * thresholds are set per level by the level generator from the expert simulated player's scores (see
 * tools/levelgen), so they reward speed (the time bonus) and combos.
 */
export type Stars = 1 | 2 | 3;

export interface StarThresholds {
  /** Score for two stars. */
  readonly two: number;
  /** Score for three stars; above `two`. */
  readonly three: number;
}

/** Stars earned by a win with `score` (one when the level has no thresholds). */
export function starsFor(score: number, thresholds: StarThresholds | undefined): Stars {
  if (!thresholds) return 1;
  if (score >= thresholds.three) return 3;
  if (score >= thresholds.two) return 2;
  return 1;
}

/** Whether thresholds are usable: positive whole numbers, three above two. */
export function validThresholds(thresholds: StarThresholds): boolean {
  const { two, three } = thresholds;
  return Number.isInteger(two) && Number.isInteger(three) && two > 0 && three > two;
}
