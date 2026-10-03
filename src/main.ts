import * as Phaser from 'phaser';
import { resolveLocale, setLocale, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { wantsSaveReset } from './dev/saveParams';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { LocalSaveService } from './services/LocalSaveService';
import { ProgressStore } from './services/ProgressStore';
import { WebAudioSoundService } from './services/WebAudioSoundService';
import { preventPageGestures } from './ui/preventPageGestures';
import { theme } from './ui/theme';

setLocale(resolveLocale(navigator.languages));
document.title = t('game.title');
preventPageGestures();

const store = new ProgressStore(new LocalSaveService());
// Development only: ?resetSave starts from an empty save. Production builds drop this branch.
if (import.meta.env.DEV && wantsSaveReset(window.location.search)) store.reset();

const sound = new WebAudioSoundService();
sound.setMuted(store.muted);

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
  scene: [BootScene, new GameScene(sound, store), new LevelSelectScene(sound, store)],
});
