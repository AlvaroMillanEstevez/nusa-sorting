import * as Phaser from 'phaser';
import { theme } from '../ui/theme';

const DEPTH_OVERLAY = 300;

export interface ResultContent {
  readonly title: string;
  readonly subtitle: string;
  readonly button: string;
  readonly onButton: () => void;
}

/** End-of-level panel (win or defeat) that blocks the board until its button is pressed. */
export class ResultOverlay {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Text;
  private readonly parts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[];
  private onButton: (() => void) | null = null;
  private width = 0;
  private height = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const resolution = window.devicePixelRatio || 1;
    const style = { fontFamily: theme.fontFamily, fontStyle: 'bold', align: 'center' };

    // Interactive so it swallows pointer input meant for the board underneath.
    this.dim = scene.add.rectangle(0, 0, 1, 1, theme.overlayDim, 0.7).setOrigin(0).setInteractive();
    this.panel = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', { ...style, color: theme.titleColor }).setOrigin(0.5).setResolution(resolution);
    this.subtitle = scene.add.text(0, 0, '', { ...style, color: theme.textColor }).setOrigin(0.5).setResolution(resolution);
    this.button = scene.add
      .text(0, 0, '', { ...style, color: theme.textColor, backgroundColor: theme.accentButtonColor })
      .setOrigin(0.5)
      .setResolution(resolution)
      .setInteractive({ useHandCursor: true });
    this.button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      // One press per showing, so a double tap can't skip a level.
      const action = this.onButton;
      this.onButton = null;
      action?.();
    });

    this.parts = [this.dim, this.panel, this.title, this.subtitle, this.button];
    for (const part of this.parts) part.setDepth(DEPTH_OVERLAY);
    this.setVisible(false);
  }

  get visible(): boolean {
    return this.dim.visible;
  }

  show(content: ResultContent): void {
    this.title.setText(content.title);
    this.subtitle.setText(content.subtitle);
    this.button.setText(content.button);
    this.onButton = content.onButton;
    this.layout(this.width, this.height);
    this.setVisible(true);

    for (const part of this.parts) this.scene.tweens.killTweensOf(part);
    this.dim.setAlpha(0);
    this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: 200 });
    const panelParts = [this.panel, this.title, this.subtitle, this.button];
    for (const part of panelParts) part.setAlpha(0);
    this.scene.tweens.add({ targets: panelParts, alpha: 1, duration: 260, delay: 80, ease: 'Quad.easeOut' });
  }

  hide(): void {
    this.onButton = null;
    this.setVisible(false);
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dim.setSize(width, height);
    if (this.dim.input?.hitArea instanceof Phaser.Geom.Rectangle) this.dim.input.hitArea.setSize(width, height);

    const short = Math.min(width, height);
    const panelW = Math.min(width - 32, 420);
    const panelH = Math.min(height - 32, short * 0.62, 300);
    const cx = width / 2;
    const cy = height / 2;
    this.panel
      .clear()
      .fillStyle(theme.panelColor, 1)
      .fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 18);

    this.title.setFontSize(Math.round(Math.min(36, panelW * 0.08))).setPosition(cx, cy - panelH * 0.28);
    this.title.setWordWrapWidth(panelW - 32);
    this.subtitle.setFontSize(Math.round(Math.min(24, panelW * 0.055))).setPosition(cx, cy - panelH * 0.02);
    const pad = Math.round(Math.min(16, panelH * 0.06));
    this.button
      .setFontSize(Math.round(Math.min(26, panelW * 0.06)))
      .setPadding(pad * 2, pad, pad * 2, pad)
      .setPosition(cx, cy + panelH * 0.27);
  }

  private setVisible(visible: boolean): void {
    for (const part of this.parts) part.setVisible(visible);
    if (this.dim.input) this.dim.input.enabled = visible;
    if (this.button.input) this.button.input.enabled = visible;
  }
}
