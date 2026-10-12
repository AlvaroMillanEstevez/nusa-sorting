import * as Phaser from 'phaser';
import { chestProgress, playerLevel, playerTitle } from '../core/economy';
import { ECONOMY, type Reward } from '../data/economy';
import { getLocale, t } from '../i18n';
import type { HapticsService } from '../services/HapticsService';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import { MAP } from '../ui/art/map';
import type { UiIconName } from '../ui/design/uiIcons';
import { DURATION, EASE, FONTS, hexNumber, SKIN, SPACE, TILE } from '../ui/design/tokens';
import { formatScore } from '../ui/format';
import { computeMapLayout, revealedLevels, revealedTop, type MapLayout } from '../ui/mapLayout';
import { KitBoosterButton, KitButton, KitIconButton, KitModal, KitPanel, KitPill, kitText, reducedMotion, setReducedMotion, uiIcon, uiIconKey } from './kit';
import { ArrivalSequence, chestStarsBefore, coinsBefore, type Arrival, type ArrivalStage, type RewardCard } from './map/arrival';
import { wantsChest, wantsCoinsHelp, wantsShop } from '../dev/uiParams';
import { boosterTextureKey } from './boosterTextures';
import { Effects } from './Effects';
import { openShop } from './Shop';
import { prepareLevelTextures } from './itemTextures';
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
/** The shop and chest buttons beside the play button. */
const SIDE_BUTTON = 56;
/** The row over the play button: the stars towards the next chest, over its button. */
const FOOTER_ROW = 30;
/** The glints around a chest ready to open: offsets as shares of the button's size, and radius in px. */
const CHEST_GLINTS: readonly (readonly [number, number, number])[] = [
  [-0.56, -0.48, 9],
  [0.46, -0.52, 13],
  [0.6, 0.26, 8],
];

/** A four-pointed golden glint. */
function glint(scene: Phaser.Scene, r: number): Phaser.GameObjects.Graphics {
  const k = r * 0.3;
  const points = [
    [0, -r],
    [k, -k],
    [r, 0],
    [k, k],
    [0, r],
    [-k, k],
    [-r, 0],
    [-k, -k],
  ].map(([x, y]) => new Phaser.Math.Vector2(x, y));
  const g = scene.add.graphics();
  g.fillStyle(hexNumber(SKIN.status.combo), 0.45).fillCircle(0, 0, r * 0.7);
  g.fillStyle(hexNumber(TILE.glint), 1).fillPoints(points, true);
  g.lineStyle(1.5, hexNumber(TILE.rim), 1).strokePoints(points, true);
  return g;
}

