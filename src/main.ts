import * as Phaser from 'phaser';
import { resolveLocale, setLocale, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { wantsArtV2 } from './dev/artParam';
import { wantsGallery } from './dev/galleryParam';
import { wantsSaveReset } from './dev/saveParams';
import { setArt } from './scenes/art/ArtSet';
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

function startGame(scene: Phaser.Types.Scenes.SceneType[]): void {
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
    scene,
  });
}

const gameScenes = () => [BootScene, new GameScene(sound, store), new LevelSelectScene(sound, store)];

// Development only: ?gallery opens the icon gallery, ?art=v2 plays with the new art. Production builds drop
// these branches along with the gallery and the new art's code.
if (import.meta.env.DEV && wantsGallery(window.location.search)) {
  void import('./dev/GalleryScene').then(({ GalleryScene }) => startGame([GalleryScene]));
} else if (import.meta.env.DEV && wantsArtV2(window.location.search)) {
  void import('./scenes/art/woodArt').then(({ woodArt }) => {
    setArt(woodArt);
    startGame(gameScenes());
  });
} else {
  startGame(gameScenes());
}
