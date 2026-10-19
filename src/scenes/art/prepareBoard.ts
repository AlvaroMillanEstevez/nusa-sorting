import type * as Phaser from 'phaser';
import { prepareLevelTextures } from '../itemTextures';
import { loadArtPieces } from './ArtSet';
import { backdropShape, loadBackdrop } from './backdrops';
import { loadShelfArt } from './shelfArt';
import { playList } from '../playList';

/**
 * What a level needs before it opens: its items and the board's wood (small, downloaded once). Its background (the
 * warung street, or its theme's picture) is fetched at the same time but not waited for: until it arrives the
 * drawn one shows.
 */
export function prepareBoard(scene: Phaser.Scene, levelIndex: number): Promise<void> {
  const { width, height } = scene.scale.gameSize;
  void loadBackdrop(scene.textures, backdropShape(width, height), playList[levelIndex]?.level.theme ?? null);
  return Promise.all([prepareLevelTextures(scene, levelIndex), loadShelfArt(scene.textures), loadArtPieces(scene.textures)]).then(() => undefined);
}
