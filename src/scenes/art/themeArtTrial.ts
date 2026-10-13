import type * as Phaser from 'phaser';

/**
 * Development only (?themeArt): illustrated art being tried for themed levels and their map islands, set up by
 * src/dev/themeArtTrial.ts before the game starts. Empty in the game itself, so it always looks as it does by
 * default.
 */
export interface ThemeArtTrial {
  /** The background of a themed level for a screen shape (its texture key, added to `textures`), or null. */
  backdrop(textures: Phaser.Textures.TextureManager, theme: string, shape: 'portrait' | 'landscape'): string | null;
  /** A themed island's picture on the map (its texture key, added to `textures`), or null. */
  island(textures: Phaser.Textures.TextureManager, theme: string): string | null;
}

let trial: ThemeArtTrial | null = null;

export const themeArtTrial = (): ThemeArtTrial | null => trial;

export function setThemeArtTrial(next: ThemeArtTrial | null): void {
  trial = next;
}
