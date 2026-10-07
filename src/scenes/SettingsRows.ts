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
}

export interface SettingsHandlers {
  onSound(on: boolean): void;
  onColorBlind(on: boolean): void;
  onVibration(on: boolean): void;
}

/** Height of one settings row. */
export const SETTINGS_ROW = 52;

/** How many rows `settingsRows` adds for a state. */
export const settingsRowCount = (state: SettingsState): number => (state.canVibrate ? 3 : 2);

/**
 * The settings as switch rows (icon and label on the left, a switch on the right), added to `parent` from `top`:
 * sound, colour-blind mode and, where the device can vibrate, vibration. Shared by the pause menu and the home
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
  row(top, state.soundOn ? 'sound' : 'mute', 'pause.sound', state.soundOn, (on) => handlers.onSound(on));
  row(top + SETTINGS_ROW, 'eye', 'pause.colorBlind', state.colorBlind, (on) => handlers.onColorBlind(on));
  if (state.canVibrate) row(top + SETTINGS_ROW * 2, 'bolt', 'settings.vibration', state.vibration, (on) => handlers.onVibration(on));
}
