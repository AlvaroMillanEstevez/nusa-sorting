import { describe, expect, it } from 'vitest';
import {
  addReward,
  boostersUnlockedAt,
  buyBooster,
  chestContents,
  chestsEarned,
  continuePrice,
  EMPTY_WALLET,
  introduceBooster,
  levelUpGift,
  playerLevel,
  rewardWin,
  spend,
  useBooster,
  winCoins,
  xpToNext,
} from '../src/core';
import { ECONOMY } from '../src/data/economy';

describe('coins for wins', () => {
  it('pays more for a first win than a replay, with stars on top (only new ones on a replay)', () => {
    expect(winCoins(true, 2, 0)).toBe(ECONOMY.win.firstClear + 2 * ECONOMY.win.perStar);
    expect(winCoins(false, 2, 2)).toBe(ECONOMY.win.replay);
    expect(winCoins(false, 3, 1)).toBe(ECONOMY.win.replay + 2 * ECONOMY.win.perStar);
    expect(winCoins(true, 1, 0)).toBeGreaterThan(winCoins(false, 3, 3));
  });
});

describe('player level', () => {
  it('needs more experience for each level', () => {
    for (let level = 1; level < 30; level++) expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
    expect(playerLevel(0)).toEqual({ level: 1, into: 0, needed: xpToNext(1) });
    expect(playerLevel(xpToNext(1)).level).toBe(2);
    expect(playerLevel(xpToNext(1) + xpToNext(2) + 10)).toEqual({ level: 3, into: 10, needed: xpToNext(3) });
  });

  it('gives a gift for each level reached, going round the list', () => {
    expect(levelUpGift(2)).toEqual(ECONOMY.player.gifts[0]);
    expect(levelUpGift(2 + ECONOMY.player.gifts.length)).toEqual(ECONOMY.player.gifts[0]);
  });
});

describe('star chests', () => {
  const every = ECONOMY.chests.everyStars;

  it('comes each time the stars collected pass a multiple of everyStars', () => {
    expect(chestsEarned(0, every - 1)).toEqual([]);
    expect(chestsEarned(every - 1, every)).toEqual([1]);
    expect(chestsEarned(every - 2, 2 * every + 1)).toEqual([1, 2]);
  });

  it('holds coins and a booster within the visible ranges, the same every time, only from unlocked boosters', () => {
    for (let n = 1; n <= 40; n++) {
      const rewards = chestContents(n, ['freeze']);
      expect(chestContents(n, ['freeze'])).toEqual(rewards);
      const coins = rewards.find((r) => r.kind === 'coins')!;
      expect(coins.amount).toBeGreaterThanOrEqual(ECONOMY.chests.coins.min);
      expect(coins.amount).toBeLessThanOrEqual(ECONOMY.chests.coins.max);
      expect(rewards.find((r) => r.kind === 'booster')).toMatchObject({ booster: 'freeze', amount: 1 });
    }
    // Before any booster is unlocked, more coins instead.
    expect(chestContents(1, []).every((r) => r.kind === 'coins')).toBe(true);
  });
});

describe('boosters and continues', () => {
  it('unlock one by one', () => {
    expect(boostersUnlockedAt(3)).toEqual([]);
    expect(boostersUnlockedAt(ECONOMY.boosters.freeze.unlockLevel)).toEqual(['freeze']);
    expect(boostersUnlockedAt(24)).toEqual(['freeze', 'removeTriple', 'shuffle']);
  });

  it('cost more with each continue in an attempt, up to a maximum', () => {
    const prices = [0, 1, 2].map((i) => continuePrice('time', i)!);
    expect(prices[0]).toBe(ECONOMY.continues.time.price);
    expect(prices[1]).toBeGreaterThan(prices[0]!);
    expect(prices[2]).toBeGreaterThan(prices[1]!);
    expect(continuePrice('space', ECONOMY.continues.max)).toBeNull();
  });

  it('are bought, used and paid for only with what the player has', () => {
    const rich = addReward(EMPTY_WALLET, { kind: 'coins', amount: 500 });
    const bought = buyBooster(rich, 'shuffle')!;
    expect(bought.coins).toBe(500 - ECONOMY.boosters.shuffle.price);
    expect(bought.boosters.shuffle).toBe(1);
    expect(useBooster(bought, 'shuffle')!.boosters.shuffle).toBe(0);
    expect(useBooster(EMPTY_WALLET, 'freeze')).toBeNull();
    expect(buyBooster(EMPTY_WALLET, 'freeze')).toBeNull();
    expect(spend(EMPTY_WALLET, 1)).toBeNull();
  });

  it('give their intro gift once', () => {
    const once = introduceBooster(EMPTY_WALLET, 'freeze');
    expect(once.boosters.freeze).toBe(ECONOMY.boosters.freeze.gift);
    expect(introduceBooster(once, 'freeze')).toBe(once);
  });
});

describe('a win', () => {
  it('pays coins and experience, with the gifts of every level reached and the chests the stars reach', () => {
    const wallet = { ...EMPTY_WALLET, xp: xpToNext(1) - 10 };
    const every = ECONOMY.chests.everyStars;
    const rewards = rewardWin(wallet, { levelNumber: 5, firstClear: true, stars: 3, bestStarsBefore: 0, score: 100, totalStarsBefore: every - 2, totalStarsAfter: every + 1 });
    expect(rewards.coins).toBe(winCoins(true, 3, 0));
    expect(rewards.levelUps).toEqual([{ level: 2, gift: levelUpGift(2) }]);
    expect(rewards.chests.map((c) => c.number)).toEqual([1]);
    expect(rewards.wallet.chestsOpened).toBe(1);
    const chestCoins = rewards.chests[0]!.rewards.reduce((sum, r) => sum + (r.kind === 'coins' ? r.amount : 0), 0);
    const giftCoins = levelUpGift(2).kind === 'coins' ? levelUpGift(2).amount : 0;
    expect(rewards.wallet.coins).toBe(rewards.coins + chestCoins + giftCoins);
    // A chest already opened is not given again.
    expect(rewardWin(rewards.wallet, { levelNumber: 5, firstClear: false, stars: 3, bestStarsBefore: 3, score: 100, totalStarsBefore: every - 2, totalStarsAfter: every + 1 }).chests).toEqual([]);
  });
});
