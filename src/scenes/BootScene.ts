import * as Phaser from 'phaser';
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
import { playList } from './playList';

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

  private start(): void {
    const search = window.location.search;
    const numbers = playList.map((entry) => entry.number);
    const dev = import.meta.env.DEV ? { level: parseLevelParam(search, numbers), home: wantsHome(search) } : undefined;
    const start = startScreen(this.store.progress.completed.length, dev);
    if (start.scene === 'Game') {
      this.scene.start('Game', { levelIndex: start.levelIndex } satisfies GameData);
      return;
    }
    // Development only: ?arrival=N plays the sequence that follows winning level N with three stars.
    const arrived = import.meta.env.DEV ? parseArrivalParam(search, playList.length) : null;
    const data: HomeData =
      arrived === null
        ? {}
        : { arrival: { level: arrived, starsBefore: 0, starsAfter: 3, totalBefore: Math.max(0, this.store.totalStars - 3), next: Math.min(arrived + 1, playList.length - 1) } };
    this.scene.start('Home', data);
  }
}
