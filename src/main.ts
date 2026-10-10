import * as Phaser from 'phaser';
import { resolveLocale, setLocale, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { wantsGallery } from './dev/galleryParam';
import { wantsSaveReset } from './dev/saveParams';
import { parseCoinsParam, parseLang, parseProgressParam, parseSafeArea, parseSlotAspect, wantsUikit } from './dev/uiParams';
import { playList } from './scenes/playList';
import { GameScene } from './scenes/GameScene';
import { HomeScene } from './scenes/HomeScene';
import { setKitFeedback, setReducedMotion } from './scenes/kit';
import { WebHapticsService } from './services/HapticsService';
import { LocalSaveService } from './services/LocalSaveService';
import { ProgressStore } from './services/ProgressStore';
import { WebAudioSoundService } from './services/WebAudioSoundService';
import { preventPageGestures } from './ui/preventPageGestures';
import { SKIN } from './ui/design/tokens';
import { setSlotAspect } from './ui/boardLayout';
import { forceSafeArea, RENDER_RATIO } from './scenes/view';

setLocale((import.meta.env.DEV ? parseLang(window.location.search) : null) ?? resolveLocale(navigator.languages));
document.title = t('game.title');
preventPageGestures();

// The system's 'reduce motion' preference is the default until the player chooses.
const systemReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = new ProgressStore(new LocalSaveService(), systemReducedMotion);
// Development only: ?resetSave starts from an empty save. Production builds drop this branch.
if (import.meta.env.DEV && wantsSaveReset(window.location.search)) store.reset();
// Development only: ?slotAspect=1.4 tries other slot shapes, ?safeArea=47,0,34,0 a phone's notch.
if (import.meta.env.DEV) {
  const aspect = parseSlotAspect(window.location.search);
  if (aspect !== null) setSlotAspect(aspect);
  forceSafeArea(parseSafeArea(window.location.search));
  const progress = parseProgressParam(window.location.search, playList.length);
  if (progress !== null) {
    const before = store.totalStars;
    playList.slice(0, progress).forEach(({ level }, i) => store.recordWin(level.id, 1000, ([3, 2, 1] as const)[i % 3]));
    store.addChestStars(store.totalStars - before);
  }
  const coins = parseCoinsParam(window.location.search);
  if (coins !== null) store.setCoins(coins);
}

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
    backgroundColor: SKIN.backdrop[1],
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
    // Development only (?headless): a timer-driven loop without delta smoothing, so a headless browser's virtual
    // time moves the game (for screenshots of animations).
    ...(import.meta.env.DEV && new URLSearchParams(window.location.search).has('headless')
      ? { fps: { forceSetTimeOut: true, target: 30, smoothStep: false } }
      : {}),
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

setReducedMotion(store.reduceMotion);
const haptics = new WebHapticsService();
haptics.setEnabled(store.vibration);
// Every kit button and panel answers with a sound.
setKitFeedback({ press: () => sound.play('tap'), open: () => sound.play('open'), close: () => sound.play('close') });

const gameScenes = () => [new BootScene(store), new HomeScene(sound, store, haptics), new GameScene(sound, store, haptics)];

// Development only: ?gallery opens the icon gallery. Production builds drop this branch and the gallery code.
if (import.meta.env.DEV && wantsGallery(window.location.search)) {
  void import('./dev/GalleryScene').then(({ GalleryScene }) => startGame([GalleryScene]));
} else if (import.meta.env.DEV && wantsUikit(window.location.search)) {
  void import('./dev/UikitScene').then(({ UikitScene }) => startGame([UikitScene]));
} else {
  startGame(gameScenes());
}
