import * as Phaser from 'phaser';
import { prepareItemTextures } from './itemTextures';
import { prepareTutorialTextures } from './TutorialHint';

/** Prepares shared resources and hands over to the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void Promise.all([prepareItemTextures(this), prepareTutorialTextures(this)]).then(() => this.scene.start('Game'));
  }
}
