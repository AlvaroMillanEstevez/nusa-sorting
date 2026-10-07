import * as Phaser from 'phaser';
import { DURATION, EASE, hexNumber, SPACE, type Skin } from '../../ui/design/tokens';
import { roundRect, softShadow, strokeRoundRect, woodGrain } from './draw';
import { kitText } from './kitText';

export interface PanelOptions {
  readonly skin: Skin;
  readonly width: number;
  readonly height: number;
  readonly title?: string;
}

/**
 * A panel: the surface of modals and screens. Direction A is a wooden board with grain and a raised frame; B a
 * dark see-through card with a hairline border. Content goes in with add(), from `contentTop` down.
 */
export class KitPanel extends Phaser.GameObjects.Container {
  readonly contentTop: number;
  private readonly title: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: PanelOptions) {
    super(scene, x, y);
    const { skin, width: w, height: h } = options;
    const g = scene.add.graphics();
    const r = skin.panelRadius;
    const x0 = -w / 2;
    const y0 = -h / 2;
    softShadow(g, x0, y0, w, h, r, skin.elevation.high);
    const surface = skin.surface;
    if (skin.lip > 0) {
      // A raised wooden frame: a darker edge under the board.
      g.fillStyle(hexNumber(surface.border), 1);
      roundRect(g, x0, y0 + skin.lip, w, h, r);
    }
    g.fillStyle(hexNumber(surface.fill), surface.alpha);
    roundRect(g, x0, y0, w, h, r);
    if (surface.grain) woodGrain(g, x0, y0, w, h, r * 0.6, surface.grain, w + h);
    g.lineStyle(surface.borderWidth, hexNumber(surface.border), surface.borderAlpha);
    strokeRoundRect(g, x0 + surface.borderWidth / 2, y0 + surface.borderWidth / 2, w - surface.borderWidth, h - surface.borderWidth, r);
    // Light along the top inner edge.
    g.lineStyle(2, hexNumber(surface.highlight), surface.highlightAlpha);
    g.beginPath();
    g.arc(x0 + r, y0 + r + 2, r - 2, Math.PI * 1.15, Math.PI * 1.5);
    g.lineTo(x0 + w - r, y0 + 2 + 0.01);
    g.arc(x0 + w - r, y0 + r + 2, r - 2, Math.PI * 1.5, Math.PI * 1.85);
    g.strokePath();
    this.add(g);
    let top = y0 + SPACE.m;
    if (options.title) {
      this.title = kitText(scene, 'title', options.title, skin.text.primary).setY(top + 18);
      this.title.setWordWrapWidth(w - SPACE.l * 2);
      this.add(this.title);
      top += 36 + SPACE.s;
    }
    this.contentTop = top;
    scene.add.existing(this);
  }

  get panelWidth(): number {
    return this.options.width;
  }
}

/** A modal: the board dimmed behind, and a panel that pops in. It swallows input meant for the board. */
export class KitModal extends Phaser.GameObjects.Container {
  readonly panel: KitPanel;
  private readonly dim: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, screenW: number, screenH: number, options: PanelOptions) {
    super(scene, 0, 0);
    this.dim = scene.add.rectangle(0, 0, screenW, screenH, 0x05080c, options.skin.id === 'modern' ? 0.55 : 0.62).setOrigin(0).setInteractive();
    this.panel = new KitPanel(scene, screenW / 2, screenH / 2, options);
    this.add([this.dim, this.panel]);
    scene.add.existing(this);
  }

  /** The entrance: the dim fades in while the panel rises and pops to size. */
  popIn(): this {
    this.dim.setAlpha(0);
    this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: DURATION.base, ease: EASE.enter });
    const y = this.panel.y;
    this.panel.setScale(0.86).setAlpha(0).setY(y + 24);
    this.scene.tweens.add({ targets: this.panel, scale: 1, alpha: 1, y, duration: DURATION.slow, ease: EASE.pop, delay: 60 });
    return this;
  }
}
