import * as Phaser from 'phaser';
import { resolveLocale, setLocale } from './i18n';
import { BootScene } from './scenes/BootScene';
import { theme } from './ui/theme';

setLocale(resolveLocale(navigator.languages));

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: theme.background,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene],
});
