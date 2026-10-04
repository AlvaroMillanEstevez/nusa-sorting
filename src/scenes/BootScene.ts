import * as Phaser from 'phaser';
import { art } from './art/ArtSet';
import { generateItemTextures } from './itemTextures';

/** Prepares shared resources and hands over to the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void art()
      .prepareItems(this)
      .then(() => {
        generateItemTextures(this);
        this.scene.start('Game');
      });
  }
}
