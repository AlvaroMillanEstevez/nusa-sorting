import * as Phaser from 'phaser';
import { resolveLocale, setLocale, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { wantsGallery } from './dev/galleryParam';
import { wantsSaveReset } from './dev/saveParams';
import { GameScene } from './scenes/GameScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { LocalSaveService } from './services/LocalSaveService';
import { ProgressStore } from './services/ProgressStore';
import { WebAudioSoundService } from './services/WebAudioSoundService';
import { preventPageGestures } from './ui/preventPageGestures';
import { theme } from './ui/theme';
import { RENDER_RATIO } from './scenes/view';

setLocale(resolveLocale(navigator.languages));
document.title = t('game.title');
preventPageGestures();

const store = new ProgressStore(new LocalSaveService());
// Development only: ?resetSave starts from an empty save. Production builds drop this branch.
if (import.meta.env.DEV && wantsSaveReset(window.location.search)) store.reset();

const sound = new WebAudioSoundService();
sound.setMuted(store.muted);

/** The page's size in CSS pixels; the canvas gets RENDER_RATIO device pixels for each (see scenes/view). */
function pageSize(): { width: number; height: number } {
  const parent = document.getElementById('game')!;
  return { width: parent.clientWidth || window.innerWidth, height: parent.clientHeight || window.innerHeight };
}

function startGame(scene: Phaser.Types.Scenes.SceneType[]): void {
  const { width, height } = pageSize();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: theme.background,
    disableContextMenu: true,
    input: {
      // preventDefault on touch events so dragging never scrolls or zooms the page.
      touch: { capture: true },
    },
    // Phaser has no render resolution setting: the canvas is sized in device pixels and shown at CSS size
    // (zoom), and every scene's camera zooms back so layouts work in CSS pixels. Resizing is ours to follow.
    scale: {
      parent: 'game',
      mode: Phaser.Scale.NONE,
      width: Math.round(width * RENDER_RATIO),
      height: Math.round(height * RENDER_RATIO),
      zoom: 1 / RENDER_RATIO,
    },
    render: {
      // Item icons are drawn larger than they show; mipmaps keep them smooth when scaled down.
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
    },
    scene,
  });
  const resize = () => {
    const size = pageSize();
    game.scale.resize(Math.round(size.width * RENDER_RATIO), Math.round(size.height * RENDER_RATIO));
  };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
}

const gameScenes = () => [BootScene, new GameScene(sound, store), new LevelSelectScene(sound, store)];

// Development only: ?gallery opens the icon gallery. Production builds drop this branch and the gallery code.
if (import.meta.env.DEV && wantsGallery(window.location.search)) {
  void import('./dev/GalleryScene').then(({ GalleryScene }) => startGame([GalleryScene]));
} else {
  startGame(gameScenes());
}
