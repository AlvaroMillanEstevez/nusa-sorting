import * as Phaser from 'phaser';
import { t } from '../i18n';
import type { BoardLayout } from '../ui/boardLayout';
import { theme } from '../ui/theme';

/** Above the dimmed back layer (depth < 5), below front items (10). */
const DEPTH_BLOCKER = 7;
const DEPTH_LOCK = 20;

/** Dark veil, padlock and "N more" counter over each locked shelf. */
export class LockOverlays {
  private readonly veils = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private layout: BoardLayout | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Replaces all overlays: one per shelf in `remaining` (shelf → triples still needed). */
  reset(remaining: ReadonlyMap<number, number>): void {
    this.clear();
    const resolution = window.devicePixelRatio || 1;
    for (const [shelf, count] of remaining) {
      this.veils.set(shelf, this.scene.add.graphics().setDepth(DEPTH_LOCK));
      const label = this.scene.add
        .text(0, 0, '', { fontFamily: theme.fontFamily, fontStyle: 'bold', color: theme.textColor })
        .setOrigin(0, 0.5)
        .setResolution(resolution)
        .setDepth(DEPTH_LOCK + 1);
      this.labels.set(shelf, label);
      this.setRemaining(shelf, count);
    }
    if (this.layout) this.relayout(this.layout);
  }

  setRemaining(shelf: number, count: number): void {
    this.labels.get(shelf)?.setText(t('shelf.locked', { n: count }));
  }

  relayout(layout: BoardLayout): void {
    this.layout = layout;
    const s = layout.slotSize;
    for (const [shelf, veil] of this.veils) {
      const { rect } = layout.shelves[shelf]!;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      veil.clear().setPosition(cx, cy);
      veil.fillStyle(theme.lockVeil, 0.62).fillRoundedRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, s * 0.12);
      drawPadlock(veil, -s * 0.45, 0, s * 0.42);
      this.labels.get(shelf)?.setFontSize(Math.round(s * 0.3)).setPosition(cx - s * 0.12, cy);
    }
  }

  /** Lifts the veil with a small burst. Returns the shelf center for a popup. */
  unlock(shelf: number): void {
    const veil = this.veils.get(shelf);
    const label = this.labels.get(shelf);
    this.veils.delete(shelf);
    this.labels.delete(shelf);
    if (!veil || !label) return;
    this.scene.tweens.add({
      targets: [veil, label],
      alpha: 0,
      scale: 1.12,
      duration: 320,
      ease: 'Quad.easeIn',
      onComplete: () => {
        veil.destroy();
        label.destroy();
      },
    });
  }

  private clear(): void {
    for (const veil of this.veils.values()) veil.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.veils.clear();
    this.labels.clear();
  }
}

function drawPadlock(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const color = Phaser.Display.Color.HexStringToColor(theme.textColor).color;
  g.lineStyle(Math.max(2, size * 0.12), color, 1);
  g.beginPath();
  g.arc(x, y - size * 0.1, size * 0.26, Math.PI, 0);
  g.strokePath();
  g.fillStyle(color, 1).fillRoundedRect(x - size * 0.4, y - size * 0.1, size * 0.8, size * 0.62, size * 0.1);
  g.fillStyle(theme.lockVeil, 1).fillCircle(x, y + size * 0.16, size * 0.09);
}

/** The roaming blocker: a striped plate sitting in the slot it blocks. */
export class BlockerView {
  private readonly plate: Phaser.GameObjects.Graphics;
  private size = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.plate = scene.add.graphics().setDepth(DEPTH_BLOCKER).setVisible(false);
  }

  /** Shows the blocker at a point (or hides it with null), without animation. */
  place(point: { x: number; y: number } | null, slotSize: number): void {
    this.scene.tweens.killTweensOf(this.plate);
    if (slotSize !== this.size) this.draw(slotSize);
    this.plate.setVisible(point !== null).setAlpha(1).setScale(1);
    if (point) this.plate.setPosition(point.x, point.y);
  }

  /** Hops to a new slot in an arc. */
  hop(to: { x: number; y: number }, delay: number): void {
    const from = { x: this.plate.x, y: this.plate.y };
    const lift = this.size * 0.8;
    const progress = { t: 0 };
    this.scene.tweens.killTweensOf(this.plate);
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      delay,
      duration: 320,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const k = progress.t;
        this.plate.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * lift);
      },
    });
  }

  /** Shrinks away for good. */
  remove(delay: number): void {
    this.scene.tweens.killTweensOf(this.plate);
    this.scene.tweens.add({
      targets: this.plate,
      scale: 1.4,
      alpha: 0,
      angle: 90,
      delay,
      duration: 380,
      ease: 'Back.easeIn',
      onComplete: () => this.plate.setVisible(false).setAngle(0),
    });
  }

  private draw(slotSize: number): void {
    this.size = slotSize;
    const half = slotSize * 0.42;
    const g = this.plate.clear();
    g.fillStyle(theme.blockerColor, 1).fillRoundedRect(-half, -half, half * 2, half * 2, slotSize * 0.1);
    g.lineStyle(Math.max(3, slotSize * 0.08), theme.blockerStripe, 1);
    g.lineBetween(-half * 0.6, -half * 0.6, half * 0.6, half * 0.6);
    g.lineBetween(-half * 0.6, half * 0.6, half * 0.6, -half * 0.6);
    g.lineStyle(Math.max(2, slotSize * 0.04), theme.blockerStripe, 1).strokeRoundedRect(-half, -half, half * 2, half * 2, slotSize * 0.1);
  }
}
