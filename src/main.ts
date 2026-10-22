import * as Phaser from 'phaser';
import { resolveLocale, setLocale, t } from './i18n';
import { BootScene } from './scenes/BootScene';
import { wantsGallery } from './dev/galleryParam';
import { wantsSaveReset } from './dev/saveParams';
import { parseChestStarsParam, parseCoinsParam, parseLang, parseProgressParam, parseSafeArea, parseSlotAspect, wantsUikit } from './dev/uiParams';
import { addDemoLevels, playList, replaceLevelForPreview } from './scenes/playList';
import { FRESH_FOOD_INTRO, GameScene } from './scenes/GameScene';
import { hideLoadingScreen } from './ui/loadingScreen';
import { HomeScene, PASARAN_INTRO } from './scenes/HomeScene';
import { setKitFeedback, setReducedMotion } from './scenes/kit';
import { WebHapticsService } from './services/HapticsService';
import { LocalSaveService } from './services/LocalSaveService';
import { ProgressStore } from './services/ProgressStore';
import { WebAudioSoundService } from './services/WebAudioSoundService';
import { preventPageGestures } from './ui/preventPageGestures';
import { SKIN } from './ui/design/tokens';
import { setSlotAspect } from './ui/boardLayout';
import { forceSafeArea, RENDER_RATIO, updateUiScale } from './scenes/view';
import { useCuts } from './scenes/transitions';
import { kindsOfLevel } from './core/album';

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
    // Their items are in Buku Nenek, as after playing them (not news for the map).
    store.findKinds(playList.slice(0, progress).flatMap(({ level }) => kindsOfLevel(level)));
    store.takeAlbumNews();
  }
  const coins = parseCoinsParam(window.location.search);
  if (coins !== null) store.setCoins(coins);
  const chestStars = parseChestStarsParam(window.location.search);
  if (chestStars !== null) store.addChestStars(chestStars - store.wallet.chestStars);
}

// Development only: ?demo=N adds the demo levels of the test fixtures (as levels 101 and up) and opens demo N.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
  const { demoLevels } = await import('../tests/fixtures/demo-levels');
  addDemoLevels(demoLevels);
}

const sound = new WebAudioSoundService();
sound.setMuted(store.muted);
sound.setMusic(store.music);
// Audio starts, and resumes after the page was hidden or interrupted (iOS: a call, switching apps), only inside
// a user gesture: every touchend, click and key press tries (it does nothing while audio is running).
for (const type of ['touchend', 'click', 'keydown']) document.addEventListener(type, () => sound.unlock(), { capture: true, passive: true });

/** The page's size in CSS pixels; the canvas gets RENDER_RATIO device pixels for each (see scenes/view). */
function pageSize(): { width: number; height: number } {
  const parent = document.getElementById('game')!;
  return { width: parent.clientWidth || window.innerWidth, height: parent.clientHeight || window.innerHeight };
}

/**
 * Starts Phaser with these scenes. The page's loading picture stays until the game's first screen is ready
 * (`loading`, the game itself: Boot removes it); development pages drop it at once.
 */
function startGame(scene: Phaser.Types.Scenes.SceneType[], loading = false): void {
  if (!loading) hideLoadingScreen();
  const { width, height } = pageSize();
  updateUiScale(width, height);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: SKIN.backdrop[1],
    disableContextMenu: true,
    // A clean console in production (portals check it): no engine banner.
    banner: import.meta.env.DEV,
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
  // Development only: what tools/check/flow.mjs follows the game by (the active scenes and the level open).
  if (import.meta.env.DEV) {
    (window as unknown as { __nusa: unknown }).__nusa = {
      scenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
      level: () => (game.scene.isActive('Game') ? (game.scene.getScene('Game') as GameScene).levelNumber : null),
      // A move as the player makes it (with its animations and effects), the board's state, and the expert's autoplay.
      move: (from: [number, number], to: [number, number]) => (game.scene.getScene('Game') as GameScene).devMove(from, to),
      state: () => (game.scene.getScene('Game') as GameScene).devState(),
      autoplay: () => (game.scene.getScene('Game') as GameScene).devPlay(),
    };
  }
  const resize = () => {
    const size = pageSize();
    updateUiScale(size.width, size.height);
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
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')) {
  // Development only: ?preview=landscape|portrait plays the store video: the cover, then a short board solved by
  // itself (triples, combos, the belt, shelves that close), then the map (tools/preview/record.mjs records it).
  void Promise.all([import('./dev/CoverScene'), import('./dev/previewLevel')]).then(([{ CoverScene }, { previewLevel, PREVIEW_LEVEL_NUMBER }]) => {
    replaceLevelForPreview(PREVIEW_LEVEL_NUMBER, previewLevel);
    useCuts(true);
    // Nothing stops the video: the fresh food's intro and the market day's explanation count as seen.
    store.markTutorialDone(FRESH_FOOD_INTRO);
    store.markTutorialDone(PASARAN_INTRO);
    const shape = new URLSearchParams(window.location.search).get('preview') === 'portrait' ? 'portrait' : 'landscape';
    startGame([new CoverScene(shape, { next: 'Boot', holdMs: 2200 }), ...gameScenes()]);
  });
} else if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('cover')) {
  // Development only: ?cover=landscape|portrait|square draws a store cover (tools/covers/render.sh saves them).
  void import('./dev/CoverScene').then(({ CoverScene, parseCoverParam }) => startGame([new CoverScene(parseCoverParam(window.location.search)!)]));
} else if (import.meta.env.DEV && wantsUikit(window.location.search)) {
  void import('./dev/UikitScene').then(({ UikitScene }) => startGame([UikitScene]));
} else {
  startGame(gameScenes(), true);
}
