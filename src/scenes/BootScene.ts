import * as Phaser from 'phaser';
import { prepareItemTextures } from './itemTextures';

/** Prepares shared resources and hands over to the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void prepareItemTextures(this).then(() => this.scene.start('Game'));
  }
}
