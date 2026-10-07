import * as Phaser from 'phaser';
import { getLocale, t } from '../i18n';
import type { BoardLayout } from '../ui/boardLayout';
import { DURATION, EASE, hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import { formatScore, formatTime } from '../ui/format';
import { timeStage, type TimeStage } from '../ui/timeWarning';
import { KitIconButton, KitPill, kitText } from './kit';

const DEPTH_HUD = 150;
/** The biggest numbers the pills are sized for, so they never resize while playing. */
const WIDEST_SCORE = '00 000';
const WIDEST_TIME = '0:00';

export interface HudHandlers {
  onPause(): void;
}

/**
 * The HUD: only what matters while playing. The clock sits in the middle of the top row, with the pause button
 * on the left and, in a special level, its badge on the right. Score and combo go on a second row in portrait,
 * or on the same row in landscape. Before the first touch, the level number and a hint take the score's place:
 * the number is shown when a level starts (and in the pause menu), not all the time.
 */
export class Hud {
  private readonly pause: KitIconButton;
  private time!: KitPill;
  private score!: KitPill;
  private combo!: KitPill;
  private intro!: KitPill;
  private hint!: Phaser.GameObjects.Text;
  private special!: KitPill;
  private readonly accentLine: Phaser.GameObjects.Graphics;
  private accent: string | null = null;
  private layoutRef: BoardLayout | null = null;
  private width = 0;
  private levelNumber = 1;
  private isSpecial = false;
  private waiting = true;
  private comboShown = false;
  private stage: TimeStage = 'normal';
  private shownScore = 0;
  private scoreTween: Phaser.Tweens.Tween | null = null;
  private timeText = '';

  constructor(
    private readonly scene: Phaser.Scene,
    handlers: HudHandlers,
  ) {
    this.pause = new KitIconButton(scene, 0, 0, { skin: SKIN, icon: 'pause', onPress: () => handlers.onPause() }).setDepth(DEPTH_HUD);
    this.accentLine = scene.add.graphics().setDepth(DEPTH_HUD);
    this.build(40);
  }

  /** The pills, built for a height (they are rebuilt when the HUD's rows change size). */
  private build(height: number): void {
    for (const part of [this.time, this.score, this.combo, this.intro, this.hint, this.special]) part?.destroy();
    const skin = SKIN;
    this.time = new KitPill(this.scene, 0, 0, { skin, icon: 'clock', value: WIDEST_TIME, width: Math.round(height * 2.7), height });
    this.score = new KitPill(this.scene, 0, 0, { skin, label: t('hud.scoreLabel'), value: WIDEST_SCORE, height });
    this.combo = new KitPill(this.scene, 0, 0, { skin, icon: 'combo', value: '×00', tint: skin.status.combo, height });
    this.intro = new KitPill(this.scene, 0, 0, {
      skin,
      label: t('hud.levelLabel'),
      value: '00',
      height,
      ...(this.isSpecial ? { icon: 'starFilled' as const, tint: skin.text.accent } : {}),
    });
    this.special = new KitPill(this.scene, 0, 0, { skin, icon: 'starFilled', value: t('hud.special'), tint: skin.text.accent, height });
    this.hint = kitText(this.scene, 'label', t('hud.tapToStart'), skin.text.secondary);
    for (const part of [this.time, this.score, this.combo, this.intro, this.special, this.hint]) part.setDepth(DEPTH_HUD);
    this.time.setValue(this.timeText || WIDEST_TIME);
    this.score.setValue(this.formatScore(this.shownScore));
    this.intro.setValue(String(this.levelNumber));
    this.stage = 'normal';
  }

  /** Lays the HUD out in the layout's HUD area. */
  layout(width: number, layout: BoardLayout): void {
    this.width = width;
    this.layoutRef = layout;
    const row = layout.hudRowHeight;
    const inline = layout.statusInline || !layout.statusRow;
    const pillH = Math.round(Math.min(44, row * (inline ? 0.82 : 0.66)));
    this.build(pillH);
    const cy = row / 2;
    const edge = SPACE.s;
    this.pause.setPosition(edge + 22, cy);
    this.time.setPosition(width / 2, cy);
    this.special.setPosition(width - edge - this.special.pillWidth / 2, cy);
    if (inline) {
      // One row: pause, score (or the level and its hint) | clock | combo, special badge.
      const left = this.pause.x + 22 + SPACE.xs;
      this.score.setPosition(left + this.score.pillWidth / 2, cy);
      this.intro.setPosition(left + this.intro.pillWidth / 2, cy);
      const right = (this.isSpecial ? this.special.x - this.special.pillWidth / 2 - SPACE.xs : width - edge);
      this.combo.setPosition(right - this.combo.pillWidth / 2, cy);
      this.hint.setOrigin(1, 0.5).setPosition(right, cy);
    } else {
      // Two rows: the second holds score and combo (or the level and its hint).
      const sy = layout.statusRow!.y + layout.statusRow!.height / 2;
      this.score.setPosition(edge + this.score.pillWidth / 2, sy);
      this.intro.setPosition(edge + this.intro.pillWidth / 2, sy);
      this.combo.setPosition(width - edge - this.combo.pillWidth / 2, sy);
      this.hint.setOrigin(1, 0.5).setPosition(width - edge, sy);
    }
    this.fitHint();
    this.refresh();
    this.drawAccent();
  }

  /** The hint shrinks (never below the caption size) if a translation would run into the clock or the level. */
  private fitHint(): void {
    const room = this.hint.x - (this.layoutRef?.statusInline ? this.time.x + this.time.pillWidth / 2 : this.intro.x + this.intro.pillWidth / 2) - SPACE.s;
    this.hint.setScale(1);
    if (this.hint.width > room) this.hint.setScale(Math.max(12 / 14, room / this.hint.width));
  }

  /** The level number shown at the start; a special level also gets its badge for the whole level. */
  setLevel(levelNumber: number, special = false): void {
    const rebuild = special !== this.isSpecial;
    this.levelNumber = levelNumber;
    this.isSpecial = special;
    this.shownScore = 0;
    this.comboShown = false;
    if (rebuild && this.layoutRef) this.layout(this.width, this.layoutRef);
    else this.intro.setValue(String(levelNumber));
    this.refresh();
  }

  /** A themed level's accent colour under the HUD, or none. */
  setAccent(color: string | null): void {
    this.accent = color;
    this.drawAccent();
  }

  private drawAccent(): void {
    const g = this.accentLine.clear();
    const layout = this.layoutRef;
    if (!this.accent || !layout) return;
    g.fillStyle(hexNumber(this.accent), 1).fillRect(0, layout.hud.height - 3, this.width, 3);
  }

  /** Before the first touch: the level and a hint instead of score and combo, and the clock dimmed. */
  setWaiting(waiting: boolean): void {
    if (waiting === this.waiting) return;
    this.waiting = waiting;
    this.refresh();
  }

  private refresh(): void {
    const waiting = this.waiting;
    this.intro.setVisible(waiting);
    this.hint.setVisible(waiting);
    this.score.setVisible(!waiting);
    this.combo.setVisible(!waiting && this.comboShown);
    this.special.setVisible(this.isSpecial && !(waiting && this.layoutRef?.statusInline));
    this.time.setAlpha(waiting ? 0.7 : 1);
  }

  /**
   * The clock. Running low (see timeStage) its pill turns amber with a double pulse; in the last seconds it
   * turns red, its border thickens and it beats. `totalMs` is the level's whole time.
   */
  setTime(timeLeftMs: number | null, totalMs = 0): void {
    this.time.setVisible(timeLeftMs !== null);
    if (timeLeftMs === null) return;
    const text = formatTime(timeLeftMs);
    if (text !== this.timeText) {
      this.timeText = text;
      this.time.setValue(text);
    }
    const stage = timeStage(timeLeftMs, totalMs);
    if (stage === this.stage) return;
    this.stage = stage;
    this.time.setAlert(stage === 'normal' ? 'normal' : stage === 'low' ? 'low' : 'critical');
  }

  private formatScore(score: number): string {
    return formatScore(score, getLocale());
  }

  /** Shows the score; counts up to it when `animate` is set. */
  setScore(score: number, animate: boolean): void {
    this.scoreTween?.stop();
    this.scoreTween = null;
    if (!animate || score <= this.shownScore) {
      this.shownScore = score;
      this.score.setValue(this.formatScore(score));
      return;
    }
    const counter = { value: this.shownScore };
    this.scoreTween = this.scene.tweens.add({
      targets: counter,
      value: score,
      duration: DURATION.slow,
      ease: EASE.enter,
      onUpdate: () => this.score.setValue(this.formatScore(Math.round(counter.value))),
    });
    this.shownScore = score;
  }

  /** The combo pill appears from ×2, with the share of its window left as a bar; call every frame while playing. */
  setCombo(combo: number, windowLeftMs: number, windowMs: number): void {
    const shown = combo >= 2;
    if (shown !== this.comboShown) {
      this.comboShown = shown;
      this.refresh();
    }
    if (!shown) return;
    this.combo.setValue(`×${combo}`).setProgress(windowMs > 0 ? Math.max(0, Math.min(1, windowLeftMs / windowMs)) : 0);
  }

  /** A little bump on the combo pill when the combo grows. */
  pulseCombo(): void {
    this.scene.tweens.killTweensOf(this.combo);
    this.combo.setScale(1);
    this.scene.tweens.add({ targets: this.combo, scale: 1.15, duration: DURATION.fast, yoyo: true, ease: EASE.enter });
  }

  /** Hides or shows the whole HUD (e.g. under a full-screen panel). */
  setInputEnabled(enabled: boolean): void {
    if (this.pause.input) this.pause.input.enabled = enabled;
  }
}
