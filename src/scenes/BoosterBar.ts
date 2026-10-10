import * as Phaser from 'phaser';
import type { BoosterId } from '../data/economy';
import type { Rect } from '../ui/boardLayout';
import { hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import { KitIconButton, kitText, uiIcon } from './kit';

const DEPTH_BAR = 150;
const BUTTON = 52;

/**
 * The boosters during a level, at the bottom (portrait) or down the right side (landscape): one round button
 * per unlocked booster with how many the player has, or a plus when none is left (tapping it offers to buy one).
 * The one in use (aiming "remove a triple", a running freeze) is ringed.
 */
export class BoosterBar {
  private parts: Phaser.GameObjects.GameObject[] = [];
  private buttons = new Map<BoosterId, KitIconButton>();
  private rings = new Map<BoosterId, Phaser.GameObjects.Graphics>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPress: (booster: BoosterId) => void,
  ) {}

  /** Draws the bar in `rect` for the unlocked boosters and their counts. */
  build(rect: Rect, boosters: readonly BoosterId[], counts: Readonly<Record<BoosterId, number>>): void {
    this.clear();
    if (boosters.length === 0) return;
    const vertical = rect.height > rect.width;
    const gap = SPACE.m;
    const total = boosters.length * BUTTON + (boosters.length - 1) * gap;
    boosters.forEach((id, i) => {
      const along = -total / 2 + BUTTON / 2 + i * (BUTTON + gap);
      const x = vertical ? rect.x + rect.width / 2 : rect.x + rect.width / 2 + along;
      const y = vertical ? rect.y + rect.height / 2 + along : rect.y + rect.height / 2;
      const ring = this.scene.add.graphics().setDepth(DEPTH_BAR).setVisible(false);
      ring.lineStyle(4, hexNumber(SKIN.status.combo), 1).strokeCircle(x, y, BUTTON / 2 + 6);
      const button = new KitIconButton(this.scene, x, y, { skin: SKIN, icon: id, look: 'secondary', size: BUTTON, onPress: () => this.onPress(id) }).setDepth(DEPTH_BAR);
      // How many: a dark badge with the number, or a plus to buy one.
      const bx = x + BUTTON * 0.36;
      const by = y - BUTTON * 0.36;
      const badge = this.scene.add.graphics().setDepth(DEPTH_BAR + 1);
      badge.fillStyle(hexNumber(SKIN.surface.border), 1).fillCircle(bx, by, 12);
      badge.lineStyle(2, hexNumber(SKIN.surface.highlight), 1).strokeCircle(bx, by, 12);
      const count = counts[id];
      const mark =
        count > 0
          ? kitText(this.scene, 'caption', String(count), SKIN.text.primary, 13).setPosition(bx, by)
          : uiIcon(this.scene, 'plus', SKIN.text.accent, 14).setPosition(bx, by);
      mark.setDepth(DEPTH_BAR + 2);
      this.parts.push(ring, button, badge, mark);
      this.buttons.set(id, button);
      this.rings.set(id, ring);
    });
  }

  /** Rings the booster in use (or none). */
  setActive(booster: BoosterId | null): void {
    for (const [id, ring] of this.rings) ring.setVisible(id === booster);
  }

  /** Where a booster's button is (for effects). */
  positionOf(booster: BoosterId): { x: number; y: number } | null {
    const button = this.buttons.get(booster);
    return button ? { x: button.x, y: button.y } : null;
  }

  clear(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    this.buttons.clear();
    this.rings.clear();
  }
}
