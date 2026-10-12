import * as Phaser from 'phaser';
import { t, type MessageKey } from '../i18n';
import { SKIN, SPACE } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { KitToggle, kitText, uiIcon } from './kit';

/** The player's settings, as the settings rows show and change them. */
export interface SettingsState {
  readonly soundOn: boolean;
  readonly colorBlind: boolean;
  readonly vibration: boolean;
  /** The device can vibrate (the row is left out where it cannot, e.g. iOS Safari). */
  readonly canVibrate: boolean;
  readonly reduceMotion: boolean;
  /** Background music on or off; null where the game has none (the row is left out). */
  readonly music: boolean | null;
}

export interface SettingsHandlers {
  onSound(on: boolean): void;
  onColorBlind(on: boolean): void;
  onVibration(on: boolean): void;
  onReduceMotion(on: boolean): void;
  onMusic(on: boolean): void;
}

/** Height of one settings row. */
export const SETTINGS_ROW = 52;

/** How many rows `settingsRows` adds for a state. */
export const settingsRowCount = (state: SettingsState): number => 3 + (state.canVibrate ? 1 : 0) + (state.music === null ? 0 : 1);

/**
 * The settings as switch rows (icon and label on the left, a switch on the right), added to `parent` from `top`:
 * sound, colour-blind mode, reduce motion and, where the device can vibrate, vibration. Shared by the pause menu and the home
 * screen's settings.
 */
export function settingsRows(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  top: number,
  width: number,
  state: SettingsState,
  handlers: SettingsHandlers,
): void {
  const row = (y: number, icon: UiIconName, label: MessageKey, on: boolean, onChange: (on: boolean) => void) => {
    parent.add(uiIcon(scene, icon, SKIN.text.secondary, 24).setPosition(x + 12, y));
    const text = kitText(scene, 'body', t(label), SKIN.text.primary).setOrigin(0, 0.5).setPosition(x + 32, y);
    // Long translations shrink to fit beside the switch.
    const room = width - 32 - 60 - SPACE.s;
    if (text.width > room) text.setScale(Math.max(0.75, room / text.width));
    parent.add(text);
    parent.add(new KitToggle(scene, x + width - 30, y, SKIN, on, onChange));
  };
  let y = top;
  const next = () => (y += SETTINGS_ROW) - SETTINGS_ROW;
  row(next(), state.soundOn ? 'sound' : 'mute', 'pause.sound', state.soundOn, (on) => handlers.onSound(on));
  if (state.music !== null) row(next(), 'music', 'settings.music', state.music, (on) => handlers.onMusic(on));
  row(next(), 'eye', 'pause.colorBlind', state.colorBlind, (on) => handlers.onColorBlind(on));
  row(next(), 'motion', 'settings.reduceMotion', state.reduceMotion, (on) => handlers.onReduceMotion(on));
  if (state.canVibrate) row(next(), 'bolt', 'settings.vibration', state.vibration, (on) => handlers.onVibration(on));
}
