import * as Phaser from 'phaser';
import { DURATION, EASE, hexNumber, SPACE, TYPE, type Skin } from '../../ui/design/tokens';
import type { UiIconName } from '../../ui/design/uiIcons';
import { roundRect, strokeRoundRect } from './draw';
import { kitText } from './kitText';
import { uiIcon } from './uiIconTextures';

/** How urgent a pill is. Each state changes its icon colour, border and motion, never colour alone. */
export type PillState = 'normal' | 'low' | 'critical';

export interface PillOptions {
  readonly skin: Skin;
  readonly icon?: UiIconName;
  /** A small capital label before the value ("LEVEL"), or none. */
  readonly label?: string;
  readonly value: string;
  /** Fixed width (keeps the HUD still while the value changes); otherwise it fits the content. */
  readonly width?: number;
  /** Default 40; the HUD rows give pills at least 44 px of touch room around them. */
  readonly height?: number;
  /** A colour for the icon and value (the combo), instead of the text colour. */
  readonly tint?: string;
}

/**
 * A HUD pill: an icon, an optional label and a value in the display font (time, score, combo, level), on a
 * chip over the board. The combo pill also shows how much of its window is left as a thin bar along its foot.
 */
export class KitPill extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly caption: Phaser.GameObjects.Text | null = null;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly pw: number;
  private readonly ph: number;
  private alertState: PillState = 'normal';
  private progress: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: PillOptions) {
    super(scene, x, y);
    const { skin } = options;
    this.ph = options.height ?? 40;
    const color = options.tint ?? skin.text.primary;
    const iconPx = Math.round(this.ph * 0.5);
    this.face = scene.add.graphics();
    this.bar = scene.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [this.face, this.bar];
    if (options.icon) {
      this.icon = uiIcon(scene, options.icon, color, iconPx);
      parts.push(this.icon);
    }
    if (options.label) {
      this.caption = kitText(scene, 'caption', options.label.toUpperCase(), skin.text.secondary).setOrigin(0, 0.5);
      parts.push(this.caption);
    }
    this.valueText = kitText(scene, 'number', options.value, color, Math.min(TYPE.number.size, this.ph * 0.56)).setOrigin(0, 0.5);
    parts.push(this.valueText);
    const content = (this.icon ? iconPx + SPACE.xs : 0) + (this.caption ? this.caption.width + SPACE.xs : 0) + this.valueText.width;
    this.pw = options.width ?? content + SPACE.s * 2;
    let cx = -this.pw / 2 + SPACE.s;
    if (options.width) cx = -content / 2;
    if (this.icon) {
      this.icon.setX(cx + iconPx / 2);
      cx += iconPx + SPACE.xs;
    }
    if (this.caption) {
      this.caption.setX(cx);
      cx += this.caption.width + SPACE.xs;
    }
    this.valueText.setX(cx);
    this.add(parts);
    scene.add.existing(this);
    this.draw();
  }

  get pillWidth(): number {
    return this.pw;
  }

  setValue(value: string): this {
    this.valueText.setText(value);
    return this;
  }

  /** Low time: amber icon and border, and a double pulse. Critical: red, a thicker border and a beat. */
  setAlert(state: PillState): this {
    if (state === this.alertState) return this;
    this.alertState = state;
    this.draw();
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    if (state === 'critical') {
      this.scene.tweens.add({ targets: this, scale: 1.08, duration: 260, yoyo: true, repeat: -1, ease: EASE.loop });
    } else if (state === 'low') {
      this.scene.tweens.add({ targets: this, scale: 1.12, duration: DURATION.press, yoyo: true, repeat: 1, ease: EASE.enter });
    }
    return this;
  }

  /** The combo window left, 0-1, as a bar along the foot of the pill; null hides it. */
  setProgress(share: number | null): this {
    this.progress = share;
    this.draw();
    return this;
  }

  private draw(): void {
    const { skin } = this.options;
    const { pw: w, ph: h } = this;
    const radius = Math.min(skin.chipRadius, h / 2);
    const g = this.face.clear();
    g.fillStyle(hexNumber(skin.chip.fill), skin.chip.alpha);
    roundRect(g, -w / 2, -h / 2, w, h, radius);
    const alert = this.alertState === 'normal' ? null : this.alertState === 'low' ? skin.status.lowTime : skin.status.criticalTime;
    g.lineStyle(alert ? (this.alertState === 'critical' ? 3 : 2) : 1.5, hexNumber(alert ?? skin.chip.border), alert ? 1 : skin.chip.borderAlpha);
    strokeRoundRect(g, -w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, radius);
    const color = alert ?? this.options.tint ?? skin.text.primary;
    this.valueText.setColor(color);
    if (this.icon && alert) this.icon.setTint(hexNumber(alert));
    else this.icon?.clearTint();

    const b = this.bar.clear();
    if (this.progress !== null) {
      const bw = w - radius * 2;
      const bh = 3;
      b.fillStyle(hexNumber(skin.well), 1).fillRoundedRect(-bw / 2, h / 2 - bh - 3, bw, bh, bh / 2);
      if (this.progress > 0) {
        b.fillStyle(hexNumber(this.options.tint ?? skin.status.combo), 1).fillRoundedRect(-bw / 2, h / 2 - bh - 3, Math.max(bh, bw * this.progress), bh, bh / 2);
      }
    }
  }
}
