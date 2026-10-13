import type * as Phaser from 'phaser';
import portraitUrl from '../../assets/art/background-portrait.webp?url';
import landscapeUrl from '../../assets/art/background-landscape.webp?url';

/**
 * The illustrated backgrounds of levels without a theme: a street of warungs at dusk, upright for phones and wide
 * for desktops. Each is downloaded only when a screen of its shape first needs it, never before the game can be
 * played: until it arrives the drawn backdrop shows, and the picture replaces it as soon as it is there.
 */
export type BackdropShape = 'portrait' | 'landscape';

const URLS: Record<BackdropShape, string> = { portrait: portraitUrl, landscape: landscapeUrl };

export const backdropKey = (shape: BackdropShape) => `backdrop:${shape}`;

/** The picture that covers a screen of this size with the least cropped away. */
export const backdropShape = (width: number, height: number): BackdropShape => (width > height ? 'landscape' : 'portrait');

const loading = new Map<BackdropShape, Promise<void>>();

/** Downloads a background once and adds it as a texture; resolves when it is ready. */
export function loadBackdrop(textures: Phaser.Textures.TextureManager, shape: BackdropShape): Promise<void> {
  let done = loading.get(shape);
  if (!done) {
    const image = new Image();
    image.src = URLS[shape];
    done = image
      .decode()
      .then(() => {
        if (!textures.exists(backdropKey(shape))) textures.addImage(backdropKey(shape), image);
      })
      // Without it the drawn backdrop stays: nothing else depends on the picture.
      .catch(() => undefined);
    loading.set(shape, done);
  }
  return done;
}
