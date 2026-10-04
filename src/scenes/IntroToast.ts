import * as Phaser from 'phaser';
import { theme } from '../ui/theme';
import { RENDER_RATIO } from './view';

/** Over the board and its popups, under the HUD. */
const DEPTH_TOAST = 130;
const SHOW_MS = 4500;
const FADE_MS = 180;

/**
 * One-line explanations of a mechanic the first time a level has it: a panel just under the HUD that closes by
 * itself after a few seconds or when tapped. Several queue up and show one after another.
 */
export class IntroToast {
  private queue: string[] = [];
  private panel: Phaser.GameObjects.Container | null = null;
  private timer: Phaser.Time.TimerEvent | null = null;
  private width = 0;
  private top = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  layout(width: number, top: number): void {
    this.width = width;
    this.top = top;
    if (this.panel) {
      const text = this.panel.getData('text') as string;
      this.panel.destroy();
      this.panel = this.build(text);
    }
  }

  /** Queues lines to show; starts at once if nothing is showing. */
  show(lines: readonly string[]): void {
    this.queue.push(...lines);
    if (!this.panel) this.next();
  }

  /** True (and closes the panel) when a press at (x, y) lands on it; such a press is not for the board. */
  hit(x: number, y: number): boolean {
    const panel = this.panel;
    if (!panel) return false;
    const bounds = panel.getData('bounds') as Phaser.Geom.Rectangle;
    if (!bounds.contains(x, y)) return false;
    this.close();
    return true;
  }

  /** Drops everything, e.g. when another level starts. */
  clear(): void {
    this.queue = [];
    this.timer?.remove();
    this.timer = null;
    this.panel?.destroy();
    this.panel = null;
  }

  private next(): void {
    const text = this.queue.shift();
    if (text === undefined) return;
    this.panel = this.build(text);
    this.panel.setAlpha(0);
    this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: FADE_MS });
    this.timer = this.scene.time.delayedCall(SHOW_MS, () => this.close());
  }

  private close(): void {
    const panel = this.panel;
    if (!panel) return;
    this.timer?.remove();
    this.timer = null;
    this.panel = null;
    this.scene.tweens.add({
      targets: panel,
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => {
        panel.destroy();
        if (!this.panel) this.next();
      },
    });
  }

  private build(line: string): Phaser.GameObjects.Container {
    const maxWidth = Math.min(this.width - 24, 520);
    let fontSize = Math.round(Math.max(14, Math.min(18, this.width / 24)));
    const pad = Math.round(fontSize * 0.7);
    const text = this.scene.add
      .text(0, 0, line, { fontFamily: theme.fontFamily, fontStyle: 'bold', fontSize: `${fontSize}px`, color: theme.textColor })
      .setOrigin(0.5, 0)
      .setResolution(RENDER_RATIO);
    // One line if it fits with a slightly smaller font; otherwise it wraps.
    while (text.width > maxWidth - pad * 2 && fontSize > 12) text.setFontSize(--fontSize);
    if (text.width > maxWidth - pad * 2) text.setWordWrapWidth(maxWidth - pad * 2).setAlign('center');
    const w = Math.min(maxWidth, text.width + pad * 2);
    const h = text.height + pad * 2;
    const x = this.width / 2;
    const g = this.scene.add.graphics();
    const accent = Phaser.Display.Color.HexStringToColor(theme.comboColor).color;
    g.fillStyle(theme.panelColor, 0.96).fillRoundedRect(-w / 2, 0, w, h, Math.min(14, h / 2));
    g.lineStyle(2, accent, 1).strokeRoundedRect(-w / 2, 0, w, h, Math.min(14, h / 2));
    text.setPosition(0, pad);
    const panel = this.scene.add.container(x, this.top, [g, text]).setDepth(DEPTH_TOAST);
    panel.setData('text', line);
    panel.setData('bounds', new Phaser.Geom.Rectangle(x - w / 2, this.top, w, h));
    return panel;
  }
}
