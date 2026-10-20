import { createGame, FRESH_BONUS_SHARE, scoreParts, starsFor, starThresholds, STAR_FORMULA, TIME_BONUS_PER_SECOND, type LevelDefinition } from '../../src/core';
import { demoLevels } from '../../tests/fixtures/demo-levels';
import { CASUAL, EXPERT, playMany, type PlayerProfile } from '../simulator';

/**
 * The fresh-food demos (18-20) in simulated games: wins, points from triples, mean stars of the wins (with today's
 * formula and one counting the fresh bonus in the base) and the share of fresh foods' triples cleared spoiled, for
 * both players, with the mechanic and without it (the same board, scored against the same thresholds).
 * Usage: node tools/check/fresh.mjs [games]
 */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * The simulated pace is far quicker than a person's, so its time bonus says nothing: stars are worked out from the
 * points its triples scored plus the bonus of a person who keeps HUMAN_TIME_LEFT of the clock.
 */
const HUMAN_TIME_LEFT = 0.3;

/** Thresholds with the fresh foods' bonus counted in the base, as if every fresh triple were saved. */
function freshAwareThresholds(level: LevelDefinition): { two: number; three: number } {
  const { base, pointsPerTriple, fullTimeBonus } = scoreParts(level);
  const fresh = createGame(level).fresh.length;
  const b = base + fresh * pointsPerTriple * FRESH_BONUS_SHARE;
  const at = (f: { base: number; time: number }) => Math.round((b * f.base + f.time * fullTimeBonus) / 10) * 10;
  return { two: at(STAR_FORMULA.two), three: at(STAR_FORMULA.three) };
}

function measure(level: LevelDefinition, profile: PlayerProfile, games: number, scored: LevelDefinition = level): string {
  const outcomes = playMany(createGame(level), games, 1, profile);
  const limit = level.timeLimitSeconds ?? 0;
  const wins = outcomes.filter((o) => o.won);
  const triplePoints = (o: (typeof outcomes)[number]) => o.score - Math.max(0, Math.floor(limit - o.seconds)) * TIME_BONUS_PER_SECOND;
  const human = (o: (typeof outcomes)[number]) => triplePoints(o) + HUMAN_TIME_LEFT * limit * TIME_BONUS_PER_SECOND;
  const mean = (f: (o: (typeof outcomes)[number]) => number) => wins.reduce((sum, o) => sum + f(o), 0) / Math.max(1, wins.length);
  const now = starThresholds(scored);
  const aware = freshAwareThresholds(scored);
  const fresh = outcomes.reduce((sum, o) => sum + o.freshTriples, 0);
  const spoiled = outcomes.reduce((sum, o) => sum + o.spoiledTriples, 0);
  const share = fresh + spoiled === 0 ? '  -' : pct(spoiled / (fresh + spoiled)).padStart(3);
  return `${profile.name.padEnd(7)} win ${pct(wins.length / games).padStart(4)}  triple points ${Math.round(mean(triplePoints)).toString().padStart(4)} (B ${scoreParts(scored).base})  stars now ${mean((o) => starsFor(human(o), now)).toFixed(2)}  fresh-aware ${mean((o) => starsFor(human(o), aware)).toFixed(2)}  spoiled ${share}`;
}

export function main(games = 300): string {
  const lines: string[] = [];
  for (const level of demoLevels.filter((l) => l.mechanics?.some((m) => m.kind === 'fresh'))) {
    const plain = { ...level, mechanics: level.mechanics!.filter((m) => m.kind !== 'fresh') };
    lines.push(`${level.id} (thresholds ${starThresholds(level).two}/${starThresholds(level).three})`);
    for (const profile of [CASUAL, EXPERT]) {
      lines.push(`  fresh    ${measure(level, profile, games)}`);
      lines.push(`  without  ${measure(plain, profile, games, level)}`);
    }
  }
  return lines.join('\n');
}
