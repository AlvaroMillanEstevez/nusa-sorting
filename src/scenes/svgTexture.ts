import type * as Phaser from 'phaser';

/**
 * Rasterizes an SVG document into a texture of exactly `px` × `px` CSS pixels (times the device pixel ratio),
 * so it is drawn 1:1 instead of being scaled down from a big bitmap. Does nothing if the key already exists.
 */
export async function addSvgTexture(textures: Phaser.Textures.TextureManager, key: string, svg: string, px: number): Promise<void> {
  if (textures.exists(key)) return;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const size = Math.max(1, Math.round(px * (window.devicePixelRatio || 1)));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d canvas context');
    context.drawImage(image, 0, 0, size, size);
    // Another call may have finished the same key while this one was decoding.
    if (!textures.exists(key)) textures.addCanvas(key, canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
