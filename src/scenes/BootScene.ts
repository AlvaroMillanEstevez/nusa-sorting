import * as Phaser from 'phaser';
import { playerLevel, rewardWin } from '../core/economy';
import { ECONOMY } from '../data/economy';
import { SKIN } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { prepareAheadInBackground, settle } from './itemTextures';
import { prepareBoosterTextures } from './boosterTextures';
import { prepareBoard } from './art/prepareBoard';
import { prefetchIslandsAround } from './art/islandArt';
import { loadUiFonts, prepareUiIcon } from './kit';
import { prepareTutorialTextures } from './TutorialHint';
import { parseLevelParam } from '../dev/levelParam';
import { parseArrivalParam, wantsHome } from '../dev/uiParams';
import type { ProgressStore } from '../services/ProgressStore';
import { hideLoadingScreen } from '../ui/loadingScreen';
import { startScreen } from '../ui/startScreen';
import type { GameData } from './GameScene';
import type { HomeData } from './HomeScene';
import type { Arrival } from './map/arrival';
import { playList } from './playList';
import { resumeFromSnapshot } from './playedLevel';

/** The interface icons the game shows, in the colours it shows them, prepared before it starts so none pops in. */
const GAME_ICONS: readonly UiIconName[] = ['pause', 'close', 'play', 'restart', 'home', 'next', 'settings', 'sound', 'mute', 'eye', 'bolt', 'clock', 'trophy', 'lock'];
const ICONS: readonly (readonly [UiIconName, string])[] = [
  ...GAME_ICONS.flatMap((name) => [SKIN.text.primary, SKIN.text.secondary, SKIN.fills.primary.text, SKIN.fills.secondary.text, SKIN.fills.danger.text].map((c) => [name, c] as const)),
  ['star', SKIN.star.rim],
  ['starFilled', SKIN.star.filled],
  // The clock on the tile of more time, when continuing after running out of it.
  ['clock', SKIN.text.accent],
  ['starFilled', SKIN.text.accent],
  ['starFilled', SKIN.surface.border],
  ['combo', SKIN.status.combo],
  ['check', SKIN.fills.positive.lip],
  ['close', '#5b6672'],
];

/**
 * Prepares shared resources (the shelves' pictures, interface fonts and icons), then opens the game where it should start:
 * level 1 on a first visit, the home screen after that (see startScreen).
 */
export class BootScene extends Phaser.Scene {
  constructor(private readonly store: ProgressStore) {
    super('Boot');
  }

  create(): void {
    // Load timing for the browser's performance tools (no output of its own).
    performance.mark('nusa:boot');
    const icons = ICONS.map(([name, color]) => prepareUiIcon(this, name, color));
    void Promise.all([prepareBoosterTextures(this), prepareTutorialTextures(this), loadUiFonts(), ...icons]).then(() => this.start());
  }

  /** Development only (?arrival=N): a three-star win of level N, with rewards that show every step. */
  private sampleArrival(level: number): Arrival {
    const every = ECONOMY.chests.everyStars;
    // Two stars short of a chest, so the win's three light it up.
    const wallet = { ...this.store.wallet, chestStars: Math.max(this.store.wallet.chestStars, every - 2) };
    const { into, needed } = playerLevel(wallet.xp);
    const rewards = rewardWin(wallet, {
      levelNumber: playList[level]!.number,
      firstClear: true,
      stars: 3,
      bestStarsBefore: 0,
      score: needed - into + 200,
      totalStarsBefore: (wallet.chestsOpened + 1) * every - 1,
      totalStarsAfter: (wallet.chestsOpened + 1) * every + 2,
    });
    return { level, starsBefore: 0, starsAfter: 3, totalBefore: Math.max(0, this.store.totalStars - 3), next: Math.min(level + 1, playList.length - 1), rewards };
  }

  private start(): void {
    const search = window.location.search;
    const numbers = playList.map((entry) => entry.number);
    const dev = import.meta.env.DEV ? { level: parseLevelParam(search, numbers), home: wantsHome(search) } : undefined;
    // A level left half played (the page was reloaded or the browser dropped it) opens as it was. In development
    // ?level= (or ?demo=) for the same level picks it up too, so F5 behaves as in the game; for another level, or
    // with ?home, they win over it and keep it for later.
    const resume = !dev || !dev.home ? resumeFromSnapshot(this.store.snapshot) : null;
    if (!dev || (!dev.home && (dev.level === null || dev.level === resume?.levelIndex))) {
      if (resume) {
        this.openLevel(resume.levelIndex, { resume });
        return;
      }
      // It no longer fits the game (the level or the format changed): dropped quietly.
      this.store.clearSnapshot();
    }
    const start = startScreen(this.store.progress.completed.length, dev);
    // Opening on the map: the islands around the player's level start downloading now.
    if (start.scene !== 'Game') prefetchIslandsAround(this.textures, playList.map((entry) => entry.level), playList.map((entry) => entry.number), this.store.firstIncomplete(playList.map((entry) => entry.level.id)) ?? playList.length - 1);
    if (start.scene === 'Game') {
      this.openLevel(start.levelIndex, { levelIndex: start.levelIndex });
      return;
    }
    // Development only: ?arrival=N plays the sequence that follows winning level N with three stars, with sample
    // rewards (coins, a player level, and stars that light up the chest) that are shown but not saved.
    const arrived = import.meta.env.DEV ? parseArrivalParam(search, playList.length) : null;
    const data: HomeData = arrived === null ? {} : { arrival: this.sampleArrival(arrived) };
    performance.mark('nusa:playable');
    hideLoadingScreen();
    this.scene.start('Home', data);
  }

  /** Opens a level once its own items are ready; the next levels' are prepared afterwards, in the background. */
  private openLevel(levelIndex: number, data: GameData): void {
    void prepareBoard(this, levelIndex)
      .then(settle)
      .then(() => {
        performance.mark('nusa:playable');
        hideLoadingScreen();
        this.scene.start('Game', data);
        void prepareAheadInBackground(this, levelIndex + 1, this.store.colorBlindMode);
      });
  }
}
