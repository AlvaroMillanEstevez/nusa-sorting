import { parseItemType } from '../data/itemCatalog';
import { MARKET_DAYS, marketCategoryOf, PASARAN_DAYS, type MarketCategory, type Pasaran } from '../data/pasaran';
import type { LevelDefinition } from './level';

/**
 * The pasaran of a calendar date, counted from a day every source agrees on: 17 August 1945, the proclamation of
 * Indonesia's independence, was Friday Legi (Jumat Legi). The cycle has no gaps, so any date is a whole number of
 * days away from it. (A second check, in the tests: 8 July 1633, the first day of Sultan Agung's Javanese
 * calendar, was also Friday Legi, 113,995 days earlier: a multiple of 35, the seven-day and five-day weeks.)
 * The Javanese day turns at sunset; the game keeps to the civil date, from midnight.
 */
const ANCHOR = Date.UTC(1945, 7, 17);
const DAY_MS = 86_400_000;

/** The pasaran of the date `year`-`month`-`day` (month 1-12). */
export function pasaranOf(year: number, month: number, day: number): Pasaran {
  const days = Math.round((Date.UTC(year, month - 1, day) - ANCHOR) / DAY_MS);
  return PASARAN_DAYS[((days % 5) + 5) % 5]!;
}

/** The pasaran of `date` on the device's own calendar (its local date). */
export function pasaranOn(date: Date): Pasaran {
  return pasaranOf(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** The food the market favours on a day. */
export const marketCategory = (day: Pasaran): MarketCategory => MARKET_DAYS[day];

/** Whether an item type is of a market category (any colour variant counts as its kind). */
export function isMarketType(type: string, category: MarketCategory): boolean {
  const parsed = parseItemType(type);
  return parsed !== null && marketCategoryOf(parsed.kind) === category;
}

/**
 * The triples of a market category a level holds: one per type of it (every level has exactly one triple of each
 * type, and winning clears them all).
 */
export function marketTriples(level: LevelDefinition, category: MarketCategory): number {
  const types = new Set<string>();
  for (const layers of level.shelves) for (const layer of layers) for (const type of layer) if (type !== null) types.add(type);
  for (const mechanic of level.mechanics ?? []) {
    if (mechanic.kind !== 'tracks') continue;
    for (const track of mechanic.tracks) for (const carrier of track.carriers) if (!('shelf' in carrier)) carrier.forEach((type) => types.add(type));
  }
  return [...types].filter((type) => isMarketType(type, category)).length;
}
