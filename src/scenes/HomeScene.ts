import * as Phaser from 'phaser';
import { t } from '../i18n';
import type { HapticsService } from '../services/HapticsService';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { MAP } from '../ui/art/map';
import { DURATION, EASE, FONTS, hexNumber, SKIN, SPACE } from '../ui/design/tokens';
import { computeMapLayout, revealedLevels, revealedTop, type MapLayout } from '../ui/mapLayout';
import { KitButton, KitIconButton, KitModal, KitPill, uiIconKey } from './kit';
import { ArrivalSequence, type Arrival, type ArrivalStage } from './map/arrival';
import { MapView, type MapLevelState } from './map/MapView';
import { playList } from './playList';
import { settingsRowCount, settingsRows, SETTINGS_ROW } from './SettingsRows';
import { fadeIn, fadeToScene } from './transitions';
import { fitCamera, pointerAt, screenRect, viewSize } from './view';

/** What the home screen is opened with. */
export interface HomeData {
  /** Set after a win: the short sequence that shows the stars earned and the way on. */
  readonly arrival?: Arrival;
}

const TAP_SLOP = 10;
const DEPTH_BAR = 50;
const DEPTH_MODAL = 300;

/**
 * The home screen: the level map with a top bar (the title, the total of stars and settings) and a big
 * "Play · Level N" button. Tapping a level on the map plays it (completed ones can be replayed). After a win it
 * plays the arrival sequence: the stars earned fly to the total and the player's pin walks to the next level.
 *
 * Room is kept for what comes next without showing empty buttons: the top bar's left holds the stars counter and
 * will take coins and the player's level beside it; its right holds settings and will take the inventory; the
 * sides of the play button will take the shop and chests (see BAR_SLOTS).
 */
export class HomeScene extends Phaser.Scene {
  private data_: HomeData = {};
  private layout!: MapLayout;
  private map!: MapView;
  private scroll = 0;
  private minScroll = 0;
  private maxScroll = 0;
  private press: { y: number; scroll: number; moved: boolean } | null = null;
  private bar!: Phaser.GameObjects.Container;
  private starsPill!: KitPill;
  private play!: KitButton;
  private settings: KitModal | null = null;
  private sequence: ArrivalSequence | null = null;
  private current = 0;

  constructor(
    private readonly sfx: SoundService,
    private readonly store: ProgressStore,
    private readonly haptics: HapticsService,
  ) {
    super('Home');
  }

