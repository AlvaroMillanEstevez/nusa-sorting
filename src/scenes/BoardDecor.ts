import * as Phaser from 'phaser';
import { t } from '../i18n';
import type { BoardLayout } from '../ui/boardLayout';
import type { LiveBoard } from '../ui/levelLayout';
import { FONTS, SKIN } from '../ui/design/tokens';
import { pixelRatio } from './view';
import { drawClosingMark, makeBlocker, makeClosedPlanks, makeLockVeil } from './art/ArtSet';

/** Above the dimmed back layer (depth < 5), below front items (10). */
const DEPTH_BLOCKER = 7;
const DEPTH_LOCK = 20;

/** A shutter of boards, padlock and "N more" counter over each locked shelf. */
export class LockOverlays {
  private readonly veils = new Map<number, Phaser.GameObjects.Container>();
  private readonly labels = new Map<number, Phaser.GameObjects.Text>();
  private layout: BoardLayout | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Replaces all overlays: one per shelf in `remaining` (shelf → triples still needed). */
  reset(remaining: ReadonlyMap<number, number>): void {
    this.clear();
    const resolution = pixelRatio();
    for (const [shelf, count] of remaining) {
      this.veils.set(shelf, this.scene.add.container(0, 0).setDepth(DEPTH_LOCK));
      const label = this.scene.add
        .text(0, 0, '', { fontFamily: FONTS.text, fontStyle: '700', color: SKIN.text.primary })
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
      veil.removeAll(true).setPosition(cx, cy).add(makeLockVeil(this.scene, rect.width, rect.height, s));
      this.labels.get(shelf)?.setFontSize(Math.round(s * 0.3)).setPosition(cx - s * 0.12, cy);
    }
  }

  /** Per frame: veils of shelves riding tracks move and fade with them. */
  follow(live: LiveBoard): void {
    const s = live.layout.slotSize;
    for (const [shelf, veil] of this.veils) {
      if (!live.moving[shelf]) continue;
      const { rect } = live.layout.shelves[shelf]!;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const alpha = live.shelfAlpha[shelf]!;
      veil.setPosition(cx, cy).setAlpha(alpha);
      this.labels.get(shelf)?.setPosition(cx - s * 0.12, cy).setAlpha(alpha);
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

/** The roaming blocker: a wooden crate sitting in the slot it blocks. */
export class BlockerView {
  private readonly plate: Phaser.GameObjects.Container;
  private size = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.plate = scene.add.container(0, 0).setDepth(DEPTH_BLOCKER).setVisible(false);
  }

  /** Shows the blocker at a point (or hides it with null), without animation. */
  place(point: { x: number; y: number } | null, slotSize: number): void {
    this.scene.tweens.killTweensOf(this.plate);
    this.hopping = false;
    if (slotSize !== this.size) this.draw(slotSize);
    this.plate.setVisible(point !== null).setAlpha(1).setScale(1);
    if (point) this.plate.setPosition(point.x, point.y);
  }

  /** Hops to a new slot in an arc. */
  /** True while a hop is scheduled or running; follow() leaves the plate alone meanwhile. */
  private hopping = false;

  /**
   * Hops in an arc to `target`, read every frame, so it lands on a slot of a moving shelf where that slot is
   * by then, not where it was when the hop started.
   */
  hop(target: () => { x: number; y: number }, delay: number): void {
    const lift = this.size * 0.8;
    const progress = { t: 0 };
    let from = { x: this.plate.x, y: this.plate.y };
    this.hopping = true;
    this.scene.tweens.killTweensOf(this.plate);
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      delay,
      duration: 320,
      ease: 'Sine.easeInOut',
      onStart: () => {
        from = { x: this.plate.x, y: this.plate.y };
      },
      onUpdate: () => {
        const k = progress.t;
        const to = target();
        this.plate.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * lift);
      },
      onComplete: () => {
        this.hopping = false;
      },
    });
  }

  /** Per frame, for a blocker on a shelf riding a track: stay on its slot as the shelf moves. */
  follow(point: { x: number; y: number }, alpha: number): void {
    if (this.hopping || !this.plate.visible) return;
    this.plate.setPosition(point.x, point.y).setAlpha(alpha);
  }

  /** Shrinks away for good. */
  remove(delay: number): void {
    this.scene.tweens.killTweensOf(this.plate);
    // Leave it to the removal animation from now on.
    this.hopping = true;
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
    this.plate.removeAll(true).add(makeBlocker(this.scene, slotSize));
  }
}

/**
 * Shelves that close once emptied: from the start, a small wooden tag with crossed planks on the top corner of
 * each (so the player can plan), and once one has closed, planks nailed across it. Closing shelves are fixed
 * shelves, so nothing here follows a track.
 */
export class ClosingShelves {
  private readonly marks = new Map<number, Phaser.GameObjects.Graphics>();
  private readonly planks = new Map<number, Phaser.GameObjects.Container>();
  private layout: BoardLayout | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Replaces everything: a tag on each shelf still to close, planks on each closed one. */
  reset(closesWhenEmpty: readonly boolean[], closed: readonly boolean[]): void {
    this.clear();
    closesWhenEmpty.forEach((closes, shelf) => {
      if (!closes) return;
      if (closed[shelf]) this.planks.set(shelf, this.scene.add.container(0, 0).setDepth(DEPTH_LOCK));
      else this.marks.set(shelf, this.scene.add.graphics().setDepth(DEPTH_LOCK));
    });
    if (this.layout) this.relayout(this.layout);
  }

  relayout(layout: BoardLayout): void {
    this.layout = layout;
    const s = layout.slotSize;
    for (const [shelf, mark] of this.marks) {
      const { rect } = layout.shelves[shelf]!;
      mark.clear().setPosition(rect.x + rect.width - s * 0.16, rect.y + s * 0.14);
      drawClosingMark(mark, s);
    }
    for (const [shelf, plank] of this.planks) {
      const { rect } = layout.shelves[shelf]!;
      plank.removeAll(true).setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2).add(makeClosedPlanks(this.scene, rect.width, rect.height, s));
    }
  }

  /** A shelf closes: its tag goes and planks are nailed across it, dropping in with a knock (shorter with reduce motion). */
  close(shelf: number, delay: number, still: boolean): void {
    const mark = this.marks.get(shelf);
    this.marks.delete(shelf);
    mark?.destroy();
    const plank = this.scene.add.container(0, 0).setDepth(DEPTH_LOCK);
    this.planks.set(shelf, plank);
    if (this.layout) this.relayout(this.layout);
    plank.setAlpha(0);
    if (still) {
      this.scene.time.delayedCall(delay, () => plank.setAlpha(1));
      return;
    }
    plank.setScale(1.25);
    this.scene.tweens.add({ targets: plank, alpha: 1, scale: 1, delay, duration: 260, ease: 'Back.easeOut' });
  }

  private clear(): void {
    for (const g of [...this.marks.values(), ...this.planks.values()]) g.destroy();
    this.marks.clear();
    this.planks.clear();
  }
}
