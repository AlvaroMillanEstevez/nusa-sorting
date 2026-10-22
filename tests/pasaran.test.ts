import { describe, expect, it } from 'vitest';
import { EMPTY_WALLET, marketCategory, marketCoins, marketTriples, pasaranOf, pasaranOn, rewardWin, type LevelDefinition } from '../src/core';
import { ECONOMY } from '../src/data/economy';
import { ITEM_KINDS } from '../src/data/itemCatalog';
import { MARKET_DAYS, marketCategoryOf, PASARAN_DAYS } from '../src/data/pasaran';

describe('pasaran', () => {
  it('knows the days every source agrees on', () => {
    // The proclamation of independence: Jumat Legi.
    expect(pasaranOf(1945, 8, 17)).toBe('legi');
    // 1 Sura 1555, the first day of Sultan Agung's Javanese calendar: Jumat Legi too.
    expect(pasaranOf(1633, 7, 8)).toBe('legi');
    // Both were Fridays, and 113,995 days apart: a whole number of 35-day cycles (7-day week × 5-day pasaran).
    const days = (Date.UTC(1945, 7, 17) - Date.UTC(1633, 6, 8)) / 86_400_000;
    expect(days).toBe(113_995);
    expect(days % 35).toBe(0);
    expect(new Date(Date.UTC(1945, 7, 17)).getUTCDay()).toBe(5);
    expect(new Date(Date.UTC(1633, 6, 8)).getUTCDay()).toBe(5);
  });

  it('goes round the five days in order, across months, years and leap days', () => {
    expect([17, 18, 19, 20, 21, 22].map((d) => pasaranOf(1945, 8, d))).toEqual(['legi', 'pahing', 'pon', 'wage', 'kliwon', 'legi']);
    // 28 Feb → 29 Feb → 1 Mar 2024, and 31 Dec 2025 → 1 Jan 2026: one step each.
    const step = (a: string, b: string) => (PASARAN_DAYS.indexOf(b as never) - PASARAN_DAYS.indexOf(a as never) + 5) % 5;
    expect(step(pasaranOf(2024, 2, 28), pasaranOf(2024, 2, 29))).toBe(1);
    expect(step(pasaranOf(2024, 2, 29), pasaranOf(2024, 3, 1))).toBe(1);
    expect(step(pasaranOf(2025, 12, 31), pasaranOf(2026, 1, 1))).toBe(1);
    // Five days later, the same day again; before the anchor too.
    expect(pasaranOf(1900, 1, 1)).toBe(pasaranOf(1900, 1, 6));
  });

  it('gives these days (worked out from the anchor, to check by hand against a Javanese calendar)', () => {
    expect(pasaranOf(2026, 10, 22)).toBe('pahing'); // Kamis Pahing
    expect(pasaranOf(2026, 10, 23)).toBe('pon'); // Jumat Pon
    expect(pasaranOf(2000, 1, 1)).toBe('legi'); // Sabtu Legi
  });

  it('follows the device’s own calendar date, from midnight to midnight', () => {
    expect(pasaranOn(new Date(2026, 9, 22, 0, 1))).toBe('pahing');
    expect(pasaranOn(new Date(2026, 9, 22, 23, 59))).toBe('pahing');
    expect(pasaranOn(new Date(2026, 9, 23, 0, 0))).toBe('pon');
  });
});

describe('market days', () => {
  it('give every food a day and no day to cultural objects; each day has a category of its own', () => {
    expect(new Set(Object.values(MARKET_DAYS)).size).toBe(5);
    for (const kind of ITEM_KINDS) {
      if (kind.category === 'cultural') expect(marketCategoryOf(kind)).toBeNull();
      else expect(Object.values(MARKET_DAYS)).toContain(marketCategoryOf(kind));
    }
    expect(marketCategory('legi')).toBe('sweet');
    expect(marketCategory('kliwon')).toBe('fruit');
  });

  it("count a level's triples of the day's food, colour variants and stacks included", () => {
    const level: LevelDefinition = {
      id: 'market',
      shelves: [[['rambutan', 'rambutan', 'rambutan:alt1']], [['cabai', 'gong', null]]],
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0, carriers: [['rambutan:alt1', 'rambutan:alt1', 'cabai', 'cabai'], ['gong', 'gong']] }] }],
    };
    // rambutan, rambutan:alt1 and chili (sold with the fruit); never the gong.
    expect(marketTriples(level, 'fruit')).toBe(3);
    expect(marketTriples(level, 'drink')).toBe(0);
  });

  it('pay coins on a win, never points, up to a cap', () => {
    const { perTriple, maxPerWin } = ECONOMY.pasaran;
    expect(marketCoins(0)).toBe(0);
    expect(marketCoins(1)).toBe(perTriple);
    expect(marketCoins(1000)).toBe(maxPerWin);
    const facts = { levelNumber: 3, firstClear: true, stars: 2, bestStarsBefore: 0, score: 1000, totalStarsBefore: 0, totalStarsAfter: 2 };
    const plain = rewardWin(EMPTY_WALLET, facts);
    const market = rewardWin(EMPTY_WALLET, { ...facts, marketTriples: 2 });
    expect(market.marketCoins).toBe(2 * perTriple);
    expect(market.coins).toBe(plain.coins + 2 * perTriple);
    expect(market.wallet.coins).toBe(plain.wallet.coins + 2 * perTriple);
    // The panel's breakdown adds up to the total.
    expect(market.coinParts).toEqual({ level: ECONOMY.win.firstClear, stars: 2 * ECONOMY.win.perStar, market: 2 * perTriple });
    const { level, stars, market: day } = market.coinParts;
    expect(level + stars + day).toBe(market.coins);
    // Experience (from the score) and stars are the same.
    expect(market.xp).toBe(plain.xp);
    expect(market.chestStars).toBe(plain.chestStars);
  });
});
