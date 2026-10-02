import * as Phaser from 'phaser';

new Phaser.Game({
  type: Phaser.AUTO,
  backgroundColor: '#1b2a3a',
  scale: {
    parent: 'game',
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
});
