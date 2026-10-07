import type * as Phaser from 'phaser';

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
  play(effect: 'starCollect' | 'mapStep'): void;
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

/**
 * The steps after a win, in order. The next milestone adds its moments here, before callToPlay: the player
 * levelling up, gifts and chests earned with stars.
 */
export const ARRIVAL_STEPS: readonly ArrivalStep[] = [starsFly, markerWalk, callToPlay];

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
