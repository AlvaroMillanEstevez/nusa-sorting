/**
 * Every tunable value of the game's economy and progression, in one place: coins, booster prices and effects,
 * continues, the player's levels and their gifts, and star chests. Change values here, never in code.
 *
 * Principles (see CLAUDE.md): one currency (coins); every level can be won without boosters; nothing is bought
 * with real money; no ad buttons yet.
 */

export type BoosterId = 'freeze' | 'removeTriple' | 'shuffle';

export const BOOSTER_IDS: readonly BoosterId[] = ['freeze', 'removeTriple', 'shuffle'];

/** A gift: coins, or units of a booster. */
export type Reward = { readonly kind: 'coins'; readonly amount: number } | { readonly kind: 'booster'; readonly booster: BoosterId; readonly amount: number };

export const ECONOMY = {
  /** Coins for winning a level. */
  win: {
    /** The first time a level is won. */
    firstClear: 30,
    /** Each later win of the same level: small, so replaying easy levels is not the way to earn. */
    replay: 5,
    /** For each star earned the first time; on a replay, only for stars beyond the best so far. */
    perStar: 5,
  },

  /**
   * Market day (pasaran): each triple of the day's food (see src/data/pasaran.ts) pays these coins on top of a win,
   * up to `maxPerWin`. Coins, not points, so stars are the same whatever the day. Not before level `fromLevel`: the
   * first levels show only the triple and fresh food.
   */
  pasaran: { perTriple: 2, maxPerWin: 10, fromLevel: 3 },

  /**
   * Buku Nenek, Grandma's book: a page completed (every entry on it found) gives this, collected in the book. Food
   * pages (one per market category, all complete within the first levels) give a few coins; theme pages give coins,
   * and every third one a booster instead (each already unlocked by the theme's level).
   */
  album: {
    foodPage: { kind: 'coins', amount: 30 },
    themePages: {
      'budaya-jawa': { kind: 'coins', amount: 50 },
      '17-agustus': { kind: 'coins', amount: 50 },
      'pasar-malam': { kind: 'booster', booster: 'removeTriple', amount: 1 },
      'laut-nusantara': { kind: 'coins', amount: 50 },
      olahraga: { kind: 'coins', amount: 50 },
      'permainan-tradisional': { kind: 'booster', booster: 'shuffle', amount: 1 },
      'rempah-maluku': { kind: 'coins', amount: 50 },
      sawah: { kind: 'coins', amount: 50 },
      'fauna-nusantara': { kind: 'booster', booster: 'freeze', amount: 1 },
    },
  } satisfies { foodPage: Reward; themePages: Readonly<Record<string, Reward>> },

  boosters: {
    freeze: {
      /** Coins for one in the shop. */
      price: 200,
      /** Level (number) from which it can be used; its first appearance gives `gift` units and a one-line intro. */
      unlockLevel: 4,
      gift: 1,
      /** Seconds the clock stops. */
      seconds: 10,
    },
    removeTriple: { price: 300, unlockLevel: 7, gift: 1 },
    shuffle: { price: 250, unlockLevel: 9, gift: 1 },
  },

  /**
   * Continuing after a defeat, within the same attempt. Out of space or stuck: with a booster that fits, one the
   * player has or one bought there and then at its shop price. Out of time: extra seconds bought with coins, each
   * time in the attempt dearer.
   */
  continues: {
    /** At most this many continues per attempt. */
    max: 3,
    /** Out of time: seconds added, the price of the first, and how much dearer each next one is (rounded to 5). */
    time: { seconds: 15, price: 60, growth: 1.5 },
  },

  /** The player's level: every level's score adds experience. */
  player: {
    /** Experience per point scored. */
    xpPerPoint: 1,
    /** Experience from level n to n + 1: first × growth^(n - 1), rounded to 50. */
    xp: { first: 4000, growth: 1.3 },
    /** Gifts for reaching levels 2, 3, 4… in turn (the list repeats). */
    gifts: [
      { kind: 'coins', amount: 40 },
      { kind: 'coins', amount: 60 },
      { kind: 'coins', amount: 80 },
      { kind: 'booster', booster: 'freeze', amount: 1 },
      { kind: 'coins', amount: 100 },
      { kind: 'coins', amount: 120 },
      { kind: 'booster', booster: 'removeTriple', amount: 1 },
      { kind: 'coins', amount: 140 },
      { kind: 'coins', amount: 160 },
      { kind: 'booster', booster: 'shuffle', amount: 1 },
    ] satisfies readonly Reward[],
  },

  /**
   * Chests: every new star counts towards the next, and the player opens one by hand once the count reaches
   * `everyStars` (opening takes that many away; the count can pass it). Only earned by playing.
   */
  chests: {
    everyStars: 15,
    /** Coins in a chest: a fixed range. */
    coins: { min: 40, max: 80 },
    /** Units of one booster (among those unlocked; coins instead before any is), also a fixed range. */
    booster: { min: 1, max: 1 },
  },
} as const;

/** Rewards the first time a booster appears (its unlock level): its gift units. */
export function boosterGift(booster: BoosterId): Reward {
  return { kind: 'booster', booster, amount: ECONOMY.boosters[booster].gift };
}
