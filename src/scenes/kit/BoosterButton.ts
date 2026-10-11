import * as Phaser from 'phaser';
import { hexNumber, SKIN, TILE, type Skin } from '../../ui/design/tokens';
import { roundRect, softShadow, strokeRoundRect, woodGrain } from './draw';
import { kitText } from './kitText';
import { Pressable } from './Pressable';
import { uiIcon } from './uiIconTextures';

/** Available (with its count), none left (a "+" to buy one), or not unlocked yet (greyed, with a padlock). */
export type BoosterTileState = 'ready' | 'empty' | 'locked';

export interface BoosterButtonOptions {
  readonly skin?: Skin;
  /** Texture of the booster's colour icon (or of another icon shown on the same tile, such as the clock). */
  readonly texture: string;
  /** Default true; false shows the tile alone, without the corner badge (something that is not a booster). */
  readonly badge?: boolean;
  /** Visible size of the square tile. Default 56. */
  readonly size?: number;
  readonly state: BoosterTileState;
  readonly count: number;
  /** Without it the tile only shows (the shop's rows). */
  readonly onPress?: () => void;
}

/**
 * A booster's button: its colour icon on a carved wooden panel in a raised brass frame, standing on a dark lip
 * it sinks into when pressed, with a warm light behind the icon. A badge in its corner says how many the player
 * has; with none left it turns into a green "+"; locked, the tile greys out and the badge holds a padlock. The
 * booster in use is ringed. Every state differs in shape as well as colour (number, plus, padlock, ring).
 */
export class KitBoosterButton extends Pressable {
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly badge: Phaser.GameObjects.Container;
  private readonly size: number;
  private readonly skin: Skin;
  private tile: BoosterTileState;
  private units: number;
  private inUse = false;
  private readonly showBadge: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, options: BoosterButtonOptions) {
    super(scene, x, y, options.onPress ?? null);
    this.size = options.size ?? 56;
    this.skin = options.skin ?? SKIN;
    this.tile = options.state;
    this.units = options.count;
    this.showBadge = options.badge ?? true;
    this.shadow = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.face = scene.add.graphics();
    this.icon = scene.add.image(0, 0, options.texture);
    this.badge = scene.add.container(0, 0);
    this.inner.add([this.face, this.icon, this.badge]);
    this.add([this.shadow, this.ring, this.inner]);
    if (options.onPress) this.setTouchArea(this.size, this.size);
    this.redraw();
  }

  setTile(state: BoosterTileState, count: number): this {
    this.tile = state;
    this.units = count;
    this.redraw();
    return this;
  }

  /** Rings the tile: the booster in use (aiming "remove a triple", a running freeze). */
  setInUse(inUse: boolean): this {
    this.inUse = inUse;
    this.redraw();
    return this;
  }

  protected redraw(): void {
    const d = this.size;
    const locked = this.tile === 'locked';
    const lip = this.skin.lip;
    const sink = this.pressed ? lip * 0.7 : 0;
    const radius = d * 0.26;
    const x = -d / 2;
    const top = -(d + lip) / 2;

    const s = this.shadow.clear();
    if (!this.pressed) softShadow(s, x, top + lip, d, d, radius, this.skin.elevation.low);
    const r = this.ring.clear();
    if (this.inUse) {
      r.lineStyle(4, hexNumber(this.skin.status.combo), 1);
      strokeRoundRect(r, x - 6, top - 6 + sink, d + 12, d + 12, radius + 6);
    }

    const g = this.face.clear();
    // The lip it stands on.
    g.fillStyle(hexNumber(locked ? TILE.panelShade : TILE.lip), 1);
    roundRect(g, x, top + lip, d, d, radius);
    // The brass frame: shaded at its foot, lit along its top.
    const y = top + sink;
    g.fillStyle(hexNumber(locked ? TILE.lockedPanel : TILE.rimShade), 1);
    roundRect(g, x, y, d, d, radius);
    g.fillStyle(hexNumber(locked ? TILE.lockedRim : TILE.rim), 1);
    roundRect(g, x, y, d, d - 3, radius);
    g.fillStyle(hexNumber(locked ? TILE.lockedRim : TILE.rimLight), locked ? 0.4 : 0.85);
    roundRect(g, x + 4, y + 2, d - 8, d * 0.16, radius * 0.5);
    // The carved panel, sunk into the frame, with its grain.
    const inset = Math.max(5, d * 0.1);
    const pw = d - inset * 2;
    g.fillStyle(hexNumber(locked ? TILE.badge : TILE.panelShade), 1);
    roundRect(g, x + inset, y + inset, pw, pw - 2, radius * 0.7);
    g.fillStyle(hexNumber(locked ? TILE.lockedPanel : TILE.panel), 1);
    roundRect(g, x + inset, y + inset + 2, pw, pw - 4, radius * 0.7);
    woodGrain(g, x + inset, y + inset + 2, pw, pw - 4, 4, locked ? TILE.lockedRim : TILE.panelLight, d);
    // Warm light behind the icon.
    if (!locked) {
      for (let i = 3; i >= 1; i--) g.fillStyle(hexNumber(TILE.glow), 0.09).fillCircle(0, y + d / 2, (pw * (0.22 + i * 0.1)) / 2);
    }

    const iconSize = Math.round(d * 0.7);
    this.icon.setDisplaySize(iconSize, iconSize).setPosition(0, y + d / 2 - 1);
    if (locked) this.icon.setTint(hexNumber(TILE.lockedIcon)).setAlpha(0.75);
    else this.icon.clearTint().setAlpha(1);

    this.drawBadge(x + d - d * 0.1, y + d * 0.1);
  }

  /** The corner badge: the count, a "+" to buy one, or a padlock. */
  private drawBadge(bx: number, by: number): void {
    this.badge.removeAll(true);
    if (!this.showBadge) return;
    const r = Math.max(10, Math.round(this.size * 0.2));
    const g = this.scene.add.graphics();
    const { positive } = this.skin.fills;
    const [fill, line] =
      this.tile === 'empty' ? [positive.face, positive.lip] : this.tile === 'locked' ? [TILE.badge, TILE.lockedRim] : [TILE.badge, TILE.rim];
    g.fillStyle(hexNumber(fill), 1).fillCircle(0, 0, r);
    g.lineStyle(2.5, hexNumber(line), 1).strokeCircle(0, 0, r);
    const mark =
      this.tile === 'ready'
        ? kitText(this.scene, 'label', String(this.units), this.skin.text.primary, Math.round(r * 1.2))
        : this.tile === 'empty'
          ? uiIcon(this.scene, 'plus', positive.text, Math.round(r * 1.3))
          : uiIcon(this.scene, 'lock', this.skin.text.secondary, Math.round(r * 1.2));
    this.badge.setPosition(bx, by).add([g, mark]);
  }
}
