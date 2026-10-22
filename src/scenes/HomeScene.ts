import * as Phaser from 'phaser';
import { chestProgress, playerLevel, playerTitle } from '../core/economy';
import { ALBUM_SIZE, pagesToClaim } from '../core/album';
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
import { kitFeedback, KitBoosterButton, KitButton, KitIconButton, KitModal, KitPanel, KitPill, kitText, reducedMotion, setReducedMotion, uiIcon, uiIconKey } from './kit';
import { ArrivalSequence, chestStarsBefore, coinsBefore, type Arrival, type ArrivalStage, type RewardCard } from './map/arrival';
import { wantsBook, wantsChest, wantsCoinsHelp, wantsShop } from '../dev/uiParams';
import { BOOK_TEXTURE, boosterTextureKey } from './boosterTextures';
import { Effects } from './Effects';
import { openShop } from './Shop';
import { openBukuNenek } from './BukuNenek';
import { itemTextureKey, prepareAheadInBackground, prepareTypes } from './itemTextures';
import { prepareBoard } from './art/prepareBoard';
import { MapView, type MapLevelState } from './map/MapView';
import { playList } from './playList';
import { settingsRowCount, settingsRows, SETTINGS_ROW } from './SettingsRows';
import { fadeIn, fadeToScene } from './transitions';
import { fitCamera, pixelRatio, pointerAt, screenRect, viewSize } from './view';
import { MarketSign } from './map/MarketSign';
import { todaysPasaran } from './marketDay';

/** What the home screen is opened with. */
export interface HomeData {
  /** Set after a win: the short sequence that shows the stars earned and the way on. */
  readonly arrival?: Arrival;
}

const TAP_SLOP = 10;
/** Tutorial id: the market day's sign has explained pasaran once (it explains again when tapped). */
export const PASARAN_INTRO = 'pasaran-intro';
/** Where the top bar's content ends (the title), and the market day's sign starts. */
const BAR_CONTENT = 112;
const DEPTH_BAR = 50;
const DEPTH_MODAL = 300;
/** The shop and chest buttons beside the play button. */
const SIDE_BUTTON = 56;
/** The row over the play button: the stars towards the next chest, over its button. */
const FOOTER_ROW = 30;
/** The tab at the foot of Buku Nenek's button: found of all. */
const BOOK_TAB = 22;
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

/** A warm glow behind a button and golden glints round it: a gift waiting (the chest, a page in the book). */
interface GiftLight {
  readonly glow: Phaser.GameObjects.Graphics;
  readonly glints: Phaser.GameObjects.Graphics[];
}

function giftLight(scene: Phaser.Scene, x: number, y: number): GiftLight {
  const glow = scene.add.graphics().setPosition(x, y).setDepth(DEPTH_BAR - 1).setVisible(false);
  for (let i = 10; i >= 1; i--) glow.fillStyle(hexNumber(TILE.glow), 0.08).fillCircle(0, 0, SIDE_BUTTON * (0.5 + i * 0.05));
  const glints = CHEST_GLINTS.map(([dx, dy, r]) => glint(scene, r).setPosition(x + dx * SIDE_BUTTON, y + dy * SIDE_BUTTON).setDepth(DEPTH_BAR + 1).setVisible(false));
  return { glow, glints };
}

/** Lights a gift up or puts it out: the glow breathes and the glints twinkle in turn; still with reduce motion. */
function lightGift(scene: Phaser.Scene, light: GiftLight, lit: boolean): void {
  if (lit === light.glow.visible) return;
  light.glow.setVisible(lit).setAlpha(1).setScale(1);
  scene.tweens.killTweensOf([light.glow, ...light.glints]);
  light.glints.forEach((g) => g.setVisible(lit).setAlpha(1).setScale(1));
  if (!lit || reducedMotion()) return;
  scene.tweens.add({ targets: light.glow, scale: 1.12, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: EASE.loop });
  light.glints.forEach((g, i) =>
    scene.tweens.add({ targets: g, scale: 0.35, alpha: 0.3, angle: 45, duration: 520, delay: i * 330, yoyo: true, repeat: -1, repeatDelay: 380, ease: EASE.loop }),
  );
}

