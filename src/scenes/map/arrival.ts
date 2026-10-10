import type * as Phaser from 'phaser';
import type { WinRewards } from '../../core/economy';
import type { Reward } from '../../data/economy';

/** What the game hands the map after a win. */
export interface Arrival {
  /** The level just won (index in play order). */
  readonly level: number;
  /** Most stars in that level before and after this win. */
  readonly starsBefore: number;
  readonly starsAfter: number;
  /** Total stars before this win. */
  readonly totalBefore: number;
  /** The level the player goes on to: the first not completed (or the same one when all are done). */
  readonly next: number;
  /** What the win paid: coins, experience, level-ups with their gifts, and stars towards the next chest. */
  readonly rewards?: WinRewards;
}

/** What the steps of the arrival sequence can act on. */
export interface ArrivalStage {
  readonly scene: Phaser.Scene;
  readonly arrival: Arrival;
  /** Where a level's plaque is on screen (world coordinates). */
  nodeOnScreen(level: number): { x: number; y: number };
  /** A star image at a point, above everything, for flying to the counter. */
  spawnStar(x: number, y: number): Phaser.GameObjects.Image;
  /** Where the total stars counter is on screen. */
  starsCounter(): { x: number; y: number };
  /** Sets the total stars shown, with a little bump. */
  showTotal(total: number, bump: boolean): void;
  /** Moves the player's pin to `level` (animated unless `instant`). */
  moveMarker(from: number, to: number, instant: boolean): Promise<void>;
  /** Makes the play button stand out: the one tap to go on. */
  callToPlay(): void;
  /** A coin image at a point, above everything, for flying to the coins counter. */
  spawnCoin(x: number, y: number): Phaser.GameObjects.Image;
  /** Where the coins counter is on screen. */
  coinsCounter(): { x: number; y: number };
  /** Sets the coins shown, with a little bump. */
  showCoins(coins: number, bump: boolean): void;
  /** Sets the player's level and its bar for an amount of experience (animated unless `instant`). */
  showXp(xp: number, instant: boolean): Promise<void>;
  /** Sets the stars shown towards the next chest (with a little bump); the chest lights up once it can open. */
  showChestStars(stars: number, bump: boolean): void;
  /** Shows a reward card (a new player level) for a moment; resolves once it has gone. */
  showCard(card: RewardCard): Promise<void>;
  /** Takes away any reward card at once (the player skipped). */
  closeCards(): void;
  play(effect: 'starCollect' | 'mapStep' | 'unlock' | 'star3'): void;
}

/** A moment of reward after a win: the player reaching a new level, with its gift. */
export interface RewardCard {
  readonly kind: 'levelUp';
  readonly level: number;
  readonly rewards: readonly Reward[];
}

const coinsIn = (rewards: readonly Reward[]) => rewards.reduce((sum, reward) => sum + (reward.kind === 'coins' ? reward.amount : 0), 0);

/** The coins the player had before a win: the wallet after it, less the win's coins and the coins in its gifts. */
export function coinsBefore(rewards: WinRewards): number {
  const gifts = rewards.levelUps.map((up) => up.gift);
  return rewards.wallet.coins - rewards.coins - coinsIn(gifts);
}

/** The reward cards a win brings: one per new player level. */
export function rewardCards(rewards: WinRewards): RewardCard[] {
  return [
    ...rewards.levelUps.map((up): RewardCard => ({ kind: 'levelUp', level: up.level, rewards: [up.gift] })),
  ];
}

/**
 * One moment of the sequence. `play` animates it and resolves when done; `finish` jumps to its end state at once
 * (the player tapped to skip). Each step must leave the same state either way.
 */
export interface ArrivalStep {
  readonly name: string;
  play(stage: ArrivalStage): Promise<void>;
  finish(stage: ArrivalStage): void;
}

/** New stars fly from the level's plaque to the total, one after another, and the total counts up. */
export const starsFly: ArrivalStep = {
  name: 'starsFly',
  play(stage) {
    const { scene, arrival } = stage;
    const gained = Math.max(0, arrival.starsAfter - arrival.starsBefore);
    if (gained === 0) return Promise.resolve();
    const from = stage.nodeOnScreen(arrival.level);
    const to = stage.starsCounter();
    return new Promise((resolve) => {
      for (let i = 0; i < gained; i++) {
        const star = stage.spawnStar(from.x, from.y).setDisplaySize(28, 28);
        const progress = { k: 0 };
        scene.tweens.add({
          targets: progress,
          k: 1,
          delay: i * 140,
          duration: 520,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const k = progress.k;
            // An arc: up and over, towards the counter.
            star.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * 80);
            star.setDisplaySize(28 - 8 * k, 28 - 8 * k);
          },
          onComplete: () => {
            star.destroy();
            stage.play('starCollect');
            stage.showTotal(arrival.totalBefore + i + 1, true);
            if (i === gained - 1) resolve();
          },
        });
      }
    });
  },
  finish(stage) {
    const { arrival } = stage;
    stage.showTotal(arrival.totalBefore + Math.max(0, arrival.starsAfter - arrival.starsBefore), false);
  },
};

