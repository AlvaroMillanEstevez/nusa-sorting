import * as Phaser from 'phaser';
import { DURATION, EASE, hexNumber, type Skin } from '../../ui/design/tokens';
import { roundRect } from './draw';
import { kitText } from './kitText';

/**
 * A progress bar: a sunken well and a fill, with its value also written beside it (so it never depends on the
 * fill's colour or length alone).
 */
export class KitProgressBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private shown = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly skin: Skin,
    private readonly barW: number,
    private readonly format: (share: number) => string = (share) => `${Math.round(share * 100)}%`,
    private readonly barH = 14,
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.label = kitText(scene, 'label', '', skin.text.primary).setOrigin(0, 0.5).setX(barW / 2 + 10);
    this.add([this.g, this.label]);
    scene.add.existing(this);
    this.draw();
  }

  setProgress(share: number, animate = false): this {
    const target = Math.max(0, Math.min(1, share));
    this.scene.tweens.killTweensOf(this);
    if (!animate) {
      this.shown = target;
      this.draw();
      return this;
    }
    const counter = { v: this.shown };
    this.scene.tweens.add({
      targets: counter,
      v: target,
      duration: DURATION.slow,
      ease: EASE.enter,
      onUpdate: () => {
        this.shown = counter.v;
        this.draw();
      },
    });
    return this;
  }

  private draw(): void {
    const { skin, barW: w, barH: h } = this;
    const g = this.g.clear();
    const r = skin.id === 'modern' ? h / 2 : 5;
    g.fillStyle(hexNumber(skin.well), 1);
    roundRect(g, -w / 2, -h / 2, w, h, r);
    g.fillStyle(0x000000, 0.25);
    roundRect(g, -w / 2, -h / 2, w, 3, r);
    if (this.shown > 0) {
      const fill = skin.fills.positive;
      const fw = Math.max(h, w * this.shown);
      g.fillStyle(hexNumber(fill.face), 1);
      roundRect(g, -w / 2, -h / 2, fw, h, r);
      g.fillStyle(hexNumber(fill.light), 0.55);
      roundRect(g, -w / 2 + 3, -h / 2 + 2, fw - 6, h * 0.32, r);
    }
    this.label.setText(this.format(this.shown));
  }
}
