import * as Phaser from 'phaser';
import type { Rect } from '../ui/boardLayout';
import { WOOD } from '../ui/art/wood';
import { DURATION, EASE, hexNumber, SKIN } from '../ui/design/tokens';
import { kitText, reducedMotion, uiIcon } from './kit';

/**
 * Screen shakes: short and small (a bigger shake was fun but could make people feel unwell). Intensity is a share
 * of the screen size.
 */
export const SHAKE = {
  combo: { duration: 90, intensity: 0.0012, perStep: 0.0002 },
  blocked: { duration: 200, intensity: 0.0025 },
} as const;

/** Over the items and the HUD's pills, under panels. */
const DEPTH_FX = 130;

/** Small textures the particles use, drawn once per game. */
function prepareTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx:spark')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // A soft round spark.
  for (let r = 8; r > 0; r--) g.fillStyle(0xffffff, 0.12 + (8 - r) * 0.1).fillCircle(8, 8, r);
  g.generateTexture('fx:spark', 16, 16).clear();
  // A wood chip.
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 10, 6);
  g.generateTexture('fx:chip', 10, 6).clear();
  // A strip of confetti.
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 12);
  g.generateTexture('fx:confetti', 8, 12).clear();
  g.destroy();
}

const WARM = [SKIN.status.combo, SKIN.text.primary, SKIN.fills.primary.face].map(hexNumber);

/**
 * The game's effects: bursts when a triple clears (bigger with the combo), points flying to the score, the
 * moments a shelf opens or the blocker breaks, the warning when the board runs out of space, and confetti for a
 * win. Emitters are made once and fired with explode(), and every effect is a tween over things that take no
 * input, so none ever holds up the next move.
 */
export class Effects {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly chips: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;

