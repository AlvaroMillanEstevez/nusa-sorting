import type * as Phaser from 'phaser';
import type { Rect } from '../../ui/boardLayout';
import { art } from './ArtSet';

/**
 * A vector drawing (shelves, rails) that the current art may cache in a texture. Phaser redraws Graphics
 * commands every frame; detailed art (wood grain, seams, gradients) is drawn once into a RenderTexture
 * instead, and the texture is what gets drawn each frame. Art sets that do not ask for it keep plain Graphics.
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
  draw(bounds: Rect | null, paint: (g: Phaser.GameObjects.Graphics) => void): void {
    this.texture?.destroy();
    this.texture = null;
    this.g.clear().setVisible(true);
    paint(this.g);
    if (!bounds || !art().bakes) return;
    const width = Math.max(2, Math.ceil(bounds.width));
    const height = Math.max(2, Math.ceil(bounds.height));
    this.offsetX = bounds.x;
    this.offsetY = bounds.y;
    this.texture = this.scene.add
      .renderTexture(this.g.x + bounds.x, this.g.y + bounds.y, width, height)
      .setOrigin(0)
      .setDepth(this.depth)
      .setAlpha(this.g.alpha);
    this.texture.draw(this.g, -bounds.x, -bounds.y).render();
    this.g.setVisible(false);
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
