import * as Phaser from 'phaser';
import { resolveLocale, setLocale } from './i18n';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { preventPageGestures } from './ui/preventPageGestures';
import { theme } from './ui/theme';

setLocale(resolveLocale(navigator.languages));
preventPageGestures();

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: theme.background,
  disableContextMenu: true,
  input: {
    // preventDefault on touch events so dragging never scrolls or zooms the page.
    touch: { capture: true },
  },
  scale: {
    parent: 'game',
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, GameScene],
});
