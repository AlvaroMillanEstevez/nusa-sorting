import type * as Phaser from 'phaser';
import { prepareLevelTextures } from '../itemTextures';
import { loadArtPieces } from './ArtSet';
import { backdropShape, loadBackdrop } from './backdrops';
import { loadShelfArt } from './shelfArt';

/**
 * What a level needs before it opens: its items and the board's wood (small, downloaded once). The background of
 * levels without a theme is fetched at the same time but not waited for: until it arrives the drawn one shows.
 */
export function prepareBoard(scene: Phaser.Scene, levelIndex: number): Promise<void> {
  const { width, height } = scene.scale.gameSize;
  void loadBackdrop(scene.textures, backdropShape(width, height));
  return Promise.all([prepareLevelTextures(scene, levelIndex), loadShelfArt(scene.textures), loadArtPieces(scene.textures)]).then(() => undefined);
}
