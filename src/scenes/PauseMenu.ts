import * as Phaser from 'phaser';
import { t, type MessageKey } from '../i18n';
import { SKIN, SPACE } from '../ui/design/tokens';
import type { UiIconName } from '../ui/design/uiIcons';
import { KitButton, KitIconButton, KitModal, KitPill, kitText, type KitPanel } from './kit';
import { settingsRowCount, settingsRows, SETTINGS_ROW } from './SettingsRows';
import { screenRect, viewSize } from './view';

/** Over the board, the HUD and popups; under the result panel. */
const DEPTH_PAUSE = 290;

export interface PauseHandlers {
  onResume(): void;
  onRestart(): void;
  onHome(): void;
  onSound(on: boolean): void;
  onColorBlind(on: boolean): void;
  onVibration(on: boolean): void;
  onReduceMotion(on: boolean): void;
}

export interface PauseInfo {
  readonly levelNumber: number;
  readonly special: boolean;
  readonly soundOn: boolean;
  readonly colorBlind: boolean;
  readonly vibration: boolean;
  readonly canVibrate: boolean;
  readonly reduceMotion: boolean;
  /** The level has started (a move or a touch): restarting or leaving asks first. */
  readonly started: boolean;
}

type View = 'menu' | 'confirmRestart' | 'confirmLeave';

/**
 * The pause menu: continue, restart, leave for the level list, sound and colour-blind mode, with the level's
 * number. While it is open the game is paused (the scene stops the clock, the tracks and the combo). Restarting
 * or leaving a level already under way asks for confirmation first.
 */
