import type * as Phaser from 'phaser';
import { MARKET } from '../ui/design/tokens';
import { ITEM_TEXTURE_SIZE } from './itemTextures';

/**
 * The market day's mark, drawn on a picture (`size` px square): a small brass kepeng (the old Javanese coin with a
 * square hole) in the bottom-left corner, the one corner free of the fresh tag (top left) and the colour-blind badge
 * (bottom right). Small and quiet: it tells the item pays coins today without competing with the countdown.
 */
export function drawKepeng(context: CanvasRenderingContext2D, size: number): void {
  const u = size / 100;
  const [x, y, r] = [14 * u, 86 * u, 8.5 * u];
  context.save();
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.fillStyle = MARKET.coin;
  context.fill();
  context.lineWidth = 1.8 * u;
  context.strokeStyle = MARKET.outline;
  context.stroke();
  // A lighter rim inside the edge, and the square hole.
  context.beginPath();
  context.arc(x, y, r - 2.4 * u, Math.PI * 0.9, Math.PI * 1.9);
  context.lineWidth = 1.4 * u;
  context.strokeStyle = MARKET.coinLight;
  context.stroke();
  const hole = 3.4 * u;
  context.fillStyle = MARKET.hole;
  context.fillRect(x - hole / 2, y - hole / 2, hole, hole);
  context.restore();
}

/** The texture of an item marked for the market day: its usual one (`base`) with the kepeng, made once. */
export function marketKey(textures: Phaser.Textures.TextureManager, base: string): string | null {
  if (!textures.exists(base)) return null;
  const key = `${base}:market`;
  if (!textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ITEM_TEXTURE_SIZE;
    const context = canvas.getContext('2d')!;
    context.drawImage(textures.get(base).getSourceImage() as CanvasImageSource, 0, 0, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE);
    drawKepeng(context, ITEM_TEXTURE_SIZE);
    textures.addImage(key, canvas as unknown as HTMLImageElement);
  }
  return key;
}
