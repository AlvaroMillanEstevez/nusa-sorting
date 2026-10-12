import type * as Phaser from 'phaser';

/**
 * Rasterizes an SVG document into a `size` × `size` texture (in texture pixels), drawn as vector at that size
 * rather than scaled from another bitmap. Does nothing if the key already exists. `beforeDrawing`, if given, is
 * awaited between decoding and drawing: background work uses it to draw only when the browser has time to spare.
 */
export async function addSvgTexture(
  textures: Phaser.Textures.TextureManager,
  key: string,
  svg: string,
  size: number,
  beforeDrawing?: () => Promise<void>,
): Promise<void> {
  if (textures.exists(key)) return;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (beforeDrawing) await beforeDrawing();
    if (textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(size));
    canvas.height = canvas.width;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d canvas context');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Another call may have finished the same key while this one was decoding. Added as a plain image source,
    // not with addCanvas: a CanvasTexture reads every pixel back (getImageData) when it is made, which stalls the
    // frame (a GPU readback where the canvas is accelerated) and keeps a copy of the pixels for nothing.
    if (!textures.exists(key)) textures.addImage(key, canvas as unknown as HTMLImageElement);
  } finally {
    URL.revokeObjectURL(url);
  }
}
