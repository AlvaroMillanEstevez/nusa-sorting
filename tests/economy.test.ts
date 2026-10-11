import { describe, expect, it } from 'vitest';
import {
  addReward,
  boostersUnlockedAt,
  buyBooster,
  chestContents,
  chestProgress,
  continueBoosters,
  extraTimePrice,
  EMPTY_WALLET,
  introduceBooster,
  levelUpGift,
  openChest,
  playerLevel,
  rewardWin,
  spend,
  useBooster,
  useOrBuyBooster,
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

  it('can be opened once the stars collected reach everyStars, and the count can pass it', () => {
    expect(chestProgress({ ...EMPTY_WALLET, chestStars: every - 1 })).toEqual({ have: every - 1, every, ready: false });
    expect(openChest({ ...EMPTY_WALLET, chestStars: every - 1 }, 10)).toBeNull();
    expect(chestProgress({ ...EMPTY_WALLET, chestStars: every + 2 })).toEqual({ have: every + 2, every, ready: true });
  });

  it('takes everyStars away when opened, gives its contents, and opens again while there are stars for one', () => {
    let wallet = { ...EMPTY_WALLET, coins: 10, chestStars: 2 * every + 5 };
    const first = openChest(wallet, 10)!;
    expect(first.number).toBe(1);
    expect(first.rewards).toEqual(chestContents(1, boostersUnlockedAt(10)));
    expect(first.wallet.chestStars).toBe(every + 5);
    expect(first.wallet.chestsOpened).toBe(1);
    const coins = first.rewards.reduce((sum, r) => sum + (r.kind === 'coins' ? r.amount : 0), 0);
    expect(first.wallet.coins).toBe(10 + coins);
    wallet = first.wallet;
    const second = openChest(wallet, 10)!;
    expect(second.number).toBe(2);
    expect(second.wallet.chestStars).toBe(5);
    expect(openChest(second.wallet, 10)).toBeNull();
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

  it('continue with the boosters that fit the defeat, unlocked ones only, up to a maximum per attempt', () => {
    expect(continueBoosters('timeUp', 24, 0)).toEqual([]);
    expect(continueBoosters('blocked', 24, 0)).toEqual(['removeTriple', 'shuffle']);
    expect(continueBoosters('stuck', 8, 2)).toEqual(['removeTriple']);
    expect(continueBoosters('blocked', 6, 0)).toEqual([]);
    expect(continueBoosters('stuck', 24, ECONOMY.continues.max)).toEqual([]);
  });

  it('sell more time with coins after running out of it, dearer each time, up to the maximum', () => {
    const prices = [0, 1, 2].map((i) => extraTimePrice(i)!);
    expect(prices[0]).toBe(ECONOMY.continues.time.price);
    expect(prices[1]).toBeGreaterThan(prices[0]!);
    expect(prices[2]).toBeGreaterThan(prices[1]!);
    expect(extraTimePrice(ECONOMY.continues.max)).toBeNull();
  });

  it('continue with a booster the player has, or one bought at its shop price, never at another price', () => {
    const owned = { ...EMPTY_WALLET, coins: 50, boosters: { ...EMPTY_WALLET.boosters, shuffle: 2 } };
    expect(useOrBuyBooster(owned, 'shuffle')).toEqual({ ...owned, boosters: { ...owned.boosters, shuffle: 1 } });
    const price = ECONOMY.boosters.removeTriple.price;
    const rich = { ...EMPTY_WALLET, coins: price + 7 };
    expect(useOrBuyBooster(rich, 'removeTriple')).toEqual({ ...rich, coins: 7 });
    expect(useOrBuyBooster({ ...EMPTY_WALLET, coins: price - 1 }, 'removeTriple')).toBeNull();
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
  it('pays coins and experience, with the gifts of every level reached, and adds its new stars towards chests', () => {
    const wallet = { ...EMPTY_WALLET, xp: xpToNext(1) - 10, chestStars: 12 };
    const every = ECONOMY.chests.everyStars;
    const rewards = rewardWin(wallet, { levelNumber: 5, firstClear: true, stars: 3, bestStarsBefore: 0, score: 100, totalStarsBefore: every - 2, totalStarsAfter: every + 1 });
    expect(rewards.coins).toBe(winCoins(true, 3, 0));
    expect(rewards.levelUps).toEqual([{ level: 2, gift: levelUpGift(2) }]);
    // No chest opens by itself: the stars wait for the player to open one.
    expect(rewards.chestStars).toBe(3);
    expect(rewards.wallet.chestStars).toBe(15);
    expect(rewards.wallet.chestsOpened).toBe(0);
    const giftCoins = levelUpGift(2).kind === 'coins' ? levelUpGift(2).amount : 0;
    expect(rewards.wallet.coins).toBe(rewards.coins + giftCoins);
    // A replay without new stars adds none.
    expect(rewardWin(rewards.wallet, { levelNumber: 5, firstClear: false, stars: 3, bestStarsBefore: 3, score: 100, totalStarsBefore: every + 1, totalStarsAfter: every + 1 }).chestStars).toBe(0);
  });
});
