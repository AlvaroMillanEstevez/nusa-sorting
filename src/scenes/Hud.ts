import * as Phaser from 'phaser';
import { t } from '../i18n';
import type { Rect } from '../ui/boardLayout';
import { formatTime } from '../ui/format';
import { theme } from '../ui/theme';

const DEPTH_HUD = 150;
/** Below this many ms the clock turns red and pulses. */
export const WARNING_MS = 10_000;

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
  private readonly levelsZone: Phaser.GameObjects.Zone;
  private iconSize = 24;
  private width = 0;
  private hudHeight = 0;
  private muted = false;
  private warning = false;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly comboBar: Phaser.GameObjects.Graphics;
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
    const resolution = window.devicePixelRatio || 1;
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
    for (const part of [this.scoreText, this.comboText, this.comboBar]) part.setVisible(statusRow !== null);
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
    this.levelText
      .setFontSize(Math.round(base * (narrow ? 0.32 : 0.38)))
      .setPosition(levelsX + this.iconSize / 2 + (narrow ? 10 : 14), cy);
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
      this.comboText.setPosition(this.barEnd - this.barWidth() - 10, rowY);
    }
    this.placeTimer();
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
    const half = this.timerText.width / 2;
    const centered = this.width / 2;
    const x = centered - half > left + 8 && centered + half < right - 8 ? centered : (left + right) / 2;
    this.timerText.setPosition(x, this.hudHeight / 2);
  }

  setLevel(levelNumber: number): void {
    this.levelText.setText(t('hud.level', { n: levelNumber }));
    this.placeTimer();
  }

  setTime(timeLeftMs: number | null): void {
    this.timerText.setVisible(timeLeftMs !== null);
    if (timeLeftMs === null) return;
    const text = formatTime(timeLeftMs);
    if (text !== this.timerText.text) {
      this.timerText.setText(text);
      this.placeTimer();
    }

    const warning = timeLeftMs <= WARNING_MS;
    if (warning === this.warning) return;
    this.warning = warning;
    this.scene.tweens.killTweensOf(this.timerText);
    this.timerText.setScale(1).setColor(warning ? theme.warningColor : theme.textColor);
    if (warning) {
      this.scene.tweens.add({ targets: this.timerText, scale: 1.15, duration: 250, yoyo: true, repeat: -1 });
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
    this.comboText.setText(combo >= 2 ? t('hud.combo', { n: combo }) : '');
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