/** The win's coins fly from the level's plaque to the coins counter, which counts up. */
export const coinsFly: ArrivalStep = {
  name: 'coinsFly',
  play(stage) {
    const { scene, arrival } = stage;
    const rewards = arrival.rewards;
    if (!rewards || rewards.coins === 0) return Promise.resolve();
    const base = coinsBefore(rewards);
    const from = stage.nodeOnScreen(arrival.level);
    const to = stage.coinsCounter();
    const flights = Math.min(6, Math.max(2, Math.round(rewards.coins / 10)));
    return new Promise((resolve) => {
      for (let i = 0; i < flights; i++) {
        const coin = stage.spawnCoin(from.x, from.y).setDisplaySize(24, 24);
        const progress = { k: 0 };
        scene.tweens.add({
          targets: progress,
          k: 1,
          delay: i * 90,
          duration: 480,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const k = progress.k;
            coin.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * 60);
          },
          onComplete: () => {
            coin.destroy();
            stage.play('starCollect');
            stage.showCoins(base + Math.round((rewards.coins * (i + 1)) / flights), true);
            if (i === flights - 1) resolve();
          },
        });
      }
    });
  },
  finish(stage) {
    const rewards = stage.arrival.rewards;
    if (rewards) stage.showCoins(coinsBefore(rewards) + rewards.coins, false);
  },
};

/**
 * The experience bar fills with the win's points, and each new player level shows its card and gift (the coins
 * counter takes in the coins it gives).
 */
export const rewardsShow: ArrivalStep = {
  name: 'rewardsShow',
  async play(stage) {
    const rewards = stage.arrival.rewards;
    if (!rewards) return;
    let coins = coinsBefore(rewards) + rewards.coins;
    const xpBefore = rewards.wallet.xp - rewards.xp;
    if (rewards.xp > 0) await stage.showXp(rewards.wallet.xp, false);
    else void stage.showXp(xpBefore, true);
    for (const card of rewardCards(rewards)) {
      stage.play('star3');
      await stage.showCard(card);
      coins += coinsIn(card.rewards);
      stage.showCoins(coins, coinsIn(card.rewards) > 0);
    }
  },
  finish(stage) {
    const rewards = stage.arrival.rewards;
    if (!rewards) return;
    stage.closeCards();
    stage.showCoins(rewards.wallet.coins, false);
    void stage.showXp(rewards.wallet.xp, true);
  },
};

/** The stars towards chests before a win: the wallet's count after it, less the win's new stars. */
export const chestStarsBefore = (rewards: WinRewards): number => rewards.wallet.chestStars - rewards.chestStars;

/**
 * The win's new stars count up on the chest's progress, one by one; if they reach the target the chest lights up
 * and waits for the player to open it (it never opens by itself).
 */
export const chestFill: ArrivalStep = {
  name: 'chestFill',
  play(stage) {
    const rewards = stage.arrival.rewards;
    if (!rewards || rewards.chestStars === 0) return Promise.resolve();
    const from = chestStarsBefore(rewards);
    const counter = { n: from };
    let shown = from;
    return new Promise((resolve) => {
      stage.scene.tweens.add({
        targets: counter,
        n: rewards.wallet.chestStars,
        duration: 160 * rewards.chestStars,
        ease: 'Linear',
        onUpdate: () => {
          const n = Math.floor(counter.n);
          if (n === shown) return;
          shown = n;
          stage.showChestStars(n, true);
        },
        onComplete: () => {
          stage.showChestStars(rewards.wallet.chestStars, true);
          resolve();
        },
      });
    });
  },
  finish(stage) {
    const rewards = stage.arrival.rewards;
    if (rewards) stage.showChestStars(rewards.wallet.chestStars, false);
  },
};

/** The player's pin walks the path from the level won to the next one. */
export const markerWalk: ArrivalStep = {
  name: 'markerWalk',
  play(stage) {
    const { arrival } = stage;
    if (arrival.next === arrival.level) return Promise.resolve();
    return stage.moveMarker(arrival.level, arrival.next, false);
  },
  finish(stage) {
    void stage.moveMarker(stage.arrival.level, stage.arrival.next, true);
  },
};

/** Ends on the play button, highlighted: a single tap to go on. */
export const callToPlay: ArrivalStep = {
  name: 'callToPlay',
  play(stage) {
    stage.callToPlay();
    return Promise.resolve();
  },
  finish(stage) {
    stage.callToPlay();
  },
};

/** The steps after a win, in order. */
export const ARRIVAL_STEPS: readonly ArrivalStep[] = [starsFly, chestFill, coinsFly, rewardsShow, markerWalk, callToPlay];

/** Runs steps one after another; skip() jumps every step left to its end state. */
export class ArrivalSequence {
  private index = 0;
  private skipped = false;
  private done = false;

  constructor(
    private readonly stage: ArrivalStage,
    private readonly steps: readonly ArrivalStep[] = ARRIVAL_STEPS,
  ) {}

  get running(): boolean {
    return !this.done;
  }

  async run(): Promise<void> {
    for (; this.index < this.steps.length; this.index++) {
      if (this.skipped) return;
      await this.steps[this.index]!.play(this.stage);
    }
    this.done = true;
  }

  /**
   * Ends the sequence now: the current step and the ones after it jump to their end state. The scene stops the
   * sequence's animations first (see HomeScene).
   */
  skip(): void {
    if (this.done || this.skipped) return;
    this.skipped = true;
    this.done = true;
    for (let i = this.index; i < this.steps.length; i++) this.steps[i]!.finish(this.stage);
  }
}
