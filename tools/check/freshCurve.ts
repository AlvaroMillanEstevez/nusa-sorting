import { createGame, starsFor, starThresholds, TIME_BONUS_PER_SECOND, type LevelDefinition } from '../../src/core';
import { levels } from '../../src/data/levels';
import { CASUAL, EXPERT, playMany, type GameOutcome, type PlayerProfile } from '../simulator';
import { itemCount } from '../levelgen/report';

/**
 * Fresh foods ("basi") across the shipped levels, as a markdown table: each level's fresh foods and countdowns, both
 * players' wins and mean stars, and the share of fresh triples cleared spoiled; with `before` (the same levels
 * before fresh foods), their wins and stars too. Stars count the points a game's triples scored plus the time
 * bonus of a person keeping HUMAN_TIME_LEFT of the clock: the simulated pace is far too quick for its own time bonus
 * to mean anything. Usage: node tools/check/fresh-curve.mjs [games] [old levels module]
 */
const HUMAN_TIME_LEFT = 0.3;

interface Figures {
  readonly win: number;
  readonly stars: number;
  readonly spoiled: number | null;
}

function figures(level: LevelDefinition, profile: PlayerProfile, games: number): Figures {
  const outcomes = playMany(createGame(level), games, 1, profile);
  const limit = level.timeLimitSeconds ?? 0;
  const thresholds = starThresholds(level);
  const wins = outcomes.filter((o) => o.won);
  const human = (o: GameOutcome) => o.score - Math.max(0, Math.floor(limit - o.seconds)) * TIME_BONUS_PER_SECOND + HUMAN_TIME_LEFT * limit * TIME_BONUS_PER_SECOND;
  const fresh = outcomes.reduce((sum, o) => sum + o.freshTriples, 0);
  const spoiled = outcomes.reduce((sum, o) => sum + o.spoiledTriples, 0);
  return {
    win: wins.length / games,
    stars: wins.reduce((sum, o) => sum + starsFor(human(o), thresholds), 0) / Math.max(1, wins.length),
    spoiled: fresh + spoiled === 0 ? null : spoiled / (fresh + spoiled),
  };
}

const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)} %`);

export function main(games: number, before: readonly LevelDefinition[] | null): string {
  const rows = [
    '| Nivel | Cuentas de los frescos (objetos del nivel) | Casual: victoria | Casual: estrellas | Casual: estropeados | Experto: victoria | Experto: estrellas | Experto: estropeados |',
    '|---|---|---|---|---|---|---|---|',
  ];
  levels.forEach((level, i) => {
    const fresh = level.mechanics?.find((m) => m.kind === 'fresh');
    const items = itemCount(level);
    const foods = fresh?.kind === 'fresh' ? fresh.foods.map((f) => f.moves).join(', ') : '–';
    const old = before?.[i];
    const cell = (now: Figures, then: Figures | null, field: 'win' | 'stars') =>
      field === 'win' ? `${pct(now.win)}${then ? ` (${pct(then.win)})` : ''}` : `${now.stars.toFixed(2)}${then ? ` (${then.stars.toFixed(2)})` : ''}`;
    const [c, e] = [CASUAL, EXPERT].map((p) => figures(level, p, games));
    const [oc, oe] = old ? [CASUAL, EXPERT].map((p) => figures(old, p, games)) : [null, null];
    rows.push(`| ${i + 1} | ${foods} (${items} obj.) | ${cell(c!, oc!, 'win')} | ${cell(c!, oc!, 'stars')} | ${pct(c!.spoiled)} | ${cell(e!, oe!, 'win')} | ${cell(e!, oe!, 'stars')} | ${pct(e!.spoiled)} |`);
  });
  return rows.join('\n');
}
