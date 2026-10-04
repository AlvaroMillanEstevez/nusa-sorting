import type * as Phaser from 'phaser';

/**
 * Rasterizes an SVG document into a `size` × `size` texture (in texture pixels), drawn as vector at that size
 * rather than scaled from another bitmap. Does nothing if the key already exists.
 */
export async function addSvgTexture(textures: Phaser.Textures.TextureManager, key: string, svg: string, size: number): Promise<void> {
  if (textures.exists(key)) return;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size));
    canvas.height = canvas.width;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d canvas context');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Another call may have finished the same key while this one was decoding.
    if (!textures.exists(key)) textures.addCanvas(key, canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
