import * as Phaser from 'phaser';
import { generateItemTextures } from './itemTextures';

/** Prepares shared resources and hands over to the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateItemTextures(this);
    this.scene.start('Game');
  }
}
