import { BOOSTER_IDS, boosterGift, ECONOMY, type BoosterId, type Reward } from '../data/economy';
import { nextRandom } from './random';

/**
 * The economy and the player's progression, as pure functions over the values in src/data/economy.ts: coins
 * for wins, the player's level from experience, gifts for levelling up, star chests, booster prices and
 * continues (with boosters). One currency (coins); nothing is bought with real money.
 */

/** What the player owns and has been through, saved with the progress. */
export interface Wallet {
  readonly coins: number;
  /** Experience: every level's score adds to it. */
  readonly xp: number;
  readonly boosters: Readonly<Record<BoosterId, number>>;
  /** Star chests already opened (it numbers the next one, which fixes its contents). */
  readonly chestsOpened: number;
  /**
   * Stars collected towards chests: every new star adds one, and opening a chest takes `everyStars` away. It
   * can pass the target (17/15, 35/15) while the player has not opened the chest yet.
   */
  readonly chestStars: number;
  /** Boosters whose one-line intro (and gift) the player has had. */
  readonly introduced: readonly BoosterId[];
}

export const EMPTY_WALLET: Wallet = { coins: 0, xp: 0, boosters: { freeze: 0, removeTriple: 0, shuffle: 0 }, chestsOpened: 0, chestStars: 0, introduced: [] };

const round = (value: number, step: number) => Math.round(value / step) * step;

// ---------------------------------------------------------------- coins for wins

/**
 * Coins for a win: more the first time than on a replay (so replaying an easy level is not the way to earn),
 * plus a bonus per star: all of them the first time, only those beyond the best so far on a replay.
 */
export function winCoins(firstClear: boolean, stars: number, bestBefore: number): number {
  const { firstClear: first, replay, perStar } = ECONOMY.win;
  return firstClear ? first + perStar * stars : replay + perStar * Math.max(0, stars - bestBefore);
}

// ---------------------------------------------------------------- the player's level

export const xpForScore = (score: number): number => Math.round(score * ECONOMY.player.xpPerPoint);

/** Experience needed to go from player level `level` to the next. */
export function xpToNext(level: number): number {
  const { first, growth } = ECONOMY.player.xp;
  return round(first * growth ** (level - 1), 50);
}

/** The player's level for an amount of experience (starting at 1), and the progress towards the next. */
export function playerLevel(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, needed: xpToNext(level) };
}

/** The gift for reaching player level `level` (2 and up). */
export function levelUpGift(level: number): Reward {
  const gifts = ECONOMY.player.gifts;
  return gifts[(level - 2) % gifts.length]!;
}

// ---------------------------------------------------------------- star chests

/** The stars collected towards chests, how many a chest takes, and whether one can be opened now. */
export function chestProgress(wallet: Wallet): { have: number; every: number; ready: boolean } {
  const every = ECONOMY.chests.everyStars;
  return { have: wallet.chestStars, every, ready: wallet.chestStars >= every };
}

/**
 * Opens a star chest, if the player has collected the stars for one: takes `everyStars` from them and adds the
 * chest's contents (see chestContents, with the boosters unlocked by `reachedLevel`). Null if not enough stars.
 */
export function openChest(wallet: Wallet, reachedLevel: number): { wallet: Wallet; number: number; rewards: Reward[] } | null {
  const every = ECONOMY.chests.everyStars;
  if (wallet.chestStars < every) return null;
  const number = wallet.chestsOpened + 1;
  const rewards = chestContents(number, boostersUnlockedAt(reachedLevel));
  let next: Wallet = { ...wallet, chestStars: wallet.chestStars - every, chestsOpened: number };
  for (const reward of rewards) next = addReward(next, reward);
  return { wallet: next, number, rewards };
}

/**
 * What chest `number` holds: coins in the visible range and units of one booster among those unlocked (more
 * coins instead before any is). Fixed by the chest's number, so it is the same however often it is computed.
 */
export function chestContents(number: number, unlocked: readonly BoosterId[]): Reward[] {
  const { coins, booster } = ECONOMY.chests;
  let state = number * 7919 + 13;
  const next = () => {
    const step = nextRandom(state);
    state = step.state;
    return step.value;
  };
  const between = (min: number, max: number, step: number) => Math.min(max, min + round(next() * (max - min), step));
  const rewards: Reward[] = [{ kind: 'coins', amount: between(coins.min, coins.max, 5) }];
  if (unlocked.length > 0) {
    const pick = unlocked[Math.floor(next() * unlocked.length)]!;
    rewards.push({ kind: 'booster', booster: pick, amount: between(booster.min, booster.max, 1) });
  } else {
    rewards.push({ kind: 'coins', amount: round((coins.min + coins.max) / 2, 5) });
  }
  return rewards;
}

// ---------------------------------------------------------------- boosters and continues

/** Boosters the player can use from level `levelNumber` on. */
export function boostersUnlockedAt(levelNumber: number): BoosterId[] {
  return BOOSTER_IDS.filter((id) => levelNumber >= ECONOMY.boosters[id].unlockLevel);
}

