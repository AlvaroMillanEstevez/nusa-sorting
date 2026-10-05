import * as Phaser from 'phaser';
import { t } from '../i18n';
import type { Rect } from '../ui/boardLayout';
import { formatTime } from '../ui/format';
import { theme } from '../ui/theme';
import { timeStage, type TimeStage } from '../ui/timeWarning';
import { RENDER_RATIO } from './view';

const DEPTH_HUD = 150;

export interface HudHandlers {
  onRestart(): void;
  onToggleMute(): void;
  onLevels(): void;
}

/**
 * Top bar: level number, countdown, level list, mute toggle and restart button. Levels with combos get a second row
 * with the score and the combo, plus a bar showing how much of the combo window is left.
 */
export class Hud {
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly restartButton: Phaser.GameObjects.Text;
  private readonly muteIcon: Phaser.GameObjects.Graphics;
  private readonly muteZone: Phaser.GameObjects.Zone;
  private readonly levelsIcon: Phaser.GameObjects.Graphics;
  /** A star before the level label marks a special level. */
  private readonly starIcon: Phaser.GameObjects.Graphics;
  private levelNumber = 1;
  private special = false;
  /** Where the level label (or the star of a special level) starts. */
  private labelX = 0;
  private readonly levelsZone: Phaser.GameObjects.Zone;
  private iconSize = 24;
  /** The level label's size before it shrinks to make room for the clock. */
  private levelFont = 16;
  private width = 0;
  private hudHeight = 0;
  private muted = false;
  private stage: TimeStage = 'normal';
  /** Waiting for the first touch on the board: the clock is paused and a hint replaces the combo label. */
  private waiting = false;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly comboBar: Phaser.GameObjects.Graphics;
  /** A themed level's accent: a line along the bottom of the HUD. */
  private readonly accentLine: Phaser.GameObjects.Graphics;
  private accent: string | null = null;
  private statusRow: Rect | null = null;
  private inline = false;
  /** Right end of the combo bar. */
  private barEnd = 0;
  private shownScore = 0;
  private scoreTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    handlers: HudHandlers,
  ) {
    const resolution = RENDER_RATIO;
    const style = { fontFamily: theme.fontFamily, fontStyle: 'bold' };

    this.levelText = scene.add
      .text(0, 0, '', { ...style, color: theme.titleColor })
      .setOrigin(0, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD);
    this.timerText = scene.add
      .text(0, 0, '', { ...style, color: theme.textColor })
      .setOrigin(0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD);
    this.restartButton = scene.add
      .text(0, 0, t('hud.restart'), { ...style, color: theme.textColor, backgroundColor: theme.buttonColor })
      .setOrigin(1, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD)
      .setInteractive({ useHandCursor: true });
    this.restartButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => handlers.onRestart());

    this.muteIcon = scene.add.graphics().setDepth(DEPTH_HUD);
    this.muteZone = scene.add.zone(0, 0, 1, 1).setDepth(DEPTH_HUD).setInteractive({ useHandCursor: true });
    this.muteZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => handlers.onToggleMute());
    this.levelsIcon = scene.add.graphics().setDepth(DEPTH_HUD);
    this.starIcon = scene.add.graphics().setDepth(DEPTH_HUD);
    this.levelsZone = scene.add.zone(0, 0, 1, 1).setDepth(DEPTH_HUD).setInteractive({ useHandCursor: true });
    this.levelsZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => handlers.onLevels());

    this.scoreText = scene.add
      .text(0, 0, '', { ...style, color: theme.textColor })
      .setOrigin(0, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD);
    this.comboText = scene.add
      .text(0, 0, '', { ...style, color: theme.comboColor })
      .setOrigin(1, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD);
    this.comboBar = scene.add.graphics().setDepth(DEPTH_HUD);
    this.accentLine = scene.add.graphics().setDepth(DEPTH_HUD);
  }

  /** Lays out the main row and, when given, the score/combo row below it. */
  /**
   * Lays out the main row and the score/combo status: in its own row below (`inline` false, portrait) or
   * inside the main row (`inline` true, landscape): score after the level label, combo before the mute icon.
   */
  layout(width: number, hudHeight: number, statusRow: Rect | null, inline = false): void {
    this.width = width;
    this.statusRow = statusRow;
    this.inline = inline;
    for (const part of [this.scoreText, this.comboText]) part.setVisible(statusRow !== null);
    this.comboBar.setVisible(statusRow !== null && !this.waiting);
    this.hudHeight = hudHeight;
    const cy = hudHeight / 2;
    // Text and padding follow the bar height, but never more than the width allows: on a tall, narrow
    // phone the bar is high while everything still has to fit in one row.
    const base = Math.min(hudHeight, width / 7.5);
    const pad = Math.round(base * 0.2);
    const narrow = width < 480;
    // The level list icon opens the row on the left; the level label follows it.
    this.iconSize = Math.round(hudHeight * 0.42);
    const levelsX = 12 + this.iconSize / 2;
    this.levelsIcon.setPosition(levelsX, cy);
    this.levelsZone.setPosition(levelsX, cy).setSize(hudHeight * 0.9, hudHeight);
    this.drawLevelsIcon();
    this.levelFont = Math.round(base * (narrow ? 0.32 : 0.38));
    this.labelX = levelsX + this.iconSize / 2 + (narrow ? 10 : 14);
    this.levelText.setY(cy);
    this.placeLevelLabel();
    this.timerText.setFontSize(Math.round(base * (narrow ? 0.4 : 0.46)));
    this.restartButton
      .setFontSize(Math.round(base * (narrow ? 0.26 : 0.3)))
      .setPadding(pad * (narrow ? 1 : 1.4), pad, pad * (narrow ? 1 : 1.4), pad)
      .setPosition(width - 12, cy);

    const muteX = this.restartButton.x - this.restartButton.width - hudHeight * 0.55;
    this.muteIcon.setPosition(muteX, cy);
    // Generous touch targets around the small icons.
    this.muteZone.setPosition(muteX, cy).setSize(hudHeight, hudHeight);
    this.drawMuteIcon();

    if (statusRow) {
      const rowY = statusRow.y + statusRow.height / 2;
      const size = Math.round((inline ? base * 0.3 : statusRow.height * 0.48));
      this.scoreText.setFontSize(size);
      this.comboText.setFontSize(size);
      this.barEnd = inline ? muteX - hudHeight * 0.6 : width - 12;
      const scoreX = inline ? this.levelText.x + this.levelText.width + 16 : 16;
      this.scoreText.setPosition(scoreX, rowY);
      this.comboText.setY(rowY);
      this.placeComboText();
    }
    this.placeTimer();
    this.drawAccent();
  }

  /** A themed level's accent colour under the HUD, or none. */
  setAccent(color: string | null): void {
    this.accent = color;
    this.drawAccent();
  }

  private drawAccent(): void {
    const g = this.accentLine.clear();
    if (!this.accent) return;
    const bottom = this.statusRow && !this.inline ? this.statusRow.y + this.statusRow.height : this.hudHeight;
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.accent).color, 1).fillRect(0, bottom - 3, this.width, 3);
  }

  /** Room kept for texts that change while playing, so the clock does not shift as they grow. */
  private reserved(text: Phaser.GameObjects.Text, chars: number): number {
    return Number(text.style.fontSize.toString().replace('px', '')) * 0.6 * chars;
  }

  /** Centers the clock on screen if it fits, otherwise in the gap between the level label and the buttons. */
  private placeTimer(): void {
    const inlineStatus = this.inline && this.statusRow !== null;
    // With the status inline, the clock sits between the score ("Score 99999") and the combo label and bar.
    const left = inlineStatus
      ? this.scoreText.x + this.reserved(this.scoreText, 11)
      : this.levelText.x + this.levelText.width;
    const right = inlineStatus
      ? this.barEnd - this.barWidth() - 10 - this.reserved(this.comboText, 8)
      : this.muteIcon.x - this.hudHeight / 2;
    // A long level label ("Special level 10") shrinks until the clock fits beside it.
    if (!inlineStatus) {
      let size = Number(this.levelText.style.fontSize.toString().replace('px', ''));
      while (size > 11 && this.levelText.x + this.levelText.width + this.timerText.width + 16 > right) {
        this.levelText.setFontSize(--size);
      }
    }
    const fitLeft = inlineStatus ? left : this.levelText.x + this.levelText.width;
    const half = this.timerText.width / 2;
    const centered = this.width / 2;
    const x = centered - half > fitLeft + 8 && centered + half < right - 8 ? centered : (fitLeft + right) / 2;
    this.timerText.setPosition(x, this.hudHeight / 2);
  }

  /** The level label; a special level gets a star and the combo colour, and says so in full where it fits. */
  setLevel(levelNumber: number, special = false): void {
    this.levelNumber = levelNumber;
    this.special = special;
    this.placeLevelLabel();
    this.placeTimer();
  }

  private placeLevelLabel(): void {
    const special = this.special;
    const size = this.levelFont;
    // "Special level 10" only where there is room for it at full size (landscape, tablets); a star says it on
    // narrow phones.
    const spelledOut = special && this.width >= 480;
    this.levelText
      .setText(t(spelledOut ? 'hud.specialLevel' : 'hud.level', { n: this.levelNumber }))
      .setColor(special ? theme.comboColor : theme.titleColor)
      .setFontSize(size)
      .setX(special ? this.labelX + size * 1.2 : this.labelX);
    this.starIcon.clear().setVisible(special).setPosition(this.labelX + size * 0.5, this.levelText.y);
    if (special) {
      const points = Array.from({ length: 10 }, (_, i) => {
        const r = (i % 2 === 0 ? 0.62 : 0.27) * size;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
      });
      this.starIcon.fillStyle(Phaser.Display.Color.HexStringToColor(theme.comboColor).color, 1).fillPoints(points, true);
    }
  }

  /**
   * The clock. Running low (see timeStage) it turns amber with two double pulses; in the last seconds it turns red
   * and beats. `totalMs` is the level's whole time.
   */
  setTime(timeLeftMs: number | null, totalMs = 0): void {
    this.timerText.setVisible(timeLeftMs !== null);
    if (timeLeftMs === null) return;
    const text = formatTime(timeLeftMs);
    if (text !== this.timerText.text) {
      this.timerText.setText(text);
      this.placeTimer();
    }

    const stage = timeStage(timeLeftMs, totalMs);
    if (stage === this.stage) return;
    this.stage = stage;
    this.scene.tweens.killTweensOf(this.timerText);
    const color = stage === 'critical' ? theme.warningColor : stage === 'low' ? theme.lowTimeColor : theme.textColor;
    this.timerText.setScale(1).setColor(color);
    if (stage === 'critical') {
      this.scene.tweens.add({ targets: this.timerText, scale: 1.15, duration: 250, yoyo: true, repeat: -1 });
    } else if (stage === 'low') {
      // Two double pulses, in time with the warning beeps.
      this.scene.tweens.chain({
        targets: this.timerText,
        tweens: [0, 0, 150, 0].map((delay) => ({ scale: 1.3, duration: 70, yoyo: true, delay, ease: 'Quad.easeOut' })),
      });
    }
  }

  private barWidth(): number {
    return this.inline ? Math.min(110, Math.round(this.width * 0.11)) : Math.min(140, Math.round(this.width * 0.28));
  }

  /** Shows the score; counts up to it when `animate` is set. */
  setScore(score: number, animate: boolean): void {
    this.scoreTween?.stop();
    this.scoreTween = null;
    if (!animate || score <= this.shownScore) {
      this.shownScore = score;
      this.scoreText.setText(t('hud.score', { score }));
      return;
    }
    const counter = { value: this.shownScore };
    this.scoreTween = this.scene.tweens.add({
      targets: counter,
      value: score,
      duration: 350,
      ease: 'Quad.easeOut',
      onUpdate: () => this.scoreText.setText(t('hud.score', { score: Math.round(counter.value) })),
    });
    this.shownScore = score;
  }

  /** Combo label (hidden below x2) and the remaining-window bar; call every frame while playing. */
  setCombo(combo: number, windowLeftMs: number, windowMs: number): void {
    const row = this.statusRow;
    if (!row) return;
    if (!this.waiting) this.comboText.setText(combo >= 2 ? t('hud.combo', { n: combo }) : '');
    const g = this.comboBar.clear();
    const w = this.barWidth();
    const h = Math.max(6, Math.round(row.height * (this.inline ? 0.14 : 0.22)));
    const x = this.barEnd - w;
    const y = row.y + (row.height - h) / 2;
    g.fillStyle(theme.slotGuide, 1).fillRoundedRect(x, y, w, h, h / 2);
    const share = windowMs > 0 && combo > 0 ? Math.max(0, Math.min(1, windowLeftMs / windowMs)) : 0;
    if (share > 0) {
      const color = Phaser.Display.Color.HexStringToColor(theme.comboColor).color;
      g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(h, w * share), h, h / 2);
    }
  }

  /** Before the first touch on the board: dims the clock and shows a short hint where the combo goes. */
  setWaiting(waiting: boolean): void {
    if (waiting === this.waiting) return;
    this.waiting = waiting;
    this.timerText.setAlpha(waiting ? 0.55 : 1);
    this.comboText
      .setColor(waiting ? theme.textColor : theme.comboColor)
      .setAlpha(waiting ? 0.8 : 1)
      .setText(waiting ? t('hud.tapToStart') : '');
    this.comboBar.setVisible(!waiting && this.statusRow !== null);
    this.placeComboText();
  }

  /** The combo label sits left of its bar; the waiting hint, longer, takes the bar's place. */
  private placeComboText(): void {
    if (!this.statusRow) return;
    this.comboText.setX(this.waiting ? this.barEnd : this.barEnd - this.barWidth() - 10);
  }

  /** Little bump on the combo label when the combo grows. */
  pulseCombo(): void {
    this.scene.tweens.killTweensOf(this.comboText);
    this.comboText.setScale(1);
    this.scene.tweens.add({ targets: this.comboText, scale: 1.3, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.drawMuteIcon();
  }

  /** A 2×2 grid of rounded squares: the level list. */
  private drawLevelsIcon(): void {
    const s = this.iconSize;
    const g = this.levelsIcon.clear();
    const color = Phaser.Display.Color.HexStringToColor(theme.textColor).color;
    const cell = s * 0.4;
    const gap = s * 0.12;
    g.fillStyle(color, 1);
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        const x = dx < 0 ? -cell - gap / 2 : gap / 2;
        const y = dy < 0 ? -cell - gap / 2 : gap / 2;
        g.fillRoundedRect(x, y, cell, cell, cell * 0.25);
      }
    }
  }

  /** Speaker icon with sound waves, or with a cross when muted. */
  private drawMuteIcon(): void {
    const s = this.iconSize;
    const g = this.muteIcon.clear();
    const color = Phaser.Display.Color.HexStringToColor(theme.textColor).color;
    g.fillStyle(color, 1);
    g.fillRect(-s * 0.5, -s * 0.18, s * 0.22, s * 0.36);
    g.fillTriangle(-s * 0.3, -s * 0.18, -s * 0.02, -s * 0.45, -s * 0.02, s * 0.45);
    g.fillTriangle(-s * 0.3, -s * 0.18, -s * 0.3, s * 0.18, -s * 0.02, s * 0.45);
    g.lineStyle(Math.max(2, s * 0.09), color, 1);
    if (this.muted) {
      g.lineBetween(s * 0.12, -s * 0.2, s * 0.48, s * 0.2);
      g.lineBetween(s * 0.12, s * 0.2, s * 0.48, -s * 0.2);
    } else {
      g.beginPath();
      g.arc(0, 0, s * 0.22, -Math.PI / 4, Math.PI / 4);
      g.strokePath();
      g.beginPath();
      g.arc(0, 0, s * 0.42, -Math.PI / 4, Math.PI / 4);
      g.strokePath();
    }
  }
}
