/**
 * Pasaran, the five-day Javanese market week (Legi, Pahing, Pon, Wage, Kliwon), and the food each day's market
 * favours in the game. The five categories are the catalogue's food categories, so every food has one day (chili,
 * the one "other", sells with the fruit); cultural objects have none.
 */

import type { ItemKind } from './itemCatalog';

/** The days in their order: the day after Kliwon is Legi again. */
export const PASARAN_DAYS = ['legi', 'pahing', 'pon', 'wage', 'kliwon'] as const;
export type Pasaran = (typeof PASARAN_DAYS)[number];

/** A market day's food. */
export type MarketCategory = 'sweet' | 'dish' | 'snack' | 'drink' | 'fruit';

/**
 * The food of each market day. Legi is also called Manis ("sweet"), so it gets the sweets; the others are spread
 * so that the categories with fewest kinds are not on consecutive days.
 */
export const MARKET_DAYS: Readonly<Record<Pasaran, MarketCategory>> = {
  legi: 'sweet',
  pahing: 'dish',
  pon: 'snack',
  wage: 'drink',
  kliwon: 'fruit',
};

/** The market category of a kind, or null for cultural objects (never on sale on a market day). */
export function marketCategoryOf(kind: ItemKind): MarketCategory | null {
  switch (kind.category) {
    case 'cultural':
      return null;
    case 'other':
      return 'fruit';
    default:
      return kind.category;
  }
}
