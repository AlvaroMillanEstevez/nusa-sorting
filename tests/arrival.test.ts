import { describe, expect, it } from 'vitest';
import { EMPTY_WALLET, rewardWin } from '../src/core/economy';
import { ECONOMY } from '../src/data/economy';
import { ArrivalSequence, coinsBefore, rewardCards, rewardsShow, type Arrival, type ArrivalStage, type ArrivalStep, type RewardCard } from '../src/scenes/map/arrival';

/** A step that records what happened to it and resolves when told to. */
function step(name: string, log: string[]): ArrivalStep & { release: () => void } {
  let release = () => {};
  return {
    name,
    play: () => {
      log.push(`play ${name}`);
      return new Promise<void>((resolve) => (release = () => resolve()));
    },
    finish: () => log.push(`finish ${name}`),
    release: () => release(),
  };
}

const stage = {} as ArrivalStage;

describe('arrival sequence', () => {
  it('plays its steps one after another', async () => {
    const log: string[] = [];
    const [a, b] = [step('a', log), step('b', log)];
    const sequence = new ArrivalSequence(stage, [a, b]);
    const done = sequence.run();
    expect(log).toEqual(['play a']);
    a.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(['play a', 'play b']);
    b.release();
    await done;
    expect(sequence.running).toBe(false);
  });

  it('skips to the end state of the current step and every one after it, once', async () => {
    const log: string[] = [];
    const [a, b, c] = [step('a', log), step('b', log), step('c', log)];
    const sequence = new ArrivalSequence(stage, [a, b, c]);
    void sequence.run();
    sequence.skip();
    sequence.skip();
    expect(log).toEqual(['play a', 'finish a', 'finish b', 'finish c']);
    expect(sequence.running).toBe(false);
    a.release();
    await Promise.resolve();
    expect(log).toHaveLength(4);
  });
});

/** A win with a level-up and a chest, from a wallet with some coins. */
function bigWin() {
  const wallet = { ...EMPTY_WALLET, coins: 70 };
  const every = ECONOMY.chests.everyStars;
  return rewardWin(wallet, {
    levelNumber: 12,
    firstClear: true,
    stars: 3,
    bestStarsBefore: 0,
    score: 4500,
    totalStarsBefore: every - 1,
    totalStarsAfter: every + 2,
  });
}

describe('arrival rewards', () => {
  it('works out the coins before the win from the wallet after it', () => {
    const rewards = bigWin();
    expect(rewards.levelUps.length).toBeGreaterThan(0);
    expect(rewards.chests).toHaveLength(1);
    expect(coinsBefore(rewards)).toBe(70);
  });

  it('shows level-ups first, then chests, each with its rewards', () => {
    const rewards = bigWin();
    const cards = rewardCards(rewards);
    expect(cards.map((card) => card.kind)).toEqual([...rewards.levelUps.map(() => 'levelUp'), 'chest']);
    expect(cards.at(-1)!.rewards).toEqual(rewards.chests[0]!.rewards);
  });

  it('ends on the wallet after the win whether it plays through or is skipped', async () => {
    const rewards = bigWin();
    const arrival: Arrival = { level: 11, starsBefore: 0, starsAfter: 3, totalBefore: 14, next: 12, rewards };
    const shown = { coins: coinsBefore(rewards) + rewards.coins, xp: 0, cards: [] as RewardCard[], closed: 0 };
    const fake = {
      arrival,
      showCoins: (coins: number) => (shown.coins = coins),
      showXp: (xp: number) => {
        shown.xp = xp;
        return Promise.resolve();
      },
      showCard: (card: RewardCard) => {
        shown.cards.push(card);
        return Promise.resolve();
      },
      closeCards: () => shown.closed++,
      play: () => {},
    } as unknown as ArrivalStage;
    await rewardsShow.play(fake);
    expect(shown).toMatchObject({ coins: rewards.wallet.coins, xp: rewards.wallet.xp });
    expect(shown.cards).toHaveLength(rewardCards(rewards).length);
    shown.coins = 0;
    rewardsShow.finish(fake);
    expect(shown).toMatchObject({ coins: rewards.wallet.coins, xp: rewards.wallet.xp, closed: 1 });
  });
});
