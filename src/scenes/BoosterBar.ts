import type * as Phaser from 'phaser';
import { BOOSTER_IDS, type BoosterId } from '../data/economy';
import type { Rect } from '../ui/boardLayout';
import { SPACE } from '../ui/design/tokens';
import { boosterTextureKey } from './boosterTextures';
import { KitBoosterButton } from './kit';

const DEPTH_BAR = 150;
const BUTTON = 56;

/**
 * The boosters during a level, at the bottom (portrait) or down the right side (landscape): a tile per booster
 * (KitBoosterButton) with how many the player has, a "+" when none is left (tapping it offers to buy one), or a
 * padlock while it is not unlocked yet. Shown from the level that unlocks the first booster; the one in use
 * (aiming "remove a triple", a running freeze) is ringed.
 */
export class BoosterBar {
  private readonly buttons = new Map<BoosterId, KitBoosterButton>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPress: (booster: BoosterId) => void,
  ) {}

  /** Draws the bar in `rect`, given the boosters unlocked and how many the player has of each. */
  build(rect: Rect, unlocked: readonly BoosterId[], counts: Readonly<Record<BoosterId, number>>): void {
    this.clear();
    if (unlocked.length === 0) return;
    const vertical = rect.height > rect.width;
    const gap = SPACE.m;
    const total = BOOSTER_IDS.length * BUTTON + (BOOSTER_IDS.length - 1) * gap;
    BOOSTER_IDS.forEach((id, i) => {
      const along = -total / 2 + BUTTON / 2 + i * (BUTTON + gap);
      const x = vertical ? rect.x + rect.width / 2 : rect.x + rect.width / 2 + along;
      const y = vertical ? rect.y + rect.height / 2 + along : rect.y + rect.height / 2;
      const state = !unlocked.includes(id) ? 'locked' : counts[id] > 0 ? 'ready' : 'empty';
      const button = new KitBoosterButton(this.scene, x, y, {
        texture: boosterTextureKey(id),
        size: BUTTON,
        state,
        count: counts[id],
        onPress: () => this.onPress(id),
      }).setDepth(DEPTH_BAR);
      this.buttons.set(id, button);
    });
  }

  /** Rings the booster in use (or none). */
  setActive(booster: BoosterId | null): void {
    for (const [id, button] of this.buttons) button.setInUse(id === booster);
  }

  /** Where a booster's button is (for effects). */
  positionOf(booster: BoosterId): { x: number; y: number } | null {
    const button = this.buttons.get(booster);
    return button ? { x: button.x, y: button.y } : null;
  }

  clear(): void {
    for (const button of this.buttons.values()) button.destroy();
    this.buttons.clear();
  }
}
