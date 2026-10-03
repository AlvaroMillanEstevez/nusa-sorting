import * as Phaser from 'phaser';
import { t } from '../i18n';
import { formatTime } from '../ui/format';
import { theme } from '../ui/theme';

const DEPTH_HUD = 150;
/** Below this many ms the clock turns red and pulses. */
export const WARNING_MS = 10_000;

export interface HudHandlers {
  onRestart(): void;
  onToggleMute(): void;
}

/** Top bar: level number, countdown, mute toggle and restart button. */
export class Hud {
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly restartButton: Phaser.GameObjects.Text;
  private readonly muteIcon: Phaser.GameObjects.Graphics;
  private readonly muteZone: Phaser.GameObjects.Zone;
  private iconSize = 24;
  private width = 0;
  private hudHeight = 0;
  private muted = false;
  private warning = false;

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
  }

  layout(width: number, hudHeight: number): void {
    this.width = width;
    this.hudHeight = hudHeight;
    const cy = hudHeight / 2;
    const pad = Math.round(hudHeight * 0.2);
    // Narrow (phone) screens get slightly smaller HUD text so everything fits in one row.
    const narrow = width < 480;
    this.levelText.setFontSize(Math.round(hudHeight * (narrow ? 0.32 : 0.38))).setPosition(16, cy);
    this.timerText.setFontSize(Math.round(hudHeight * (narrow ? 0.4 : 0.46)));
    this.restartButton
      .setFontSize(Math.round(hudHeight * (narrow ? 0.26 : 0.3)))
      .setPadding(pad * (narrow ? 1 : 1.4), pad, pad * (narrow ? 1 : 1.4), pad)
      .setPosition(width - 12, cy);

    this.iconSize = Math.round(hudHeight * 0.42);
    const muteX = this.restartButton.x - this.restartButton.width - hudHeight * 0.55;
    this.muteIcon.setPosition(muteX, cy);
    // Generous touch target around the small icon.
    this.muteZone.setPosition(muteX, cy).setSize(hudHeight, hudHeight);
    this.drawMuteIcon();
    this.placeTimer();
  }

  /** Centers the clock on screen if it fits, otherwise in the gap between the level label and the buttons. */
  private placeTimer(): void {
    const left = this.levelText.x + this.levelText.width;
    const right = this.muteIcon.x - this.hudHeight / 2;
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

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.drawMuteIcon();
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