/**
 * The home screen: the level map with a top bar (the player's level and its bar, coins, the total of stars and
 * settings, over the title) and a big "Play · Level N" button between the shop and the star chest, with the
 * stars towards the next chest over it (the boosters owned are shown in the shop and in the game's bar). Tapping
 * a level on the map plays it (completed ones can be replayed). Once the chest has the stars for one it glows
 * and golden glints twinkle around it, and it opens when tapped.
 * After a win it plays the arrival sequence: the stars earned fly to the total and count up on the chest, coins
 * fly to theirs, the experience bar fills, new player levels show their gifts, and the player's pin walks to the
 * next level.
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
  private titleCaption!: Phaser.GameObjects.Text;
  private titleWidth = 0;
  private coinsPill!: KitPill;
  private levelPill!: KitPill;
  private play!: KitButton;
  /** The settings, the shop or the chest's info, while open. */
  private modal: KitModal | null = null;
  /** The experience the level pill shows (it fills up during the arrival). */
  private shownXp = 0;
  private card: KitPanel | null = null;
  private chestPill!: KitPill;
  private chestGlow!: Phaser.GameObjects.Graphics;
  private chestGlints: Phaser.GameObjects.Graphics[] = [];
  private toastLabel: KitPill | null = null;
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
    this.modal = null;
    this.sequence = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MAP.seaBottom);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if (this.modal) return;
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
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const press = this.press;
      this.press = null;
      // Not when the tap was on a button or counter over the map.
      if (!press || press.moved || this.modal || over.length > 0) return;
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
    } else if (import.meta.env.DEV && wantsShop(window.location.search)) {
      this.openShop();
    } else if (import.meta.env.DEV && wantsChest(window.location.search)) {
      this.pressChest();
    } else if (import.meta.env.DEV && wantsCoinsHelp(window.location.search)) {
      this.openCoinsHelp();
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
    const footer = 64 + SPACE.l + FOOTER_ROW + SPACE.s;
    this.maxScroll = this.layout.height - (height - footer);
    this.minScroll = Math.min(this.maxScroll, revealedTop(this.layout, revealed) - barH);
    this.scroll = this.scrollToShow(this.data_.arrival?.level ?? this.current);
    this.setScroll(this.scroll);

    this.buildBar(width);
    this.buildFooter(width, height);
  }

  /** The number of the furthest level the player can play (boosters unlocked by then are in the shop). */
  private reachedLevel(): number {
    return playList[this.nextLevel()]!.number;
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
   * The top bar: the player's level (with its experience bar), coins and stars on the left, settings on the
   * right, and the title on a wooden sign below. Tapping the coins explains how to get them.
   */
  private buildBar(width: number): void {
    const screen = screenRect(this);
    this.bar = this.add.container(0, 0).setDepth(DEPTH_BAR);
    const g = this.add.graphics();
    // A soft shade under the bar so it reads over the sea.
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0, 0).fillRect(screen.x, screen.y, screen.width, -screen.y + this.barHeight());
    this.bar.add(g);
    const row = 32;
    // The three counters share the room left of the settings button, narrower on a small phone.
    const room = width - SPACE.s * 2 - 44 - SPACE.xs * 3;
    const k = Math.min(1, room / (104 + 104 + 84));
    const [lw, cw, sw] = [104, 104, 84].map((w) => Math.round(w * k)) as [number, number, number];
    this.levelPill = new KitPill(this, SPACE.s + lw / 2, row, { skin: SKIN, icon: 'trophy', value: '', height: 40, width: lw });
    this.coinsPill = new KitPill(this, SPACE.s + lw + SPACE.xs + cw / 2, row, { skin: SKIN, icon: 'coin', value: '', tint: SKIN.text.accent, height: 40, width: cw });
    this.coinsPill.setSize(cw, 44).setInteractive().on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.openCoinsHelp());
    this.starsPill = new KitPill(this, SPACE.s + lw + cw + SPACE.xs * 2 + sw / 2, row, { skin: SKIN, icon: 'starFilled', value: String(this.store.totalStars), tint: SKIN.star.filled, height: 40, width: sw });
    // The player's title, under their level.
    this.titleCaption = kitText(this, 'caption', '', SKIN.text.primary).setStroke(SKIN.surface.border, 4).setPosition(SPACE.s + lw / 2, row + 28);
    this.titleWidth = lw + SPACE.xs * 2;
    this.showCoins(this.store.wallet.coins);
    this.showXp(this.store.wallet.xp);
    const gear = new KitIconButton(this, width - SPACE.s - 22, row, { skin: SKIN, icon: 'settings', onPress: () => this.openSettings() });
    const title = this.add
      .text(width / 2, 86, t('game.title'), { fontFamily: FONTS.display, fontStyle: '600', fontSize: '34px', color: SKIN.text.primary })
      .setOrigin(0.5)
      .setStroke(SKIN.surface.border, 7)
      .setShadow(0, 4, '#000000', 0.35, true, true);
    if (title.width > width - SPACE.l * 2) title.setScale((width - SPACE.l * 2) / title.width);
    this.bar.add([this.levelPill, this.titleCaption, this.coinsPill, this.starsPill, gear, title]);
  }

  private showCoins(coins: number): void {
    this.coinsPill.setValue(formatScore(coins, getLocale()));
  }

  /** The player's level for an amount of experience, with the share of the way to the next as the pill's bar. */
  private showXp(xp: number): void {
    this.shownXp = xp;
    const { level, into, needed } = playerLevel(xp);
    this.levelPill.setValue(t('home.playerLevel', { n: level })).setProgress(into / needed);
    const title = t(`playerTitle.${playerTitle(level)}`);
    if (this.titleCaption.text !== title) {
      this.titleCaption.setText(title).setScale(1);
      if (this.titleCaption.width > this.titleWidth) this.titleCaption.setScale(this.titleWidth / this.titleCaption.width);
    }
  }

  private bump(target: Phaser.GameObjects.Container): void {
    this.tweens.killTweensOf(target);
    target.setScale(1);
    this.tweens.add({ targets: target, scale: 1.2, duration: DURATION.press, yoyo: true, ease: EASE.enter });
  }

  /**
   * The bottom: the big play button between the shop and the star chest, and over the chest the stars collected
   * towards it.
   */
  private buildFooter(width: number, height: number): void {
    const number = playList[this.current]!.number;
    const y = height - SPACE.m - 34;
    const playW = Math.min(280, width - (SPACE.s * 2 + SIDE_BUTTON) * 2);
    this.play = new KitButton(this, width / 2, y, {
      skin: SKIN,
      variant: 'primary',
      label: t('home.play', { n: number }),
      icon: 'play',
      width: playW,
      height: 64,
      onPress: () => this.chooseLevel(this.current),
    }).setDepth(DEPTH_BAR);
    const side = playW / 2 + SPACE.s + SIDE_BUTTON / 2;
    new KitIconButton(this, width / 2 - side, y, { skin: SKIN, icon: 'shop', look: 'secondary', size: SIDE_BUTTON, onPress: () => this.openShop() }).setDepth(DEPTH_BAR);
    const chestX = width / 2 + side;
    // Once it can be opened the chest glows warmly and golden glints twinkle around it, like a gift waiting.
    this.chestGlow = this.add.graphics().setPosition(chestX, y).setDepth(DEPTH_BAR - 1).setVisible(false);
    for (let i = 10; i >= 1; i--) this.chestGlow.fillStyle(hexNumber(TILE.glow), 0.08).fillCircle(0, 0, SIDE_BUTTON * (0.5 + i * 0.05));
    new KitIconButton(this, chestX, y, { skin: SKIN, icon: 'chest', look: 'secondary', size: SIDE_BUTTON, onPress: () => this.pressChest() }).setDepth(DEPTH_BAR);
    this.chestGlints = CHEST_GLINTS.map(([dx, dy, r]) => glint(this, r).setPosition(chestX + dx * SIDE_BUTTON, y + dy * SIDE_BUTTON).setDepth(DEPTH_BAR + 1).setVisible(false));

    const rowY = y - 32 - SPACE.s - FOOTER_ROW / 2;
    // Stars towards the next chest, over its button (it can pass the target: 17/15).
    const chestW = 76;
    this.chestPill = new KitPill(this, chestX, rowY, { skin: SKIN, icon: 'starFilled', value: '', tint: SKIN.star.filled, height: FOOTER_ROW, width: chestW }).setDepth(DEPTH_BAR);
    this.showChestStars(this.store.wallet.chestStars);
  }

  private openShop(): void {
    if (this.modal || this.sequence?.running) return;
    this.modal = openShop(
      this,
      this.store,
      this.sfx,
      this.reachedLevel(),
      () => this.showCoins(this.store.wallet.coins),
      () => {
        this.modal = null;
        // The boosters' counts over the play button.
        this.build();
      },
    );
  }

  // ---------------------------------------------------------------- star chests

  /** The stars towards the next chest, and whether it is lit up to be opened. */
  private showChestStars(stars: number): void {
    const { every } = chestProgress(this.store.wallet);
    this.chestPill.setValue(`${stars}/${every}`).setProgress(Math.min(1, stars / every));
    const ready = stars >= every;
    if (ready === this.chestGlow.visible) return;
    this.chestGlow.setVisible(ready).setAlpha(1).setScale(1);
    this.tweens.killTweensOf([this.chestGlow, ...this.chestGlints]);
    this.chestGlints.forEach((g) => g.setVisible(ready).setAlpha(1).setScale(1));
    // The glow breathes and the glints twinkle in turn, asking to be tapped; with reduce motion they stay still.
    if (!ready || reducedMotion()) return;
    this.tweens.add({ targets: this.chestGlow, scale: 1.12, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: EASE.loop });
    this.chestGlints.forEach((g, i) =>
      this.tweens.add({ targets: g, scale: 0.35, alpha: 0.3, angle: 45, duration: 520, delay: i * 330, yoyo: true, repeat: -1, repeatDelay: 380, ease: EASE.loop }),
    );
  }

  /** The chest: opens when it has the stars for it, else says more are needed. */
  private pressChest(): void {
    if (this.modal || this.sequence?.running) return;
    if (!chestProgress(this.store.wallet).ready) {
      this.sfx.play('invalid');
      this.toast(t('chest.needMore'), this.chestPill);
      return;
    }
    const opened = this.store.openChest(this.reachedLevel());
    if (opened) this.showChestReward(opened.rewards);
  }

  /** A short notice over a counter, gone after a moment. */
  private toast(text: string, near: Phaser.GameObjects.Container): void {
    this.toastLabel?.destroy();
    const { width } = viewSize(this);
    const label = new KitPill(this, 0, near.y - FOOTER_ROW - SPACE.xs, { skin: SKIN, value: text, height: 36 }).setDepth(DEPTH_MODAL - 1);
    const half = label.pillWidth / 2 + SPACE.s;
    label.setX(Math.max(half, Math.min(width - half, near.x)));
    this.toastLabel = label;
    label.setAlpha(0);
    this.tweens.chain({
      targets: label,
      tweens: [
        { alpha: 1, duration: DURATION.base, ease: EASE.enter },
        { alpha: 0, delay: 1400, duration: DURATION.base, ease: EASE.exit },
      ],
      onComplete: () => {
        label.destroy();
        if (this.toastLabel === label) this.toastLabel = null;
      },
    });
  }

  /**
   * What the chest held, in two moments. First the celebration: the chest shakes and pops open with confetti
   * (still, with reduce motion). Then, always, what it gave: a row per reward with its colour icon and the exact
   * amount ("+65 coins", "+1 Shuffle"), and only then the button to collect it. Closing refreshes the home screen
   * (coins, and the chest, which stays lit if there are stars for another).
   */
  private showChestReward(rewards: readonly Reward[]): void {
    const screen = screenRect(this);
    const safe = viewSize(this);
    const w = Math.min(safe.width - SPACE.s * 2, 340);
    const rowH = 56;
    const h = Math.min(safe.height - SPACE.s * 2, 252 + rewards.length * rowH);
    const modal = new KitModal(this, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: t('chest.congrats') });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_MODAL);
    this.modal = modal;
    const panel = modal.panel;
    const top = panel.contentTop;
    const still = reducedMotion();
    const chest = uiIcon(this, 'chest', SKIN.text.accent, 56).setY(top + 32);
    panel.add(chest);

    // What it gave, hidden until the celebration is over.
    const reveal = this.add.container(0, 0).setVisible(false);
    reveal.add(kitText(this, 'label', t('chest.youGot').toUpperCase(), SKIN.text.secondary).setY(top + 76));
    rewards.forEach((reward, i) => reveal.add(this.rewardRow(reward).setY(top + 108 + i * rowH)));
    const collect = new KitButton(this, 0, h / 2 - SPACE.m - 28, {
      skin: SKIN,
      variant: 'primary',
      label: t('chest.collect'),
      width: w - SPACE.l * 2,
      height: 56,
      onPress: () => {
        modal.dismiss();
        this.modal = null;
        this.build();
      },
    });
    reveal.add(collect);
    panel.add(reveal);
    modal.popIn();
    this.sfx.play('unlock');

    // The celebration: a shake and a pop with confetti.
    if (!still) this.tweens.add({ targets: chest, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 3, delay: DURATION.slow, onComplete: () => chest.setAngle(0) });
    const celebrateAt = still ? DURATION.slow : DURATION.slow + 4 * 140;
    this.time.delayedCall(celebrateAt, () => {
      if (!modal.scene) return;
      this.sfx.play('star3');
      if (!still) {
        this.tweens.add({ targets: chest, scale: 1.25, duration: DURATION.base, ease: EASE.pop, yoyo: true });
        new Effects(this, DEPTH_MODAL + 20).celebrate(screen.width + 2 * screen.x, safe.height);
      }
    });
    // Then what it gave, whatever happened to the animations before.
    this.time.delayedCall(celebrateAt + (still ? 0 : 420), () => {
      if (!modal.scene) return;
      reveal.setVisible(true).setAlpha(still ? 1 : 0);
      if (!still) this.tweens.add({ targets: reveal, alpha: 1, duration: DURATION.base, ease: EASE.enter });
    });
  }

  /** A reward as a row: its colour icon (a coin, a booster's tile) and "+N coins" or "+N Shuffle". */
  private rewardRow(reward: Reward): Phaser.GameObjects.Container {
    const label =
      reward.kind === 'coins'
        ? t('chest.coins', { n: formatScore(reward.amount, getLocale()) })
        : t('chest.booster', { n: reward.amount, name: t(`booster.${reward.booster}.name`) });
    const text = kitText(this, 'number', label, SKIN.text.primary).setOrigin(0, 0.5);
    const iconSize = 44;
    const icon =
      reward.kind === 'coins'
        ? uiIcon(this, 'coin', SKIN.text.accent, 36)
        : new KitBoosterButton(this, 0, 0, { texture: boosterTextureKey(reward.booster), size: iconSize, state: 'ready', count: 0, badge: false });
    const width = iconSize + SPACE.s + text.width;
    icon.setX(-width / 2 + iconSize / 2);
    text.setX(-width / 2 + iconSize + SPACE.s);
    return this.add.container(0, 0, [icon, text]);
  }

  private chooseLevel(level: number): void {
    if (this.sequence?.running) return;
    if (!this.store.isUnlocked(this.ids(), level)) {
      this.sfx.play('invalid');
      this.map.shake(level);
      return;
    }
    this.sfx.play('pick');
    // Its icons are usually ready (drawn in the background since the game opened); if not, a moment's wait.
    void prepareLevelTextures(this, level).then(() => fadeToScene(this, 'Game', { levelIndex: level }));
  }

  /**
   * How to get coins: a short modal with one row per source (winning levels, more the first time; stars; player
   * levels; star chests), each with its icon, and a button on to the shop.
   */
  private openCoinsHelp(): void {
    if (this.modal || this.sequence?.running) return;
    const screen = screenRect(this);
    const safe = viewSize(this);
    const w = Math.min(safe.width - SPACE.s * 2, 360);
    const h = Math.min(safe.height - SPACE.s * 2, 456);
    const modal = new KitModal(this, screen.width, screen.height, { skin: SKIN, width: w, height: h, title: t('coinsHelp.title') });
    modal.setPosition(screen.x, screen.y).setDepth(DEPTH_MODAL);
    const panel = modal.panel;
    const close = () => {
      modal.dismiss();
      this.modal = null;
    };
    const rows: readonly { icon: UiIconName; color: string; title: string; note: string }[] = [
      { icon: 'check', color: SKIN.text.accent, title: t('coinsHelp.levels'), note: t('coinsHelp.levelsNote') },
      { icon: 'starFilled', color: SKIN.star.filled, title: t('coinsHelp.stars'), note: t('coinsHelp.starsNote') },
      { icon: 'trophy', color: SKIN.text.accent, title: t('coinsHelp.levelUp'), note: t('coinsHelp.levelUpNote') },
      { icon: 'chest', color: SKIN.text.accent, title: t('coinsHelp.chests'), note: t('coinsHelp.chestsNote', { n: ECONOMY.chests.everyStars }) },
    ];
    const buttonY = h / 2 - SPACE.m - 28;
    const top = panel.contentTop + SPACE.xs;
    // Rows share the room between the title and the button, up to 64 px each (they tighten on a short screen).
    const rowH = Math.min(64, (buttonY - 28 - SPACE.s - top) / rows.length);
    const iconSize = 36;
    const inner = w - SPACE.l * 2;
    const textX = -inner / 2 + iconSize + SPACE.s;
    rows.forEach((row, i) => {
      const y = top + rowH * (i + 0.5);
      panel.add(uiIcon(this, row.icon, row.color, iconSize).setPosition(-inner / 2 + iconSize / 2, y));
      const title = kitText(this, 'button', row.title, SKIN.text.primary, 18).setOrigin(0, 1).setPosition(textX, y + 1);
      const note = kitText(this, 'body', row.note, SKIN.text.secondary, 14).setOrigin(0, 0).setPosition(textX, y + 3);
      note.setAlign('left').setWordWrapWidth(inner / 2 - textX);
      panel.add([title, note]);
    });
    panel.add(
      new KitButton(this, 0, buttonY, {
        skin: SKIN,
        variant: 'primary',
        icon: 'shop',
        label: t('coinsHelp.toShop'),
        width: inner,
        height: 56,
        onPress: () => {
          close();
          this.openShop();
        },
      }),
    );
    panel.add(new KitIconButton(this, w / 2 - 30, -h / 2 + 30, { skin: SKIN, icon: 'close', onPress: close }));
    modal.popIn();
    this.modal = modal;
  }

  private openSettings(): void {
    if (this.modal) return;
    const screen = screenRect(this);
    const safe = viewSize(this);
    const state = {
      soundOn: !this.sfx.muted,
      colorBlind: this.store.colorBlindMode,
      vibration: this.store.vibration,
      canVibrate: this.haptics.supported,
      reduceMotion: this.store.reduceMotion,
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
      onReduceMotion: (on) => {
        this.store.setReduceMotion(on);
        setReducedMotion(on);
      },
    });
    modal.panel.add(
      new KitIconButton(this, w / 2 - 30, -h / 2 + 30, {
        skin: SKIN,
        icon: 'close',
        onPress: () => {
          modal.dismiss();
          this.modal = null;
        },
      }),
    );
    modal.popIn();
    this.modal = modal;
  }

  // ---------------------------------------------------------------- arrival after a win

  private async runArrival(arrival: Arrival): Promise<void> {
    this.starsPill.setValue(String(arrival.totalBefore));
    const rewards = arrival.rewards;
    if (rewards) {
      this.showCoins(coinsBefore(rewards));
      this.showXp(rewards.wallet.xp - rewards.xp);
      this.showChestStars(chestStarsBefore(rewards));
    }
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
      spawnCoin: (x, y) => this.add.image(x, y, uiIconKey('coin', SKIN.text.accent)).setDepth(DEPTH_MODAL + 10),
      coinsCounter: () => ({ x: this.coinsPill.x - 30, y: this.coinsPill.y }),
      showCoins: (coins, bump) => {
        this.showCoins(coins);
        if (bump) this.bump(this.coinsPill);
      },
      showXp: (xp, instant) => {
        if (instant || reducedMotion()) {
          this.showXp(xp);
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const counter = { xp: this.shownXp };
          const before = playerLevel(this.shownXp).level;
          this.tweens.add({
            targets: counter,
            xp,
            duration: DURATION.slow * 3,
            ease: 'Sine.easeInOut',
            onUpdate: () => this.showXp(Math.round(counter.xp)),
            onComplete: () => {
              this.showXp(xp);
              if (playerLevel(xp).level > before) this.bump(this.levelPill);
              resolve();
            },
          });
        });
      },
      showChestStars: (stars, bump) => {
        this.showChestStars(stars);
        if (bump) this.bump(this.chestPill);
      },
      showCard: (card) => this.showCard(card),
      closeCards: () => {
        this.card?.destroy();
        this.card = null;
      },
      play: (effect) => this.sfx.play(effect),
    };
    this.sequence = new ArrivalSequence(stage);
    await this.sequence.run();
  }

  /**
   * A reward card over the map for a moment: a new player level and its gift, or a star chest that shakes and
   * opens to show what it held.
   */
  private showCard(card: RewardCard): Promise<void> {
    const { width, height } = viewSize(this);
    const w = Math.min(300, width - SPACE.l * 2);
    // A new title comes with this level: said under it.
    const newTitle = playerTitle(card.level) !== playerTitle(card.level - 1);
    const extra = newTitle ? 26 : 0;
    const h = 220 + extra;
    const panel = new KitPanel(this, width / 2, height * 0.45, {
      skin: SKIN,
      width: w,
      height: h,
      title: t('levelUp.title'),
    }).setDepth(DEPTH_MODAL + 5);
    this.card = panel;
    const top = panel.contentTop;
    const subtitle = t('levelUp.reached', { n: card.level });
    panel.add(kitText(this, 'body', subtitle, SKIN.text.secondary).setY(top + 12));
    if (newTitle) {
      const line = kitText(this, 'body', t('levelUp.newTitle', { title: t(`playerTitle.${playerTitle(card.level)}`) }), SKIN.text.accent).setY(top + 36);
      if (line.width > w - SPACE.l * 2) line.setScale((w - SPACE.l * 2) / line.width);
      panel.add(line);
    }
    const icon = uiIcon(this, 'starFilled', SKIN.text.accent, 48).setY(top + 58 + extra);
    panel.add(icon);
    // What it gives: an icon and "+N" for each reward, side by side.
    const items = card.rewards.map((reward) => this.rewardChip(reward));
    const gap = SPACE.m;
    const total = items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1);
    let x = -total / 2;
    for (const item of items) {
      item.container.setPosition(x + item.width / 2, top + 112 + extra).setAlpha(0);
      x += item.width + gap;
      panel.add(item.container);
    }
    const still = reducedMotion();
    panel.setScale(still ? 1 : 0.86).setAlpha(0);
    // Separate steps rather than one chain of tweens: the gift is always shown, whatever happens to the pop.
    return new Promise((resolve) => {
      this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: DURATION.slow, ease: EASE.pop });
      // A skip (closeCards) may have taken the card away meanwhile.
      this.time.delayedCall(DURATION.slow, () => {
        if (!panel.scene) return;
        for (const item of items) item.container.setAlpha(still ? 1 : 0);
        if (!still) this.tweens.add({ targets: items.map((item) => item.container), alpha: 1, duration: DURATION.base, ease: EASE.enter });
      });
      this.time.delayedCall(DURATION.slow + 1500, () => {
        if (!panel.scene) return resolve();
        this.tweens.add({
          targets: panel,
          alpha: 0,
          duration: DURATION.base,
          ease: EASE.exit,
          onComplete: () => {
            panel.destroy();
            if (this.card === panel) this.card = null;
            resolve();
          },
        });
      });
    });
  }

  /** A reward as an icon (a coin, a booster) and "+N". */
  private rewardChip(reward: Reward): { container: Phaser.GameObjects.Container; width: number } {
    // A booster shows its colour icon, as everywhere else.
    const size = reward.kind === 'coins' ? 32 : 44;
    const icon = reward.kind === 'coins' ? uiIcon(this, 'coin', SKIN.text.accent, size) : this.add.image(0, 0, boosterTextureKey(reward.booster)).setDisplaySize(size, size);
    const label = kitText(this, 'number', `+${formatScore(reward.amount, getLocale())}`, SKIN.text.primary).setOrigin(0, 0.5);
    const width = size + SPACE.xs + label.width;
    icon.setX(-width / 2 + size / 2);
    label.setX(-width / 2 + size + SPACE.xs);
    return { container: this.add.container(0, 0, [icon, label]), width };
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
    if (reducedMotion()) return;
    this.tweens.add({ targets: this.play, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: EASE.loop });
  }
}
