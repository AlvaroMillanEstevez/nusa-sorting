import { BOOSTER_IDS, boosterGift, ECONOMY, type BoosterId, type Reward } from '../data/economy';
import { nextRandom } from './random';

/**
 * The economy and the player's progression, as pure functions over the values in src/data/economy.ts: coins
 * for wins, the player's level from experience, gifts for levelling up, star chests, booster prices and
 * continues. One currency (coins); nothing is bought with real money.
 */

/** What the player owns and has been through, saved with the progress. */
export interface Wallet {
  readonly coins: number;
  /** Experience: every level's score adds to it. */
  readonly xp: number;
  readonly boosters: Readonly<Record<BoosterId, number>>;
  /** Star chests already opened (the next one comes at (opened + 1) × everyStars stars). */
  readonly chestsOpened: number;
  /** Boosters whose one-line intro (and gift) the player has had. */
  readonly introduced: readonly BoosterId[];
}

export const EMPTY_WALLET: Wallet = { coins: 0, xp: 0, boosters: { freeze: 0, removeTriple: 0, shuffle: 0 }, chestsOpened: 0, introduced: [] };

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

/** Chests (numbered from 1) earned by going from `before` to `after` stars collected. */
export function chestsEarned(before: number, after: number): number[] {
  const every = ECONOMY.chests.everyStars;
  const chests: number[] = [];
  for (let n = Math.floor(before / every) + 1; n * every <= after; n++) chests.push(n);
  return chests;
}

/** Stars still needed for the next chest, and how many a chest takes. */
export function nextChest(totalStars: number): { have: number; every: number } {
  const every = ECONOMY.chests.everyStars;
  return { have: totalStars % every, every };
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

export type ContinueKind = 'time' | 'space';

/** The price of the continue number `index` (0 for the first) in an attempt, or null past the maximum. */
export function continuePrice(kind: ContinueKind, index: number): number | null {
  const { max, growth, time, space } = ECONOMY.continues;
  if (index >= max) return null;
  return round((kind === 'time' ? time.price : space.price) * growth ** index, 5);
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

/** Everything a win brings: coins, experience, any level-ups with their gifts, any chests with their contents. */
export interface WinRewards {
  readonly wallet: Wallet;
  readonly coins: number;
  readonly xp: number;
  readonly levelBefore: number;
  readonly levelUps: readonly { readonly level: number; readonly gift: Reward }[];
  readonly chests: readonly { readonly number: number; readonly rewards: readonly Reward[] }[];
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

/** Applies a win to the wallet: coins, experience and level-up gifts, and the chests the new stars reach. */
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
  const unlocked = boostersUnlockedAt(win.levelNumber);
  const chests = chestsEarned(win.totalStarsBefore, win.totalStarsAfter)
    .filter((number) => number > next.chestsOpened)
    .map((number) => ({ number, rewards: chestContents(number, unlocked) }));
  for (const chest of chests) for (const reward of chest.rewards) next = addReward(next, reward);
  if (chests.length > 0) next = { ...next, chestsOpened: chests.at(-1)!.number };
  return { wallet: next, coins, xp, levelBefore, levelUps, chests };
}
