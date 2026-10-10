import * as Phaser from 'phaser';
import { playerLevel, rewardWin } from '../core/economy';
import { ECONOMY } from '../data/economy';
import { SKIN } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { prepareItemTextures } from './itemTextures';
import { loadUiFonts, prepareUiIcon } from './kit';
import { prepareTutorialTextures } from './TutorialHint';
import { parseLevelParam } from '../dev/levelParam';
import { parseArrivalParam, wantsHome } from '../dev/uiParams';
import type { ProgressStore } from '../services/ProgressStore';
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
  ['starFilled', SKIN.text.accent],
  ['starFilled', SKIN.surface.border],
  ['combo', SKIN.status.combo],
  ['check', SKIN.fills.positive.lip],
  ['close', '#5b6672'],
];

/**
 * Prepares shared resources (item icons, interface fonts and icons), then opens the game where it should start:
 * level 1 on a first visit, the home screen after that (see startScreen).
 */
export class BootScene extends Phaser.Scene {
  constructor(private readonly store: ProgressStore) {
    super('Boot');
  }

  create(): void {
    const icons = ICONS.map(([name, color]) => prepareUiIcon(this, name, color));
    void Promise.all([prepareItemTextures(this), prepareTutorialTextures(this), loadUiFonts(), ...icons]).then(() => this.start());
  }

  /** Development only (?arrival=N): a three-star win of level N, with rewards that show every step. */
  private sampleArrival(level: number): Arrival {
    const wallet = this.store.wallet;
    const { into, needed } = playerLevel(wallet.xp);
    const every = ECONOMY.chests.everyStars;
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
    // ?level= and ?home win over it, and keep it for later.
    if (!dev || (dev.level === null && !dev.home)) {
      const resume = resumeFromSnapshot(this.store.snapshot);
      if (resume) {
        this.scene.start('Game', { resume } satisfies GameData);
        return;
      }
      // It no longer fits the game (the level or the format changed): dropped quietly.
      this.store.clearSnapshot();
    }
    const start = startScreen(this.store.progress.completed.length, dev);
    if (start.scene === 'Game') {
      this.scene.start('Game', { levelIndex: start.levelIndex } satisfies GameData);
      return;
    }
    // Development only: ?arrival=N plays the sequence that follows winning level N with three stars, with sample
    // rewards (coins, a player level and a chest) that are shown but not saved.
    const arrived = import.meta.env.DEV ? parseArrivalParam(search, playList.length) : null;
    const data: HomeData = arrived === null ? {} : { arrival: this.sampleArrival(arrived) };
    this.scene.start('Home', data);
  }
}