export const boosterPrice = (booster: BoosterId): number => ECONOMY.boosters[booster].price;

/** Why a level was lost, as far as continuing goes. */
export type ContinueReason = 'timeUp' | 'blocked' | 'stuck';

/**
 * The boosters that can continue a level lost for `reason`, among those unlocked at level `levelNumber`: "remove a
 * triple" and "shuffle" when the board is full or stuck. None when the clock ran out (more time is bought with
 * coins instead, see extraTimePrice; "freeze time" only ever stops the clock), nor once the attempt has had
 * ECONOMY.continues.max continues.
 */
export function continueBoosters(reason: ContinueReason, levelNumber: number, continuesUsed: number): BoosterId[] {
  if (continuesUsed >= ECONOMY.continues.max || reason === 'timeUp') return [];
  const unlocked = boostersUnlockedAt(levelNumber);
  return (['removeTriple', 'shuffle'] as const).filter((id) => unlocked.includes(id));
}

/**
 * The price in coins of more time after running out of it, for the continue number `continuesUsed` (0 for the
 * first) in the attempt: dearer each time, and null past the maximum.
 */
export function extraTimePrice(continuesUsed: number): number | null {
  const { max, time } = ECONOMY.continues;
  if (continuesUsed >= max) return null;
  return round(time.price * time.growth ** continuesUsed, 5);
}

/**
 * Pays for using a booster now: one of the player's own if there is any, else one bought at its shop price and
 * used at once. Null if the player has none and too few coins.
 */
export function useOrBuyBooster(wallet: Wallet, booster: BoosterId): Wallet | null {
  if (wallet.boosters[booster] > 0) return useBooster(wallet, booster);
  const bought = buyBooster(wallet, booster);
  return bought && useBooster(bought, booster);
}

// ---------------------------------------------------------------- the wallet

export function addReward(wallet: Wallet, reward: Reward): Wallet {
  if (reward.kind === 'coins') return { ...wallet, coins: wallet.coins + reward.amount };
  return { ...wallet, boosters: { ...wallet.boosters, [reward.booster]: wallet.boosters[reward.booster] + reward.amount } };
}

/** Pays `coins`, or null if the player has fewer. */
export function spend(wallet: Wallet, coins: number): Wallet | null {
  return wallet.coins >= coins ? { ...wallet, coins: wallet.coins - coins } : null;
}

/** Buys one unit of a booster with coins, or null if the player cannot afford it. */
export function buyBooster(wallet: Wallet, booster: BoosterId): Wallet | null {
  const paid = spend(wallet, boosterPrice(booster));
  return paid && addReward(paid, { kind: 'booster', booster, amount: 1 });
}

/** Uses one unit of a booster, or null if the player has none. */
export function useBooster(wallet: Wallet, booster: BoosterId): Wallet | null {
  const have = wallet.boosters[booster];
  return have > 0 ? { ...wallet, boosters: { ...wallet.boosters, [booster]: have - 1 } } : null;
}

/** The booster's one-line intro: marks it introduced and gives its gift units (once). */
export function introduceBooster(wallet: Wallet, booster: BoosterId): Wallet {
  if (wallet.introduced.includes(booster)) return wallet;
  return { ...addReward(wallet, boosterGift(booster)), introduced: [...wallet.introduced, booster] };
}

/**
 * Everything a win brings: coins, experience, any level-ups with their gifts, and the new stars towards the next
 * chest (chests are opened by the player, on the home screen).
 */
export interface WinRewards {
  readonly wallet: Wallet;
  readonly coins: number;
  readonly xp: number;
  readonly levelBefore: number;
  readonly levelUps: readonly { readonly level: number; readonly gift: Reward }[];
  /** New stars this win added towards chests (the wallet's chestStars already counts them). */
  readonly chestStars: number;
}

export interface WinFacts {
  readonly levelNumber: number;
  readonly firstClear: boolean;
  readonly stars: number;
  readonly bestStarsBefore: number;
  readonly score: number;
  readonly totalStarsBefore: number;
  readonly totalStarsAfter: number;
}

/** Applies a win to the wallet: coins, experience and level-up gifts, and its new stars towards chests. */
export function rewardWin(wallet: Wallet, win: WinFacts): WinRewards {
  const coins = winCoins(win.firstClear, win.stars, win.bestStarsBefore);
  const xp = xpForScore(win.score);
  const levelBefore = playerLevel(wallet.xp).level;
  let next: Wallet = { ...wallet, coins: wallet.coins + coins, xp: wallet.xp + xp };
  const levelAfter = playerLevel(next.xp).level;
  const levelUps: { level: number; gift: Reward }[] = [];
  for (let level = levelBefore + 1; level <= levelAfter; level++) {
    const gift = levelUpGift(level);
    levelUps.push({ level, gift });
    next = addReward(next, gift);
  }
  const chestStars = Math.max(0, win.totalStarsAfter - win.totalStarsBefore);
  next = { ...next, chestStars: next.chestStars + chestStars };
  return { wallet: next, coins, xp, levelBefore, levelUps, chestStars };
}
