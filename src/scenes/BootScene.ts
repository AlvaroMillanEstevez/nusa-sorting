import * as Phaser from 'phaser';
import { SKIN } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { prepareItemTextures } from './itemTextures';
import { loadUiFonts, prepareUiIcon } from './kit';
import { prepareTutorialTextures } from './TutorialHint';

/** The interface icons the game shows, in the colours it shows them, prepared before it starts so none pops in. */
const GAME_ICONS: readonly UiIconName[] = ['pause', 'close', 'play', 'restart', 'levels', 'next', 'back', 'sound', 'mute', 'eye', 'clock', 'trophy', 'lock'];
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

/** Prepares shared resources (item icons, interface fonts and icons) and hands over to the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const icons = ICONS.map(([name, color]) => prepareUiIcon(this, name, color));
    void Promise.all([prepareItemTextures(this), prepareTutorialTextures(this), loadUiFonts(), ...icons]).then(() => this.scene.start('Game'));
  }
}
