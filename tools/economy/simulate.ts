import {
  boosterPrice,
  boostersUnlockedAt,
  continuePrice,
  EMPTY_WALLET,
  introduceBooster,
  playerLevel,
  rewardWin,
  starThresholds,
  type Wallet,
} from '../../src/core';
import { BOOSTER_IDS, ECONOMY, type BoosterId, type Reward } from '../../src/data/economy';
import { levels } from '../../src/data/levels';

/**
 * A balance check of the economy over the 24 levels (outside the game build). The player wins every level with
 * two stars on average, replays its weakest level every fourth level (earning one more star), and loses one
 * level in three once, continuing once (out of time and out of space in turn). Two runs: one keeps every coin (what could be afforded),
 * one buys the cheapest booster whenever it has its price plus a reserve (what a spender would hold).
 */

/** Stars of each first win, in turn: averages 2. */
const FIRST_STARS = [2, 2, 3, 1, 2, 2, 3, 1, 2, 2] as const;
const RESERVE = 100;

/** A score that earns `stars` on a level. */
function scoreFor(level: (typeof levels)[number], stars: number): number {
  const { two, three } = starThresholds(level);
  return stars === 1 ? Math.round(two * 0.85) : stars === 2 ? Math.round((two + three) / 2) : Math.round(three * 1.1);
}

const boosterUnits = (rewards: readonly Reward[]) => rewards.reduce((n, r) => n + (r.kind === 'booster' ? r.amount : 0), 0);
const coinsOf = (rewards: readonly Reward[]) => rewards.reduce((n, r) => n + (r.kind === 'coins' ? r.amount : 0), 0);
const totalBoosters = (w: Wallet) => BOOSTER_IDS.reduce((n, id) => n + w.boosters[id], 0);

interface Row {
  level: number;
  stars: number;
  earned: number;
  balance: number;
  playerLevel: number;
  chests: number;
  freeBoosters: number;
  bought: number;
  held: number;
}

function run(spender: boolean): Row[] {
  let wallet: Wallet = EMPTY_WALLET;
  const best: number[] = [];
  let totalStars = 0;
  let freeBoosters = 0;
  let bought = 0;
  let continues = 0;
  const rows: Row[] = [];
  const win = (index: number, stars: number) => {
    const level = levels[index]!;
    const before = best[index] ?? 0;
    const after = Math.max(before, stars);
    const rewards = rewardWin(wallet, {
      levelNumber: index + 1,
      firstClear: best[index] === undefined,
      stars,
      bestStarsBefore: before,
      score: scoreFor(level, stars),
      totalStarsBefore: totalStars,
      totalStarsAfter: totalStars - before + after,
    });
    totalStars += after - before;
    best[index] = after;
    wallet = rewards.wallet;
    freeBoosters += rewards.levelUps.reduce((n, l) => n + boosterUnits([l.gift]), 0) + rewards.chests.reduce((n, c) => n + boosterUnits(c.rewards), 0);
    return rewards.coins + rewards.levelUps.reduce((n, l) => n + coinsOf([l.gift]), 0) + rewards.chests.reduce((n, c) => n + coinsOf(c.rewards), 0);
  };

  for (let i = 0; i < levels.length; i++) {
    // A booster's first appearance: its intro gift.
    for (const id of boostersUnlockedAt(i + 1)) {
      if (!wallet.introduced.includes(id)) {
        wallet = introduceBooster(wallet, id);
        freeBoosters += ECONOMY.boosters[id].gift;
      }
    }
    // One level in three is lost once and continued once (out of time and out of space in turn), if affordable.
    if (i % 3 === 2) {
      const price = continuePrice(i % 2 === 0 ? 'time' : 'space', 0)!;
      if (wallet.coins >= price) {
        wallet = { ...wallet, coins: wallet.coins - price };
        continues += price;
      }
    }
    let earned = win(i, FIRST_STARS[i % FIRST_STARS.length]!);
    // Every fourth level: replay the weakest level so far for one more star.
    if (i % 4 === 3) {
      const weakest = best.reduce((lo, s, k) => (s < best[lo]! ? k : lo), 0);
      earned += win(weakest, Math.min(3, best[weakest]! + 1));
    }
    if (spender) {
      const unlocked = boostersUnlockedAt(i + 1);
      const cheapest = unlocked.sort((a, b) => boosterPrice(a) - boosterPrice(b))[0] as BoosterId | undefined;
      while (cheapest && wallet.coins >= boosterPrice(cheapest) + RESERVE) {
        wallet = { ...wallet, coins: wallet.coins - boosterPrice(cheapest), boosters: { ...wallet.boosters, [cheapest]: wallet.boosters[cheapest] + 1 } };
        bought++;
      }
    }
    rows.push({
      level: i + 1,
      stars: FIRST_STARS[i % FIRST_STARS.length]!,
      earned,
      balance: wallet.coins,
      playerLevel: playerLevel(wallet.xp).level,
      chests: wallet.chestsOpened,
      freeBoosters,
      bought,
      held: totalBoosters(wallet),
    });
  }
  spentOnContinues = continues;
  return rows;
}

let spentOnContinues = 0;

export function main(): string {
  const saver = run(false);
  const continueCoins = spentOnContinues;
  const spender = run(true);
  const avgPrice = BOOSTER_IDS.reduce((n, id) => n + boosterPrice(id), 0) / BOOSTER_IDS.length;
  const lines = ['level | stars | coins earned | balance (saver) | player level | chests | free boosters | bought (spender) | held (spender)'];
  saver.forEach((row, i) => {
    const s = spender[i]!;
    lines.push(`L${row.level} | ${row.stars} | ${row.earned} | ${row.balance} | ${row.playerLevel} | ${row.chests} | ${row.freeBoosters} | ${s.bought} | ${s.held}`);
  });
  const last = saver.at(-1)!;
  const affordable = Math.floor(last.balance / avgPrice);
  const total = last.freeBoosters + affordable;
  lines.push('');
  lines.push(`Continues cost ${continueCoins} coins over the 24 levels.`);
  lines.push(`By level 24 the saver has ${last.balance} coins (${affordable} boosters at the average price of ${Math.round(avgPrice)}) and got ${last.freeBoosters} boosters free.`);
  lines.push(`Boosters within reach: ${total} over 24 levels, one every ${(24 / total).toFixed(1)} levels (from level 4, when the first unlocks: one every ${(21 / total).toFixed(1)}).`);
  lines.push(`The spender bought ${spender.at(-1)!.bought} and holds ${spender.at(-1)!.held} at the end (unused, as it never needs them in this model).`);
  return lines.join('\n');
}