  /** `depth`: where the effects draw (over the board and HUD by default; a scene's panels may want them higher). */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = DEPTH_FX,
  ) {
    prepareTextures(scene);
    this.sparks = scene.add
      .particles(0, 0, 'fx:spark', {
        emitting: false,
        speed: { min: 60, max: 220 },
        lifespan: { min: 300, max: 560 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: WARM,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(this.depth);
    this.chips = scene.add
      .particles(0, 0, 'fx:chip', {
        emitting: false,
        speed: { min: 120, max: 300 },
        angle: { min: 200, max: 340 },
        gravityY: 900,
        lifespan: 700,
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.6 },
        alpha: { start: 1, end: 0 },
        tint: [WOOD.crate, WOOD.crateLight, WOOD.crateDark].map(hexNumber),
      })
      .setDepth(this.depth);
    this.confetti = scene.add
      .particles(0, 0, 'fx:confetti', {
        emitting: false,
        speed: { min: 200, max: 520 },
        angle: { min: 230, max: 310 },
        gravityY: 520,
        lifespan: 1600,
        rotate: { min: 0, max: 360 },
        scaleX: { start: 1, end: 0.4 },
        alpha: { start: 1, end: 0.2 },
        tint: [SKIN.fills.primary.face, SKIN.fills.danger.face, SKIN.fills.positive.face, SKIN.text.primary, '#5ab4ff'].map(hexNumber),
      })
      .setDepth(this.depth + 5);
  }

  /** A burst of sparks where a triple cleared; the combo makes it bigger. */
  tripleBurst(x: number, y: number, size: number, combo: number): void {
    const boost = Math.min(4, Math.max(0, combo - 1));
    this.sparks.setParticleScale(0.6 + boost * 0.15, 0);
    this.sparks.explode(10 + boost * 6, x, y);
    // A ring that opens out from the shelf.
    const ring = this.scene.add.graphics().setPosition(x, y).setDepth(this.depth);
    ring.lineStyle(3 + boost, hexNumber(SKIN.status.combo), 0.9).strokeCircle(0, 0, size * 0.3);
    this.scene.tweens.add({ targets: ring, scale: 2.2 + boost * 0.3, alpha: 0, duration: 380, ease: EASE.enter, onComplete: () => ring.destroy() });
  }

  /**
   * "+points" rising from where they were scored and flying to the score pill; `onArrive` runs when they land
   * (for the counter to count up).
   */
  flyPoints(text: string, from: { x: number; y: number }, to: { x: number; y: number }, delay: number, onArrive: () => void): void {
    const label = kitText(this.scene, 'number', text, SKIN.text.primary, 22).setStroke(SKIN.surface.border, 5).setPosition(from.x, from.y).setDepth(this.depth + 2).setAlpha(0);
    const progress = { k: 0 };
    this.scene.tweens.chain({
      targets: label,
      tweens: [
        { alpha: 1, y: from.y - 26, scale: 1.15, delay, duration: 220, ease: EASE.pop },
        {
          targets: progress,
          k: 1,
          duration: 420,
          ease: 'Cubic.easeIn',
          onUpdate: () => {
            const k = progress.k;
            label.setPosition(from.x + (to.x - from.x) * k, from.y - 26 + (to.y - from.y + 26) * k).setScale(1.15 - 0.5 * k);
          },
          onComplete: () => {
            label.destroy();
            onArrive();
          },
        },
      ],
    });
  }

  /**
   * The market day's coins for a triple: a coin and "+N" that rise a little from where it was made and fade (they
   * are paid with the win, so nothing flies to a counter). Smaller and quieter than the points.
   */
  marketCoins(text: string, at: { x: number; y: number }, delay: number): void {
    const label = kitText(this.scene, 'number', text, SKIN.text.accent, 18).setStroke(SKIN.surface.border, 4).setOrigin(0, 0.5);
    const coin = uiIcon(this.scene, 'coin', SKIN.text.accent, 22);
    const width = 22 + 4 + label.width;
    coin.setX(-width / 2 + 11);
    label.setX(-width / 2 + 26);
    const chip = this.scene.add.container(at.x, at.y, [coin, label]).setDepth(this.depth + 2).setAlpha(0);
    const still = reducedMotion();
    this.scene.tweens.chain({
      targets: chip,
      tweens: [
        { alpha: 1, y: at.y - (still ? 0 : 18), delay, duration: DURATION.base, ease: EASE.enter },
        { alpha: 0, y: at.y - (still ? 0 : 34), delay: 520, duration: DURATION.base, ease: EASE.exit },
      ],
      onComplete: () => chip.destroy(),
    });
  }

  /**
   * The combo: "Combo ×N!" growing with the multiplier, warmer and bigger each step; from ×5 the screen gives a
   * small shake.
   */
  comboBurst(x: number, y: number, combo: number, delay: number, screenWidth: number): void {
    const step = Math.min(6, combo - 2);
    const size = 22 + step * 4;
    const label = kitText(this.scene, 'title', `Combo ×${combo}!`, combo >= 5 ? SKIN.fills.danger.light : SKIN.status.combo, size)
      .setStroke(SKIN.surface.border, 6)
      .setPosition(x, y)
      .setDepth(this.depth + 3)
      .setScale(reducedMotion() ? 1 + step * 0.06 : 0.4)
      .setAlpha(0);
    // Kept on screen whatever the shelf, at its biggest.
    const half = (label.width * (1 + step * 0.06)) / 2 + 8;
    label.setX(Math.max(half, Math.min(screenWidth - half, x)));
    this.scene.tweens.chain({
      targets: label,
      tweens: [
        { alpha: 1, scale: 1 + step * 0.06, delay, duration: DURATION.base, ease: EASE.pop },
        { y: y - 30, alpha: 0, delay: 380, duration: 360, ease: EASE.exit },
      ],
      onComplete: () => label.destroy(),
    });
    // A gentle nudge for big combos, never with reduce motion.
    if (combo >= 5 && !reducedMotion()) this.scene.time.delayedCall(delay, () => this.scene.cameras.main.shake(SHAKE.combo.duration, SHAKE.combo.intensity + step * SHAKE.combo.perStep));
  }

  /** A shelf opening: a flash over it and sparks along its front. */
  unlockBurst(rect: Rect, delay: number): void {
    this.scene.time.delayedCall(delay, () => {
      const flash = this.scene.add.graphics().setDepth(this.depth);
      flash.fillStyle(hexNumber(SKIN.text.primary), 0.7).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 8);
      this.scene.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: EASE.enter, onComplete: () => flash.destroy() });
      for (let i = 0; i < 3; i++) this.sparks.explode(8, rect.x + (rect.width * (i + 0.5)) / 3, rect.y + rect.height * 0.6);
    });
  }

  /** The blocker's crate breaking apart into chips. */
  crateBreak(x: number, y: number, delay: number): void {
    this.scene.time.delayedCall(delay, () => {
      this.chips.explode(16, x, y);
      this.sparks.explode(10, x, y);
    });
  }

  /**
   * No space left: every shelf pulses with a red frame and the board gives a dull shake, so it is clear the
   * shelves are full before the panel says so. Lasts `duration` ms.
   */
  blockedWarning(shelves: readonly Rect[], duration: number, message: string, board: readonly Rect[] = shelves): void {
    const g = this.scene.add.graphics().setDepth(this.depth);
    // The reason, big over the middle of the board (`board`), whichever shelves are framed.
    const x0 = Math.min(...board.map((r) => r.x));
    const x1 = Math.max(...board.map((r) => r.x + r.width));
    const y0 = Math.min(...board.map((r) => r.y));
    const y1 = Math.max(...board.map((r) => r.y + r.height));
    const label = kitText(this.scene, 'title', message, SKIN.text.primary, 30)
      .setStroke(SKIN.fills.danger.lip, 8)
      .setPosition((x0 + x1) / 2, (y0 + y1) / 2)
      .setDepth(this.depth + 3)
      .setScale(0.5)
      .setAlpha(0);
    if (label.width > x1 - x0) label.setScale(((x1 - x0) / label.width) * 0.5);
    const full = label.scaleX * 2;
    this.scene.tweens.chain({
      targets: label,
      tweens: [
        { alpha: 1, scale: full, duration: DURATION.base, ease: EASE.pop },
        { alpha: 0, delay: Math.max(0, duration - DURATION.base * 2), duration: DURATION.base, ease: EASE.exit },
      ],
      onComplete: () => label.destroy(),
    });
    g.lineStyle(4, hexNumber(SKIN.status.criticalTime), 1);
    for (const r of shelves) g.strokeRoundedRect(r.x - 3, r.y - 3, r.width + 6, r.height + 6, 8);
    g.setAlpha(0);
    this.scene.tweens.add({ targets: g, alpha: 1, duration: 160, yoyo: true, repeat: 2, hold: 80, onComplete: () => g.destroy() });
    if (!reducedMotion()) this.scene.cameras.main.shake(Math.min(duration, SHAKE.blocked.duration), SHAKE.blocked.intensity);
  }

  /** Confetti thrown up from the bottom corners for a win. */
  celebrate(width: number, height: number): void {
    this.confetti.explode(40, width * 0.15, height);
    this.confetti.explode(40, width * 0.85, height);
  }
}
