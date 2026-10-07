import { countItems } from './game';
import { createGame, type LevelDefinition } from './level';
import { TIME_BONUS_PER_SECOND } from './mechanics';

/**
 * Stars for a won level: always at least one; two and three when the score reaches the level's thresholds.
 *
 * The thresholds come from a formula on the level itself (see STAR_FORMULA), not from simulated players: the
 * simulated pace is nothing like a person's, so their scores made poor targets.
 */
export type Stars = 1 | 2 | 3;

export interface StarThresholds {
  /** Score for two stars. */
  readonly two: number;
  /** Score for three stars; above `two`. */
  readonly three: number;
}

/**
 * The star formula. A level's base score B is what its triples score with no combo at all: triples × points per
 * triple × the first multiplier. Its full time bonus F is what finishing at once would add (time limit × points
 * per second left). Then:
 *
 *   two stars   = 1.25 B + 0.20 F   a win with a fifth of the time left plus a quarter more, from combos or time
 *   three stars = 1.70 B + 0.40 F   a good game: well-kept combos and a fair share of time left
 *
 * Combos add to B's share (a chain of ×2-×3 now and then is about +25%; a good run of chains, +50-70%), and time
 * to F's, so either path helps and the best players use both.
 */
export const STAR_FORMULA = {
  two: { base: 1.25, time: 0.2 },
  three: { base: 1.7, time: 0.4 },
} as const;

/** Thresholds are rounded to this many points. */
const ROUND = 10;

/** What a level's star thresholds are made of. */
export interface ScoreParts {
  readonly triples: number;
  /** Points of a triple with no combo (points per triple × the first multiplier). */
  readonly pointsPerTriple: number;
  /** Triples × points per triple: the score with no combo and no time bonus. */
  readonly base: number;
  /** Time bonus for finishing at once (0 for an untimed level). */
  readonly fullTimeBonus: number;
}

export function scoreParts(level: LevelDefinition): ScoreParts {
  const state = createGame(level);
  const triples = countItems(state) / 3;
  const pointsPerTriple = state.combo.pointsPerTriple * (state.combo.multipliers[0] ?? 1);
  return {
    triples,
    pointsPerTriple,
    base: triples * pointsPerTriple,
    fullTimeBonus: (level.timeLimitSeconds ?? 0) * TIME_BONUS_PER_SECOND,
  };
}

/** A level's star thresholds, from STAR_FORMULA. */
export function starThresholds(level: LevelDefinition): StarThresholds {
  const { base, fullTimeBonus } = scoreParts(level);
  const at = ({ base: b, time }: { base: number; time: number }) => Math.round((b * base + time * fullTimeBonus) / ROUND) * ROUND;
  const two = at(STAR_FORMULA.two);
  return { two, three: Math.max(two + ROUND, at(STAR_FORMULA.three)) };
}

/** Stars earned by a win with `score`. */
export function starsFor(score: number, thresholds: StarThresholds): Stars {
  if (score >= thresholds.three) return 3;
  if (score >= thresholds.two) return 2;
  return 1;
}
