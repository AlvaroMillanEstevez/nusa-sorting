import type * as Phaser from 'phaser';
import portraitUrl from '../../assets/art/background-portrait.webp?url';
import landscapeUrl from '../../assets/art/background-landscape.webp?url';

/**
 * The illustrated backgrounds: for levels without a theme, a street of warungs at dusk; for a themed level, its
 * theme's own picture once it is ready (tools/art/build_game_art.py puts them in assets/art/themes: themes without
 * one keep their drawn backdrop). Upright for phones and wide for desktops. Each is downloaded only when a level
 * that needs it opens, never before the game can be played: until it arrives the drawn backdrop shows, and the
 * picture replaces it as soon as it is there.
 */
export type BackdropShape = 'portrait' | 'landscape';

const PLAIN: Record<BackdropShape, string> = { portrait: portraitUrl, landscape: landscapeUrl };
const THEMED = import.meta.glob('../../assets/art/themes/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Where a background is, or undefined for a theme without its picture yet. */
const urlOf = (shape: BackdropShape, theme: string | null): string | undefined => (theme ? THEMED[`../../assets/art/themes/${theme}-${shape}.webp`] : PLAIN[shape]);

/** Whether a background exists: always without a theme; for a theme, once its pictures are in. */
export const hasBackdrop = (shape: BackdropShape, theme: string | null = null): boolean => urlOf(shape, theme) !== undefined;

export const backdropKey = (shape: BackdropShape, theme: string | null = null) => (theme ? `backdrop:${theme}:${shape}` : `backdrop:${shape}`);

/** The picture that covers a screen of this size with the least cropped away. */
export const backdropShape = (width: number, height: number): BackdropShape => (width > height ? 'landscape' : 'portrait');

const loading = new Map<string, Promise<void>>();

/** Downloads a background once and adds it as a texture; resolves when it is ready (at once if there is none). */
export function loadBackdrop(textures: Phaser.Textures.TextureManager, shape: BackdropShape, theme: string | null = null): Promise<void> {
  const url = urlOf(shape, theme);
  const key = backdropKey(shape, theme);
  if (!url) return Promise.resolve();
  let done = loading.get(key);
  if (!done) {
    const image = new Image();
    image.src = url;
    done = image
      .decode()
      .then(() => {
        if (!textures.exists(key)) textures.addImage(key, image);
      })
      // Without it the drawn backdrop stays: nothing else depends on the picture.
      .catch(() => undefined);
    loading.set(key, done);
  }
  return done;
}