export class PauseMenu {
  private modal: KitModal | null = null;
  private info: PauseInfo | null = null;
  private view: View = 'menu';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly handlers: PauseHandlers,
  ) {}

  get visible(): boolean {
    return this.info !== null;
  }

  open(info: PauseInfo): void {
    this.info = info;
    this.view = 'menu';
    this.build(true);
  }

  /** Closes without calling back. */
  close(): void {
    this.info = null;
    this.modal?.destroy();
    this.modal = null;
  }

  /** Rebuilds for a new screen size, keeping the view. */
  relayout(): void {
    if (this.info) this.build(false);
  }

  /** Opens straight on a confirmation (development only, to review it). */
  showConfirm(which: 'restart' | 'leave'): void {
    if (this.info) this.show(which === 'restart' ? 'confirmRestart' : 'confirmLeave');
  }

  private show(view: View): void {
    this.view = view;
    this.build(false);
  }

  private build(animate: boolean): void {
    this.modal?.destroy();
    const info = this.info!;
    const screen = screenRect(this.scene);
    const safe = viewSize(this.scene);
    const wide = safe.height < 540;
    const confirm = this.view !== 'menu';
    const panelW = Math.min(safe.width - SPACE.s * 2, confirm ? 360 : wide ? 600 : 360);
    const extraRows = (settingsRowCount(info) - 2) * SETTINGS_ROW;
    const panelH = confirm ? 280 : wide ? Math.min(safe.height - SPACE.s * 2, 300 + extraRows / 2) : 470 + extraRows;
    const modal = new KitModal(this.scene, screen.width, screen.height, {
      skin: SKIN,
      width: panelW,
      height: panelH,
      title: t(this.view === 'confirmRestart' ? 'confirm.restart.title' : this.view === 'confirmLeave' ? 'confirm.leave.title' : 'pause.title'),
    });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_PAUSE);
    const panel = modal.panel;
    if (confirm) this.buildConfirm(panel, panelW, panelH);
    else if (wide) this.buildWide(panel, info, panelW);
    else this.buildTall(panel, info, panelW);
    if (!confirm) {
      panel.add(new KitIconButton(this.scene, panelW / 2 - 30, -panelH / 2 + 30, { skin: SKIN, icon: 'close', onPress: () => this.resume() }));
    }
    this.modal = modal;
    if (animate) modal.popIn();
  }

  private resume(): void {
    this.close();
    this.handlers.onResume();
  }

  /** The level's number (and badge, if special) under the title. */
  private levelPill(info: PauseInfo): KitPill {
    return new KitPill(this.scene, 0, 0, {
      skin: SKIN,
      label: t('hud.levelLabel'),
      value: String(info.levelNumber),
      height: 36,
      ...(info.special ? { icon: 'starFilled' as const, tint: SKIN.text.accent } : {}),
    });
  }

  private actions(width: number): KitButton[] {
    const info = this.info!;
    const button = (variant: 'primary' | 'secondary', label: MessageKey, icon: UiIconName, onPress: () => void) =>
      new KitButton(this.scene, 0, 0, { skin: SKIN, variant, label: t(label), icon, width, onPress });
    return [
      button('primary', 'pause.resume', 'play', () => this.resume()),
      button('secondary', 'pause.restart', 'restart', () => {
        if (info.started) this.show('confirmRestart');
        else this.leave(() => this.handlers.onRestart());
      }),
      button('secondary', 'pause.home', 'home', () => {
        if (info.started) this.show('confirmLeave');
        else this.leave(() => this.handlers.onHome());
      }),
    ];
  }

  private leave(then: () => void): void {
    this.close();
    then();
  }

  private settings(panel: KitPanel, x: number, top: number, width: number): void {
    const info = this.info!;
    settingsRows(this.scene, panel, x, top, width, info, {
      onSound: (on) => {
        this.info = { ...this.info!, soundOn: on };
        this.handlers.onSound(on);
      },
      onColorBlind: (on) => {
        this.info = { ...this.info!, colorBlind: on };
        this.handlers.onColorBlind(on);
      },
      onVibration: (on) => {
        this.info = { ...this.info!, vibration: on };
        this.handlers.onVibration(on);
      },
      onReduceMotion: (on) => {
        this.info = { ...this.info!, reduceMotion: on };
        this.handlers.onReduceMotion(on);
      },
    });
  }

  /** Portrait: everything in one column. */
  private buildTall(panel: KitPanel, info: PauseInfo, w: number): void {
    const inner = w - SPACE.l * 2;
    let y = panel.contentTop + 18;
    panel.add(this.levelPill(info).setY(y));
    y += 18 + SPACE.m + 28;
    for (const button of this.actions(inner)) {
      panel.add(button.setY(y));
      y += button.height + SPACE.xs;
    }
    y += SPACE.s;
    this.settings(panel, -inner / 2, y + 4, inner);
  }

  /** Landscape: actions on the left, settings on the right. */
  private buildWide(panel: KitPanel, info: PauseInfo, w: number): void {
    const col = (w - SPACE.l * 2 - SPACE.m) / 2;
    const left = -w / 2 + SPACE.l;
    const right = left + col + SPACE.m;
    let y = panel.contentTop + 28;
    for (const button of this.actions(col)) {
      panel.add(button.setPosition(left + col / 2, y));
      y += button.height + SPACE.xs;
    }
    panel.add(this.levelPill(info).setPosition(right + col / 2, panel.contentTop + 18));
    this.settings(panel, right, panel.contentTop + 18 + 18 + SPACE.m + 10, col);
  }

  private buildConfirm(panel: KitPanel, w: number, h: number): void {
    const inner = w - SPACE.l * 2;
    const body = kitText(this.scene, 'body', t('confirm.body'), SKIN.text.secondary).setY(panel.contentTop + 16);
    body.setWordWrapWidth(inner);
    panel.add(body);
    const restart = this.view === 'confirmRestart';
    const yes = new KitButton(this.scene, 0, h / 2 - SPACE.m - 28 - 56 - SPACE.xs, {
      skin: SKIN,
      variant: 'danger',
      label: t(restart ? 'confirm.restart' : 'confirm.leave'),
      icon: restart ? 'restart' : 'home',
      width: inner,
      onPress: () => this.leave(() => (restart ? this.handlers.onRestart() : this.handlers.onHome())),
    });
    const no = new KitButton(this.scene, 0, h / 2 - SPACE.m - 24, {
      skin: SKIN,
      variant: 'secondary',
      label: t('confirm.cancel'),
      width: inner,
      onPress: () => this.show('menu'),
    });
    panel.add([yes, no]);
  }
}
