import * as Phaser from 'phaser';
import { DURATION, EASE, type Skin } from '../../ui/design/tokens';
import { uiIcon } from './uiIconTextures';

/**
 * A row of three stars. An earned star is a filled star; one not earned is a hollow outline, so the count
 * never depends on colour. fill() fills them one by one, each with a pop and a callback (for its sound).
 */
export class KitStars extends Phaser.GameObjects.Container {
  private readonly slots: { empty: Phaser.GameObjects.Image; full: Phaser.GameObjects.Image; size: number }[] = [];

  /** `size`: the middle star's size; the outer ones are a little smaller and lower when `arched`. */
  constructor(scene: Phaser.Scene, x: number, y: number, skin: Skin, size: number, arched = true) {
    super(scene, x, y);
    const gap = size * 0.08;
    [-1, 0, 1].forEach((i) => {
      const s = arched && i !== 0 ? size * 0.8 : size;
      const sx = i * (size * 0.5 + s * 0.5 + gap);
      const sy = arched && i !== 0 ? size * 0.14 : 0;
      const empty = uiIcon(scene, 'star', skin.star.rim, s).setPosition(sx, sy);
      const full = uiIcon(scene, 'starFilled', skin.star.filled, s).setPosition(sx, sy).setVisible(false);
      this.slots.push({ empty, full, size: s });
      this.add([empty, full]);
    });
    scene.add.existing(this);
  }

  /** Shows `count` stars filled at once. */
  setStars(count: number): this {
    this.slots.forEach((slot, i) => {
      this.scene.tweens.killTweensOf(slot.full);
      slot.full.setVisible(i < count).setDisplaySize(slot.size, slot.size);
    });
    return this;
  }

  /** Fills `count` stars one after another from `delay` ms, calling `onStar(n)` as star n (1-3) lands. */
  fill(count: number, delay: number, onStar?: (n: number) => void): this {
    this.setStars(0);
    this.slots.slice(0, count).forEach((slot, i) => {
      const { full, size } = slot;
      full.setDisplaySize(1, 1).setVisible(false);
      this.scene.tweens.add({
        targets: full,
        displayWidth: size,
        displayHeight: size,
        delay: delay + i * STAR_STEP_MS,
        duration: DURATION.slow,
        ease: EASE.pop,
        onStart: () => {
          full.setVisible(true);
          onStar?.(i + 1);
        },
      });
    });
    return this;
  }
}

/** Time between one star filling and the next. */
export const STAR_STEP_MS = 320;
