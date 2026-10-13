import type * as Phaser from 'phaser';
import { setThemeArtTrial } from '../scenes/art/themeArtTrial';

/**
 * Development only (?themeArt): tries the themed art prepared by tools/art/try_theme_art.py (src/dev/themeart,
 * not in git) in the game: a themed level's background and its island on the map. Nothing here reaches the game.
 */
const URLS = import.meta.glob('./themeart/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const images = new Map<string, HTMLImageElement>();

export async function installThemeArtTrial(): Promise<void> {
  await Promise.all(
    Object.entries(URLS).map(async ([path, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      images.set(path.slice('./themeart/'.length, -'.webp'.length), image);
    }),
  );
  const key = (textures: Phaser.Textures.TextureManager, name: string) => {
    const image = images.get(name);
    if (!image) return null;
    if (!textures.exists(`trial:${name}`)) textures.addImage(`trial:${name}`, image);
    return `trial:${name}`;
  };
  setThemeArtTrial({ backdrop: (textures, theme, shape) => key(textures, `${theme}-${shape}`), island: (textures, theme) => key(textures, `${theme}-island`) });
}
