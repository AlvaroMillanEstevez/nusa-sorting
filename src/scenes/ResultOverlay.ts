import * as Phaser from 'phaser';
import { theme } from '../ui/theme';

const DEPTH_OVERLAY = 300;

export interface ResultButton {
  readonly label: string;
  readonly onPress: () => void;
}

export interface ResultContent {
  readonly title: string;
  readonly subtitle: string;
  readonly primary: ResultButton;
  /** Optional smaller button below the main one (e.g. the level list). */
  readonly secondary?: ResultButton;
}

/** End-of-level panel (win or defeat) that blocks the board until one of its buttons is pressed. */
export class ResultOverlay {
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly primary: Phaser.GameObjects.Text;
  private readonly secondary: Phaser.GameObjects.Text;
  private readonly parts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[];
  private actions: { primary: () => void; secondary: (() => void) | null } | null = null;
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
    const button = (background: string) =>
      scene.add
        .text(0, 0, '', { ...style, color: theme.textColor, backgroundColor: background })
        .setOrigin(0.5)
        .setResolution(resolution)
        .setInteractive({ useHandCursor: true });
    this.primary = button(theme.accentButtonColor);
    this.secondary = button(theme.buttonColor);
    this.primary.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.press('primary'));
    this.secondary.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.press('secondary'));

    this.parts = [this.dim, this.panel, this.title, this.subtitle, this.primary, this.secondary];
    for (const part of this.parts) part.setDepth(DEPTH_OVERLAY);
    this.setVisible(false);
  }

  get visible(): boolean {
    return this.dim.visible;
  }

  show(content: ResultContent): void {
    this.title.setText(content.title);
    this.subtitle.setText(content.subtitle);
    this.primary.setText(content.primary.label);
    this.secondary.setText(content.secondary?.label ?? '');
    this.actions = { primary: content.primary.onPress, secondary: content.secondary?.onPress ?? null };
    this.layout(this.width, this.height);
    this.setVisible(true);

    for (const part of this.parts) this.scene.tweens.killTweensOf(part);
    this.dim.setAlpha(0);
    this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: 200 });
    const panelParts = [this.panel, this.title, this.subtitle, this.primary, this.secondary];
    for (const part of panelParts) part.setAlpha(0);
    this.scene.tweens.add({ targets: panelParts, alpha: 1, duration: 260, delay: 80, ease: 'Quad.easeOut' });
  }

  hide(): void {
    this.actions = null;
    this.setVisible(false);
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dim.setSize(width, height);
    if (this.dim.input?.hitArea instanceof Phaser.Geom.Rectangle) this.dim.input.hitArea.setSize(width, height);

    const short = Math.min(width, height);
    const hasSecondary = this.secondary.text !== '';
    const panelW = Math.min(width - 32, 420);
    const panelH = Math.min(height - 32, short * (hasSecondary ? 0.78 : 0.62), hasSecondary ? 360 : 300);
    const cx = width / 2;
    const top = height / 2 - panelH / 2;
    this.panel.clear().fillStyle(theme.panelColor, 1).fillRoundedRect(cx - panelW / 2, top, panelW, panelH, 18);

    // Rows from the top of the panel, as shares of its height.
    const rows = hasSecondary ? { title: 0.17, subtitle: 0.4, primary: 0.65, secondary: 0.85 } : { title: 0.22, subtitle: 0.48, primary: 0.77, secondary: 0 };
    this.title.setFontSize(Math.round(Math.min(36, panelW * 0.08))).setPosition(cx, top + panelH * rows.title);
    this.title.setWordWrapWidth(panelW - 32);
    this.subtitle.setFontSize(Math.round(Math.min(22, panelW * 0.05))).setPosition(cx, top + panelH * rows.subtitle);
    const pad = Math.round(Math.min(14, panelH * 0.045));
    this.primary
      .setFontSize(Math.round(Math.min(26, panelW * 0.06)))
      .setPadding(pad * 2, pad, pad * 2, pad)
      .setPosition(cx, top + panelH * rows.primary);
    this.secondary
      .setFontSize(Math.round(Math.min(20, panelW * 0.048)))
      .setPadding(pad * 1.6, pad * 0.8, pad * 1.6, pad * 0.8)
      .setPosition(cx, top + panelH * rows.secondary);
  }

  private press(which: 'primary' | 'secondary'): void {
    const action = this.actions?.[which];
    if (!action) return;
    // The main button works once per showing, so a double tap can't skip a level. The secondary one (the
    // level list) leaves the panel usable when the player comes back from it.
    if (which === 'primary') this.actions = null;
    action();
  }

  private setVisible(visible: boolean): void {
    for (const part of this.parts) part.setVisible(visible);
    this.secondary.setVisible(visible && this.secondary.text !== '');
    if (this.dim.input) this.dim.input.enabled = visible;
    if (this.primary.input) this.primary.input.enabled = visible;
    if (this.secondary.input) this.secondary.input.enabled = visible && this.secondary.text !== '';
  }
}