/**
 * A short, wide screen (a desktop window, laid out at 960×540, or a phone in landscape): Buku Nenek's button goes beside the shop
 * and the market sign up into the counters' row, so the map keeps room between the bar and the buttons.
 */
const isCompact = (width: number, height: number) => height < 600 && width >= 700;

/** The footer's rows, from the screen's height: the play row, and Buku Nenek's button's (over the shop, or beside it). */
const footerRows = (height: number, compact: boolean) => {
  const play = height - SPACE.m - 34;
  return { play, book: compact ? play : play - SIDE_BUTTON - SPACE.s - 6 };
};

/** The top bar's counters: their widths (narrower on a small phone) and where their row ends. */
const topRow = (width: number) => {
  // The three counters share the room left of the settings button.
  const room = width - SPACE.s * 2 - 44 - SPACE.xs * 3;
  const k = Math.min(1, room / (104 + 104 + 84));
  const [lw, cw, sw] = [104, 104, 84].map((w) => Math.round(w * k)) as [number, number, number];
  return { lw, cw, sw, end: SPACE.s + lw + cw + sw + SPACE.xs * 2 };
};

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
  private chestLight!: GiftLight;
  private shopButton!: KitIconButton;
  private toastLabel: KitPill | null = null;
  private sequence: ArrivalSequence | null = null;
  private current = 0;
  private sign!: MarketSign;
  /** The market sign is in the counters' row (a short, wide screen), not under the title. */
  private signInBar = false;
  /** The market sign shows what pasaran is: the first time, and while the player keeps it open with a tap. */
  private explainMarket = false;

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
    this.explainMarket = !this.store.isTutorialDone(PASARAN_INTRO);
    this.store.markTutorialDone(PASARAN_INTRO);
    // Music plays on the home screen and map, never in a level (it fades back in on return).
    this.sfx.wantMusic(true);
    // The items, wood and background of the level the player is heading for, while they look at the map.
    void prepareAheadInBackground(this, this.nextLevel(), this.store.colorBlindMode).then(() => prepareBoard(this, this.nextLevel()));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      if (this.modal) return;
      if (this.sequence?.running) {
        this.skipArrival();
        return;
      }
      this.press = { y: pointerAt(pointer).y, scroll: this.scroll, moved: false };
      // A level's plaque sinks a little under the finger.
      this.map.press(this.levelUnder(pointer));
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // With a mouse: the plaque under the pointer lifts and glows, and the pointer becomes a hand.
      if (!pointer.isDown) {
        const level = this.modal || this.sequence?.running || over.length > 0 ? null : this.levelUnder(pointer);
        this.map.hover(level);
        this.input.manager.canvas.style.cursor = level === null ? '' : 'pointer';
      }
      if (!this.press || !pointer.isDown) return;
      const dy = pointerAt(pointer).y - this.press.y;
      if (Math.abs(dy) > TAP_SLOP) this.press.moved = true;
      if (this.press.moved) {
        this.map.press(null);
        this.setScroll(this.press.scroll - dy);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const press = this.press;
      this.press = null;
      this.map.press(null);
      // Not when the tap was on a button or counter over the map.
      if (!press || press.moved || this.modal || over.length > 0) return;
      const level = this.levelUnder(pointer);
      if (level !== null) this.chooseLevel(level);
    });
    // The hand pointer is the map's alone: it goes with it.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.input.manager.canvas.style.cursor = ''));
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.setScroll(this.scroll + dy));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.build, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.build, this));

    this.build();
    fadeIn(this);
    const arrival = this.data_.arrival;
    if (arrival) {
      this.data_ = {};
      // Buku Nenek's news (this level's finds, or a lost level's before it) are announced in the sequence.
      void this.runArrival({ ...arrival, albumNews: this.store.takeAlbumNews() });
    } else if (import.meta.env.DEV && wantsBook(window.location.search)) {
      this.openBook();
    } else if (import.meta.env.DEV && wantsShop(window.location.search)) {
      this.openShop();
    } else if (import.meta.env.DEV && wantsChest(window.location.search)) {
      this.pressChest();
    } else if (import.meta.env.DEV && wantsCoinsHelp(window.location.search)) {
      this.openCoinsHelp();
    }
  }

  /** The revealed level whose plaque is under the pointer, if any. */
  private levelUnder(pointer: Phaser.Input.Pointer): number | null {
    const at = pointerAt(pointer);
    return this.map.levelAt(at.x - this.map.container.x, at.y - this.map.container.y);
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

    this.layout = computeMapLayout(playList.map((entry) => entry.level), width, height);
    this.map = new MapView(this, this.layout, levels, (width - this.layout.width) / 2);
    this.map.highlight(this.current);
    this.map.placeMarker(this.data_.arrival?.level ?? this.current);

    // The market day, under the title; on a short, wide screen in the counters' row (unless it is explaining).
    this.signInBar = isCompact(width, height) && !this.explainMarket;
    const row = topRow(width);
    const gearLeft = width - SPACE.s - 44 - SPACE.xs;
    const signRoom = this.signInBar ? gearLeft - row.end - SPACE.s : Math.min(width - SPACE.s * 2, 380);
    this.sign = new MarketSign(this, this.signInBar ? (row.end + gearLeft) / 2 : width / 2, 0, signRoom, todaysPasaran(), this.explainMarket, () => this.pressSign()).setDepth(DEPTH_BAR);
    this.sign.setY(this.signInBar ? 32 : BAR_CONTENT + this.sign.signHeight / 2);

    // The map scrolls between the clouds at its top and its bottom edge, keeping clear of the bar and button.
    const barH = this.barHeight();
    // From the top of Buku Nenek's button (over the shop) down.
    const footer = height - this.footerTop(width, height);
    this.maxScroll = this.layout.height - (height - footer);
    this.minScroll = Math.min(this.maxScroll, revealedTop(this.layout, revealed) - barH);
    this.scroll = this.scrollToShow(this.data_.arrival?.level ?? this.current);
    // Keeping an island's sign out from under the bar may show a little more of the clouds or the sea's edge.
    this.minScroll = Math.min(this.minScroll, this.scroll);
    this.maxScroll = Math.max(this.maxScroll, this.scroll);
    this.setScroll(this.scroll);

    this.buildBar(width);
    this.buildFooter(width, height);
  }

  /** The number of the furthest level the player can play (boosters unlocked by then are in the shop). */
  private reachedLevel(): number {
    return playList[this.nextLevel()]!.number;
  }

  /** Where the buttons at the foot start (map y on screen): the top of the book's button, or of the chest's stars. */
  private footerTop(width: number, height: number): number {
    const compact = isCompact(width, height);
    const { play, book } = footerRows(height, compact);
    return compact ? play - 32 - SPACE.s - FOOTER_ROW - SPACE.xs : book - SIDE_BUTTON / 2 - SPACE.s;
  }

  /** The top bar with the market sign under it: the map scrolls up to its foot. */
  private barHeight(): number {
    return BAR_CONTENT + (this.signInBar ? 0 : this.sign.signHeight + SPACE.xs);
  }

  /** A tap on the market sign shows or hides what pasaran is. */
  private pressSign(): void {
    if (this.modal || this.sequence?.running) return;
    kitFeedback().press();
    this.explainMarket = !this.explainMarket;
    this.build();
  }

  /**
   * Scroll that brings a level's plaque a little below the middle of the screen, nudged so that no island's sign
   * sits under the top bar (the title would cover it): the sign comes out below the bar, or goes up behind it whole,
   * whichever keeps the plaque further from the screen's edges.
   */
  private scrollToShow(level: number): number {
    const { height } = viewSize(this);
    const node = this.map.nodeAt(level).y;
    let scroll = node - height * 0.55;
    const bar = this.barHeight();
    const footerTop = this.footerTop(viewSize(this).width, height);
    for (const sign of this.map.signSpans()) {
      const top = sign.top - scroll;
      const bottom = sign.bottom - scroll;
      if (bottom <= 0 || top >= bar) continue;
      // Below the bar (scroll up), or wholly above the screen's top (scroll down): the plaque must stay in view.
      const below = sign.top - bar - SPACE.xs;
      const above = sign.bottom;
      // The plaque (its middle, plus its radius) between the bar and the buttons.
      const fits = (s: number) => node - s > bar + SPACE.l && node - s < footerTop - SPACE.l + SPACE.xs;
      if (fits(below)) scroll = below;
      else if (fits(above)) scroll = above;
    }
    return scroll;
  }

  private setScroll(scroll: number): void {
    this.scroll = Math.max(this.minScroll, Math.min(this.maxScroll, scroll));
    this.map.container.setY(-this.scroll);
    // The islands in view (and a screen around them) are shown, downloading the ones not loaded yet.
    this.map.reveal(this.scroll, this.scroll + viewSize(this).height);
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
    const { lw, cw, sw } = topRow(width);
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
      .setResolution(pixelRatio() * 1.5)
      .setOrigin(0.5)
      .setStroke(SKIN.surface.border, 7)
      .setShadow(0, 4, '#000000', 0.35, true, true);
    if (title.width > width - SPACE.l * 2) title.setScale((width - SPACE.l * 2) / title.width);
    // On a screen too short to bring an island's sign out from under the bar (a phone in landscape), the title
    // makes way rather than cover it.
    const covered = this.map.signSpans().some((sign) => sign.bottom - this.scroll > 0 && sign.top - this.scroll < this.barHeight());
    title.setVisible(!covered);
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
    const compact = isCompact(width, height);
    const { play: y, book: bookY } = footerRows(height, compact);
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
    const shopX = width / 2 - side;
    this.shopButton = new KitIconButton(this, shopX, y, { skin: SKIN, icon: 'shop', look: 'secondary', size: SIDE_BUTTON, onPress: () => this.openShop() }).setDepth(DEPTH_BAR);
    const chestX = width / 2 + side;
    // Once it can be opened the chest glows warmly and golden glints twinkle around it, like a gift waiting.
    this.chestLight = giftLight(this, chestX, y);
    new KitIconButton(this, chestX, y, { skin: SKIN, icon: 'chest', look: 'secondary', size: SIDE_BUTTON, onPress: () => this.pressChest() }).setDepth(DEPTH_BAR);

    const rowY = y - 32 - SPACE.s - FOOTER_ROW / 2;
    // Stars towards the next chest, over its button (it can pass the target: 17/15).
    const chestW = 76;
    this.chestPill = new KitPill(this, chestX, rowY, { skin: SKIN, icon: 'starFilled', value: '', tint: SKIN.star.filled, height: FOOTER_ROW, width: chestW }).setDepth(DEPTH_BAR);
    this.showChestStars(this.store.wallet.chestStars);

    // Buku Nenek, over the shop: the illustrated book on a button like the shop's and the chest's, with what has
    // been found (and its bar) on a tab at its foot. A page waiting for its reward lights it up like the chest.
    const waiting = pagesToClaim(this.store.album).length > 0;
    const bookX = compact ? shopX - SIDE_BUTTON - SPACE.s : shopX;
    const bookLight = giftLight(this, bookX, bookY);
    new KitIconButton(this, bookX, bookY, { skin: SKIN, icon: 'book', texture: BOOK_TEXTURE, look: 'secondary', size: SIDE_BUTTON, onPress: () => this.openBook() }).setDepth(DEPTH_BAR);
    const found = this.store.album.found.length;
    new KitPill(this, bookX, bookY + SIDE_BUTTON / 2 + 4, { skin: SKIN, value: `${found}/${ALBUM_SIZE}`, tint: waiting ? SKIN.text.accent : SKIN.text.primary, height: BOOK_TAB, width: 62 })
      .setProgress(found / ALBUM_SIZE)
      .setDepth(DEPTH_BAR + 1);
    lightGift(this, bookLight, waiting);
  }

  /** Buku Nenek, Grandma's book. */
  private openBook(): void {
    if (this.modal || this.sequence?.running) return;
    this.modal = openBukuNenek(
      this,
      this.store,
      this.sfx,
      (reward, from) => this.flyReward(reward, from),
      () => {
        this.modal = null;
        // The book's button (and its light), the coins.
        this.build();
      },
    );
  }

  /**
   * A reward collected in the book flies, over the open book, to where it counts: coins to the coins counter, which
   * counts up as they land (as after a win); a booster to the shop, which holds them. With reduce motion the
   * counter just changes, with its bump.
   */
  private flyReward(reward: Reward, from: { x: number; y: number }): void {
    const above = DEPTH_MODAL + 10;
    if (reward.kind === 'coins') {
      const total = this.store.wallet.coins;
      const base = total - reward.amount;
      // The coins counter, raised over the book's dimmed backdrop while they land: a twin in the same place (the
      // real one is in the top bar, under the backdrop with the title), gone once it has counted up.
      const pill = this.coinsPill;
      const twin = new KitPill(this, pill.x, pill.y, { skin: SKIN, icon: 'coin', value: formatScore(base, getLocale()), tint: SKIN.text.accent, height: 40, width: pill.pillWidth }).setDepth(above);
      const show = (coins: number) => {
        twin.setValue(formatScore(coins, getLocale()));
        this.bump(twin);
      };
      const done = () => {
        show(total);
        this.showCoins(total);
        this.tweens.add({ targets: twin, alpha: 0, delay: DURATION.slow * 2, duration: DURATION.base, ease: EASE.exit, onComplete: () => twin.destroy() });
      };
      if (reducedMotion()) return done();
      const to = { x: this.coinsPill.x - 30, y: this.coinsPill.y };
      const flights = Math.min(6, Math.max(2, Math.round(reward.amount / 10)));
      for (let i = 0; i < flights; i++) {
        const coin = this.add.image(from.x, from.y, uiIconKey('coin', SKIN.text.accent)).setDisplaySize(24, 24).setDepth(above + 1);
        const progress = { k: 0 };
        this.tweens.add({
          targets: progress,
          k: 1,
          delay: i * 90,
          duration: 520,
          ease: 'Cubic.easeIn',
          onUpdate: () => coin.setPosition(from.x + (to.x - from.x) * progress.k, from.y + (to.y - from.y) * progress.k - Math.sin(Math.PI * progress.k) * 60),
          onComplete: () => {
            coin.destroy();
            this.sfx.play('starCollect');
            if (i === flights - 1) return done();
            show(base + Math.round((reward.amount * (i + 1)) / flights));
          },
        });
      }
      return;
    }
    const shop = this.shopButton;
    shop.setDepth(above);
    const done = () => {
      this.sfx.play('unlock');
      this.bump(shop);
      this.time.delayedCall(DURATION.slow, () => shop.setDepth(DEPTH_BAR));
    };
    if (reducedMotion()) return done();
    const tile = this.add.image(from.x, from.y, boosterTextureKey(reward.booster)).setDisplaySize(52, 52).setDepth(above + 1);
    const progress = { k: 0 };
    this.tweens.add({
      targets: progress,
      k: 1,
      duration: 640,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        const k = progress.k;
        tile.setPosition(from.x + (shop.x - from.x) * k, from.y + (shop.y - from.y) * k - Math.sin(Math.PI * k) * 80).setDisplaySize(52 - 16 * k, 52 - 16 * k);
      },
      onComplete: () => {
        tile.destroy();
        done();
      },
    });
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
    // The glow breathes and the glints twinkle in turn, asking to be tapped; with reduce motion they stay still.
    lightGift(this, this.chestLight, stars >= every);
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
    this.sfx.play('chest');

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
    // Its items are usually ready (prepared in the background while the map was open); if not, a moment's wait.
    void prepareBoard(this, level).then(() => {
      fadeToScene(this, 'Game', { levelIndex: level });
      void prepareAheadInBackground(this, level + 1, this.store.colorBlindMode);
    });
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
    const h = Math.min(safe.height - SPACE.s * 2, 520);
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
      { icon: 'coin', color: SKIN.text.accent, title: t('coinsHelp.market'), note: t('coinsHelp.marketNote') },
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
      music: this.sfx.hasMusic ? this.store.music : null,
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
      onMusic: (on) => {
        this.sfx.setMusic(on);
        this.store.setMusic(on);
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
   * A reward card over the map for a moment: a new player level and its gift, or new entries in Buku Nenek (their
   * pictures, and a line if a page is waiting for its reward to be collected).
   */
  private showCard(card: RewardCard): Promise<void> {
    if (card.kind === 'album') return this.showAlbumCard(card.kinds);
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
      item.container.setPosition(x + item.width / 2, top + 112 + extra);
      x += item.width + gap;
      panel.add(item.container);
    }
    return this.presentCard(panel, items.map((item) => item.container));
  }

  /** New entries in Buku Nenek: "New page in Grandma's book" with the pictures of what was found. */
  private async showAlbumCard(kinds: readonly string[]): Promise<void> {
    const shown = kinds.slice(0, 4);
    await prepareTypes(this, shown);
    if (!this.scene.isActive()) return;
    const { width, height } = viewSize(this);
    const w = Math.min(320, width - SPACE.l * 2);
    const inner = w - SPACE.l * 2;
    // Laid out from the top first, so the card is made as tall as its content.
    const title = kitText(this, 'button', t('album.news.title'), SKIN.text.primary, 22).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(inner);
    const size = 56;
    const gap = SPACE.xs;
    let y = SPACE.m + title.height + SPACE.s;
    const pictures = shown.map((kind, i) => this.add.image((i - (shown.length - 1) / 2) * (size + gap), y + size / 2, itemTextureKey(kind, false)).setDisplaySize(size, size));
    const content: Phaser.GameObjects.GameObject[] = [...pictures];
    if (kinds.length > shown.length) content.push(kitText(this, 'number', `+${kinds.length - shown.length}`, SKIN.text.accent, 20).setPosition(((shown.length + 1) / 2) * (size + gap), y + size / 2));
    y += size + SPACE.s;
    if (pagesToClaim(this.store.album).length > 0) {
      const line = kitText(this, 'body', t('album.news.claim'), SKIN.text.accent, 14).setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(inner).setY(y);
      content.push(line);
      y += line.height + SPACE.s;
    }
    const h = y + SPACE.xs;
    const panel = new KitPanel(this, width / 2, height * 0.45, { skin: SKIN, width: w, height: h });
    title.setY(-h / 2 + SPACE.m);
    for (const part of content) (part as unknown as Phaser.GameObjects.Components.Transform).y -= h / 2;
    panel.add([title, ...content]);
    return this.presentCard(panel, content);
  }

  /**
   * Shows a reward card: it pops in, then its content fades in, and after a moment it fades away. Resolves once it
   * has gone (or when a skip took it away).
   */
  private presentCard(panel: KitPanel, content: readonly Phaser.GameObjects.GameObject[]): Promise<void> {
    panel.setDepth(DEPTH_MODAL + 5);
    this.card = panel;
    const still = reducedMotion();
    for (const part of content) (part as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    panel.setScale(still ? 1 : 0.86).setAlpha(0);
    // Separate steps rather than one chain of tweens: the content is always shown, whatever happens to the pop.
    return new Promise((resolve) => {
      this.tweens.add({ targets: panel, alpha: 1, scale: 1, duration: DURATION.slow, ease: EASE.pop });
      // A skip (closeCards) may have taken the card away meanwhile.
      this.time.delayedCall(DURATION.slow, () => {
        if (!panel.scene) return;
        for (const part of content) (part as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(still ? 1 : 0);
        if (!still) this.tweens.add({ targets: content, alpha: 1, duration: DURATION.base, ease: EASE.enter });
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
