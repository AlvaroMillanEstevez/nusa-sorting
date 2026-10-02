import * as Phaser from 'phaser';
import { t } from '../i18n';
import { titleFontSize } from '../ui/layout';
import { theme } from '../ui/theme';

export class BootScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;

  constructor() {
    super('Boot');
  }

  create(): void {
    this.title = this.add
      .text(0, 0, t('game.title'), {
        fontFamily: theme.fontFamily,
        fontStyle: 'bold',
        color: theme.titleColor,
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 1);

    this.layout(this.scale.gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(gameSize: Phaser.Structs.Size): void {
    const { width, height } = gameSize;
    this.cameras.main.setSize(width, height);
    this.title.setFontSize(titleFontSize(width, height));
    this.title.setPosition(width / 2, height / 2);
  }
}
