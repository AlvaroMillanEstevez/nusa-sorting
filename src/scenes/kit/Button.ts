import * as Phaser from 'phaser';
import { DISABLED, disabledFill, hexNumber, SPACE, TYPE, type Skin } from '../../ui/design/tokens';
import type { UiIconName } from '../../ui/design/uiIcons';
import { roundRect, softShadow, strokeRoundRect } from './draw';
import { kitText } from './kitText';
import { Pressable } from './Pressable';
import { uiIcon } from './uiIconTextures';

export type ButtonVariant = 'primary' | 'secondary' | 'positive' | 'danger';

export interface ButtonOptions {
  readonly skin: Skin;
  readonly variant?: ButtonVariant;
  readonly label: string;
  /** An icon before the label. */
  readonly icon?: UiIconName;
  /** Fixed width; otherwise it fits the label. */
  readonly width?: number;
  /** Primary buttons are 56 px tall, others 48 (both above the 44 px touch minimum). */
  readonly height?: number;
  readonly onPress?: () => void;
}

/**
 * A text button. Primary: the one main action of a screen. Secondary: the others. Positive and danger for
 * confirmations and retries. In direction A it stands on a darker lip it sinks into when pressed; in B it is a
 * flat pill that lifts on a soft shadow.
 */
export class KitButton extends Pressable {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null;
  private readonly bw: number;
  private readonly bh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: ButtonOptions) {
    super(scene, x, y, options.onPress ?? null);
    const variant = options.variant ?? 'primary';
    const fill = options.skin.fills[variant];
    this.bh = options.height ?? (variant === 'primary' ? 56 : 48);
    const size = variant === 'primary' ? TYPE.button.size : TYPE.button.size - 2;
    this.label = kitText(scene, 'button', options.label, fill.text, size);
    const iconPx = Math.round(this.bh * 0.42);
    this.icon = options.icon ? uiIcon(scene, options.icon, fill.text, iconPx) : null;
    const content = this.label.width + (this.icon ? iconPx + SPACE.xs : 0);
    this.bw = options.width ?? Math.max(this.bh * 2, content + SPACE.m * 2);
    if (this.icon) {
      this.icon.setX(-content / 2 + iconPx / 2);
      this.label.setX(-content / 2 + iconPx + SPACE.xs + this.label.width / 2);
    }
    this.shadow = scene.add.graphics();
    this.face = scene.add.graphics();
    this.inner.add([this.face, this.label, ...(this.icon ? [this.icon] : [])]);
    this.add([this.shadow, this.inner]);
    this.setTouchArea(this.bw, this.bh + options.skin.lip);
    this.redraw();
  }

  protected redraw(): void {
    const { skin } = this.options;
    const own = skin.fills[this.options.variant ?? 'primary'];
    const fill = this.disabled ? disabledFill(own, skin.well) : own;
    const { bw: w, bh: h } = this;
    const lip = this.disabled ? 0 : skin.lip;
    const sink = this.pressed ? lip * 0.7 : 0;
    const radius = h * skin.buttonRound;
    const x = -w / 2;
    const top = -(h + lip) / 2;

    const s = this.shadow.clear();
    if (!this.disabled && !this.pressed) softShadow(s, x, top + lip, w, h, radius, skin.elevation.low);

    const g = this.face.clear();
    if (lip > 0) {
      g.fillStyle(hexNumber(fill.lip), 1);
      roundRect(g, x, top + lip, w, h, radius);
    }
    const y = top + sink;
    g.fillStyle(hexNumber(fill.face), 1);
    roundRect(g, x, y, w, h, radius);
    // Light from above: a soft band along the top, stronger on the raised (warung) look.
    g.fillStyle(hexNumber(fill.light), 0.55);
    roundRect(g, x + 5, y + 3, w - 10, h * 0.3, Math.min(radius, h * 0.15));
    g.lineStyle(2, hexNumber(fill.lip), 1);
    strokeRoundRect(g, x + 1, y + 1, w - 2, h - 2, radius);
    const cy = y + h / 2;
    this.label.setY(cy).setAlpha(this.disabled ? DISABLED.label : 1);
    this.icon?.setY(cy).setAlpha(this.disabled ? DISABLED.label : 1);
  }
}

export interface IconButtonOptions {
  readonly skin: Skin;
  readonly icon: UiIconName;
  /** 'chip': the quiet HUD look; a fill variant for an emphasised round button. */
  readonly look?: 'chip' | 'primary' | 'secondary';
  /** Visible size; the touch area is at least 44 px whatever this is. Default 44. */
  readonly size?: number;
  readonly onPress?: () => void;
}

/** A round button with an icon only (HUD and panel corners). */
export class KitIconButton extends Pressable {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Image;
  private readonly diameter: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: IconButtonOptions) {
    super(scene, x, y, options.onPress ?? null);
    this.diameter = options.size ?? 44;
    this.shadow = scene.add.graphics();
    this.face = scene.add.graphics();
    this.icon = uiIcon(scene, options.icon, this.iconColor(), Math.round(this.diameter * 0.5));
    this.inner.add([this.face, this.icon]);
    this.add([this.shadow, this.inner]);
    this.setTouchArea(this.diameter, this.diameter);
    this.redraw();
  }

  /** Swaps the icon (e.g. sound / mute). */
  setIcon(name: UiIconName): this {
    this.icon.destroy();
    this.icon = uiIcon(this.scene, name, this.iconColor(), Math.round(this.diameter * 0.5));
    this.inner.add(this.icon);
    this.redraw();
    return this;
  }

  private iconColor(): string {
    const look = this.options.look ?? 'chip';
    return look === 'chip' ? this.options.skin.text.primary : this.options.skin.fills[look].text;
  }

  protected redraw(): void {
    const { skin } = this.options;
    const look = this.options.look ?? 'chip';
    const d = this.diameter;
    const lip = look === 'chip' || this.disabled ? 0 : skin.lip;
    const sink = this.pressed ? lip * 0.7 : 0;
    const radius = d * 0.3;
    const x = -d / 2;
    const top = -(d + lip) / 2;
    const s = this.shadow.clear();
    if (!this.disabled && !this.pressed) softShadow(s, x, top + lip, d, d, radius, skin.elevation.low);
    const g = this.face.clear();
    if (look === 'chip') {
      g.fillStyle(hexNumber(skin.chip.fill), skin.chip.alpha);
      roundRect(g, x, top, d, d, radius);
      g.lineStyle(1.5, hexNumber(skin.chip.border), skin.chip.borderAlpha);
      strokeRoundRect(g, x + 0.75, top + 0.75, d - 1.5, d - 1.5, radius);
    } else {
      const fill = this.disabled ? disabledFill(skin.fills[look], skin.well) : skin.fills[look];
      if (lip > 0) {
        g.fillStyle(hexNumber(fill.lip), 1);
        roundRect(g, x, top + lip, d, d, radius);
      }
      g.fillStyle(hexNumber(fill.face), 1);
      roundRect(g, x, top + sink, d, d, radius);
      g.fillStyle(hexNumber(fill.light), 0.55);
      roundRect(g, x + 5, top + sink + 3, d - 10, d * 0.28, Math.min(radius, d * 0.14));
    }
    this.icon.setY(top + sink + d / 2).setAlpha(this.disabled ? DISABLED.label : 1);
  }
}