  init(data: HomeData): void {
    this.data_ = data ?? {};
    this.press = null;
    this.settings = null;
    this.sequence = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MAP.seaBottom);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if (this.settings) return;
      if (this.sequence?.running) {
        this.skipArrival();
        return;
      }
      this.press = { y: pointerAt(pointer).y, scroll: this.scroll, moved: false };
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.press || !pointer.isDown) return;
      const dy = pointerAt(pointer).y - this.press.y;
      if (Math.abs(dy) > TAP_SLOP) this.press.moved = true;
      if (this.press.moved) this.setScroll(this.press.scroll - dy);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const press = this.press;
      this.press = null;
      if (!press || press.moved || this.settings) return;
      const at = pointerAt(pointer);
      const level = this.map.levelAt(at.x - this.map.container.x, at.y - this.map.container.y);
      if (level !== null) this.chooseLevel(level);
    });
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.build, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.build, this));

    this.build();
    fadeIn(this);
    const arrival = this.data_.arrival;
    if (arrival) {
      this.data_ = {};
      void this.runArrival(arrival);
    }
  }

  private ids(): string[] {
    return playList.map((entry) => entry.level.id);
  }

  /** The level to play next: the first not completed, or the last one once everything is done. */
  private nextLevel(): number {
    return this.store.firstIncomplete(this.ids()) ?? playList.length - 1;
  }

  /** Draws the whole screen for the current size and progress. */
  private build(): void {
    this.children.removeAll(true);
    fitCamera(this);
    const { width, height } = viewSize(this);
    const screen = screenRect(this);
    const ids = this.ids();
    const first = this.store.firstIncomplete(ids);
    this.current = this.nextLevel();
    const revealed = revealedLevels(playList.length, first);
    const levels: MapLevelState[] = playList.map((entry, i) => ({
      number: entry.number,
      theme: entry.level.theme,
      unlocked: this.store.isUnlocked(ids, i),
      stars: this.store.bestStars(entry.level.id) ?? 0,
      revealed: i < revealed,
    }));

    // The sea behind everything, fixed to the screen.
    const sea = this.add.graphics();
    const [top, bottom] = [hexNumber(MAP.seaTop), hexNumber(MAP.seaBottom)];
    sea.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(screen.x, screen.y, screen.width, screen.height);

    this.layout = computeMapLayout(playList.map((entry) => entry.level), width);
    this.map = new MapView(this, this.layout, levels, (width - this.layout.width) / 2);
    this.map.highlight(this.current);
    this.map.placeMarker(this.data_.arrival?.level ?? this.current);

    // The map scrolls between the clouds at its top and its bottom edge, keeping clear of the bar and button.
    const barH = this.barHeight();
    const footer = 64 + SPACE.l;
    this.maxScroll = this.layout.height - (height - footer);
    this.minScroll = Math.min(this.maxScroll, revealedTop(this.layout, revealed) - barH);
    this.scroll = this.scrollToShow(this.data_.arrival?.level ?? this.current);
    this.setScroll(this.scroll);

    this.buildBar(width);
    this.buildPlay(width, height);
  }

  private barHeight(): number {
    return 112;
  }

  /** Scroll that brings a level's plaque a little below the middle of the screen. */
  private scrollToShow(level: number): number {
    const { height } = viewSize(this);
    return this.map.nodeAt(level).y - height * 0.55;
  }

  private setScroll(scroll: number): void {
    this.scroll = Math.max(this.minScroll, Math.min(this.maxScroll, scroll));
    this.map.container.setY(-this.scroll);
  }

  /**
   * The top bar: the title on a wooden sign, the stars counter on the left and settings on the right.
   * BAR_SLOTS: the left will also hold coins and the player's level, the right the inventory.
   */
  private buildBar(width: number): void {
    const screen = screenRect(this);
    this.bar = this.add.container(0, 0).setDepth(DEPTH_BAR);
    const g = this.add.graphics();
    // A soft shade under the bar so it reads over the sea.
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0, 0).fillRect(screen.x, screen.y, screen.width, -screen.y + this.barHeight());
    this.bar.add(g);
    const row = 32;
    this.starsPill = new KitPill(this, 0, row, { skin: SKIN, icon: 'starFilled', value: String(this.store.totalStars), tint: SKIN.star.filled, height: 40, width: 104 });
    this.starsPill.setX(SPACE.s + 52);
    const gear = new KitIconButton(this, width - SPACE.s - 22, row, { skin: SKIN, icon: 'settings', onPress: () => this.openSettings() });
    const title = this.add
      .text(width / 2, 78, t('game.title'), { fontFamily: FONTS.display, fontStyle: '600', fontSize: '34px', color: SKIN.text.primary })
      .setOrigin(0.5)
      .setStroke(SKIN.surface.border, 7)
      .setShadow(0, 4, '#000000', 0.35, true, true);
    if (title.width > width - SPACE.l * 2) title.setScale((width - SPACE.l * 2) / title.width);
    this.bar.add([this.starsPill, gear, title]);
  }

  /** The big button at the bottom: play the next level. */
  private buildPlay(width: number, height: number): void {
    const number = playList[this.current]!.number;
    this.play = new KitButton(this, width / 2, height - SPACE.m - 34, {
      skin: SKIN,
      variant: 'primary',
      label: t('home.play', { n: number }),
      icon: 'play',
      width: Math.min(320, width - SPACE.l * 2),
      height: 64,
      onPress: () => this.chooseLevel(this.current),
    }).setDepth(DEPTH_BAR);
  }

  private chooseLevel(level: number): void {
    if (this.sequence?.running) return;
    if (!this.store.isUnlocked(this.ids(), level)) {
      this.sfx.play('invalid');
      this.map.shake(level);
      return;
    }
    this.sfx.play('pick');
    fadeToScene(this, 'Game', { levelIndex: level });
  }

  private openSettings(): void {
    if (this.settings) return;
    const screen = screenRect(this);
    const safe = viewSize(this);
    const state = {
      soundOn: !this.sfx.muted,
      colorBlind: this.store.colorBlindMode,
      vibration: this.store.vibration,
      canVibrate: this.haptics.supported,
    };
    const rows = settingsRowCount(state);
    const w = Math.min(safe.width - SPACE.s * 2, 360);
    const h = 120 + rows * SETTINGS_ROW;
    const modal = new KitModal(this, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: t('settings.title') });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_MODAL);
    const inner = w - SPACE.l * 2;
    settingsRows(this, modal.panel, -inner / 2, modal.panel.contentTop + 18, inner, state, {
      onSound: (on) => {
        this.sfx.setMuted(!on);
        this.store.setMuted(!on);
      },
      onColorBlind: (on) => this.store.setColorBlindMode(on),
      onVibration: (on) => {
        this.haptics.setEnabled(on);
        this.store.setVibration(on);
      },
    });
    modal.panel.add(
      new KitIconButton(this, w / 2 - 30, -h / 2 + 30, {
        skin: SKIN,
        icon: 'close',
        onPress: () => {
          modal.dismiss();
          this.settings = null;
        },
      }),
    );
    modal.popIn();
    this.settings = modal;
  }

  // ---------------------------------------------------------------- arrival after a win

  private async runArrival(arrival: Arrival): Promise<void> {
    this.starsPill.setValue(String(arrival.totalBefore));
    const stage: ArrivalStage = {
      scene: this,
      arrival,
      nodeOnScreen: (level) => {
        const at = this.map.nodeAt(level);
        return { x: at.x + this.map.container.x, y: at.y + this.map.container.y };
      },
      spawnStar: (x, y) => this.add.image(x, y, uiIconKey('starFilled', SKIN.star.filled)).setDepth(DEPTH_MODAL + 10),
      starsCounter: () => ({ x: this.starsPill.x - 30, y: this.starsPill.y }),
      showTotal: (total, bump) => {
        this.starsPill.setValue(String(total));
        if (bump) {
          this.tweens.killTweensOf(this.starsPill);
          this.starsPill.setScale(1);
          this.tweens.add({ targets: this.starsPill, scale: 1.2, duration: DURATION.press, yoyo: true, ease: EASE.enter });
        }
      },
      moveMarker: (from, to, instant) => {
        if (instant) {
          this.map.jumpMarker(to);
          this.setScroll(this.scrollToShow(to));
          return Promise.resolve();
        }
        // The map follows the pin a little, so the next level comes into view.
        this.tweens.add({ targets: this, scroll: this.scrollToShow(to), duration: DURATION.slow * 2, ease: 'Sine.easeInOut', onUpdate: () => this.setScroll(this.scroll) });
        return this.map.moveMarker(from, to, () => this.sfx.play('mapStep'));
      },
      callToPlay: () => this.callToPlay(),
      play: (effect) => this.sfx.play(effect),
    };
    this.sequence = new ArrivalSequence(stage);
    await this.sequence.run();
  }

  /** A tap during the sequence skips it: everything jumps to its end state. */
  private skipArrival(): void {
    const sequence = this.sequence;
    if (!sequence) return;
    this.tweens.killAll();
    sequence.skip();
    // Restore the idle animations the skip stopped.
    this.map.highlight(this.current);
    this.map.jumpMarker(this.current);
  }

  /** The play button breathes, so the next tap is obvious. */
  private callToPlay(): void {
    this.tweens.killTweensOf(this.play);
    this.play.setScale(1);
    this.tweens.add({ targets: this.play, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: EASE.loop });
  }
}
