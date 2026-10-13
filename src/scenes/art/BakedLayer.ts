import * as Phaser from 'phaser';
import type { Rect } from '../../ui/boardLayout';
import { pixelRatio } from '../view';

/** A picture baked under a layer's drawing: its texture, its centre in the layer's coordinates and its scale. */
export interface BakedPicture {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/**
 * A vector drawing (shelves, rails) cached in a texture. Phaser redraws Graphics commands every frame; the
 * detailed wood (grain, seams, gradients) is drawn once into a RenderTexture instead, and the texture is what
 * gets drawn each frame.
 */
export class BakedLayer {
  private readonly g: Phaser.GameObjects.Graphics;
  private texture: Phaser.GameObjects.RenderTexture | null = null;
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /**
   * Redraws the layer. `bounds` is the area the drawing covers, in the layer's own coordinates (null when
   * there is nothing to draw); the cached texture is only that big.
   */
  draw(bounds: Rect | null, paint: (g: Phaser.GameObjects.Graphics) => void, picture?: BakedPicture): void {
    this.texture?.destroy();
    this.texture = null;
    this.g.clear().setVisible(true);
    paint(this.g);
    if (!bounds) return;
    // The texture has one texel per device pixel, so it stays as sharp as the vector drawing.
    const r = pixelRatio();
    const width = Math.max(2, Math.ceil(bounds.width * r));
    const height = Math.max(2, Math.ceil(bounds.height * r));
    this.offsetX = bounds.x;
    this.offsetY = bounds.y;
    this.texture = this.scene.add
      .renderTexture(this.g.x + bounds.x, this.g.y + bounds.y, width, height)
      .setOrigin(0)
      .setScale(1 / r)
      .setDepth(this.depth)
      .setAlpha(this.g.alpha);
    const { x, y } = this.g;
    // A picture under the drawing (a backdrop), baked into the same texture: one layer to draw each frame.
    const image = picture ? new Phaser.GameObjects.Image(this.scene, 0, 0, picture.key) : null;
    if (picture && image) {
      image.setPosition((picture.x - bounds.x) * r, (picture.y - bounds.y) * r).setScale(picture.scale * r);
      this.texture.draw(image);
    }
    this.g.setScale(r).setPosition(0, 0);
    // Drawing is queued until render(): the picture's image may only go after it.
    this.texture.draw(this.g, -bounds.x * r, -bounds.y * r).render();
    image?.destroy();
    this.g.setScale(1).setPosition(x, y).setVisible(false);
  }

  setPosition(x: number, y: number): this {
    this.g.setPosition(x, y);
    this.texture?.setPosition(x + this.offsetX, y + this.offsetY);
    return this;
  }

  setAlpha(alpha: number): this {
    this.g.setAlpha(alpha);
    this.texture?.setAlpha(alpha);
    return this;
  }

  destroy(): void {
    this.texture?.destroy();
    this.g.destroy();
  }
}
