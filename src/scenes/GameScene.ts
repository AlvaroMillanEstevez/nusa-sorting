import * as Phaser from 'phaser';
import {
  arrangementCount,
  completesFirstTriple,
  createGame,
  FIRST_TRIPLE_TUTORIAL,
  findItem,
  freeFrontSlots,
  isShelfLocked,
  isSpecialLevel,
  isSlotBlocked,
  itemAt,
  moveItem,
  addTime,
  boosterPrice,
  boostersUnlockedAt,
  continueAfterBlocked,
  continueByShuffling,
  continueBoosters,
  extraTimePrice,
  freezeClock,
  removeTriple,
  shuffleBoard,
  winCoins,
  starsFor,
  starThresholds,
  tick,
  TIME_BONUS_PER_SECOND,
  triplesToUnlock,
  tutorialMove,
  takeSnapshot,
  NO_BOOSTERS_USED,
  type GameEvent,
  type MoveResult,
  type GameState,
  type Item,
  type LevelDefinition,
  type LoseReason,
  type Position,
  stackOf,
  startClock,
} from '../core';
import { parseArrangementParam } from '../dev/levelParam';
import { parseBoostersParam, parseShowParam, parseThemeParam, type ShowParam } from '../dev/uiParams';
import { formatScore } from '../ui/format';
import { getLocale, t, type MessageKey } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import {
  BACK_SCALE,
  SILHOUETTE_ALPHA,
  frontSlotAt,
  nearestFreeSlot,
  nearestSlot,
  shelfAt,
  slotAspect,
  slotRect,
  boundsAround,
  type BoardLayout,
} from '../ui/boardLayout';
import { ITEM_FILL, layoutForLevel, liveBoard, type LiveBoard } from '../ui/levelLayout';
import { DURATION, hexNumber, SKIN } from '../ui/design/tokens';
import { themeLook } from '../ui/themeLook';
import { themeById, type ThemeId } from '../data/themes';
import { placeItem, typeFit } from '../ui/itemFit';
import { CRITICAL_TIME_MS, timeStage, type TimeStage } from '../ui/timeWarning';
import { art, useShelfTrim } from './art/ArtSet';
import { BakedLayer } from './art/BakedLayer';
import { BeltController } from './BeltController';
import { BlockerView, ClosingShelves, LockOverlays } from './BoardDecor';
import { Hud } from './Hud';
import { ITEM_TEXTURE_SIZE, itemBackTextureKey, itemTextureKey } from './itemTextures';
import { MovingShelves } from './MovingShelves';
import { playList } from './playList';
import { playedLevel, type ResumedLevel } from './playedLevel';
import { ResultOverlay } from './ResultOverlay';
import { ThemeDecor } from './ThemeDecor';
import { ThemeIntro } from './ThemeIntro';
import { TutorialHint } from './TutorialHint';
import { Effects } from './Effects';
import { BoosterBar } from './BoosterBar';
import { boosterTextureKey } from './boosterTextures';
import { showContinue, type ContinueChoice } from './ContinuePanel';
import { showOffer } from './Offer';
import { BOOSTER_IDS, ECONOMY, type BoosterId } from '../data/economy';
import { boosterBarRect } from '../ui/levelLayout';
import type { Arrival } from './map/arrival';
import { fadeIn, fadeToScene } from './transitions';
import type { HapticsService } from '../services/HapticsService';
import { PauseMenu } from './PauseMenu';
import { kitText, reducedMotion, setReducedMotion } from './kit';
import { fitCamera, pointerAt, RENDER_RATIO, screenRect, viewSize } from './view';

const SELECTED_LIFT = 0.15;
const SELECTED_SCALE = 1.12;
const PICKUP_SCALE = 1.18;

// Animations are visual only: the core state is already final, so input is never locked while they play.
const PICKUP_MS = 80;
const SNAP_MS = 130;
const RETURN_MS = 160;
const CLEAR_DELAY_MS = 90;
const CLEAR_MS = 200;
/** "Remove a triple": its three items fly together from wherever they are before they pop. */
const GATHER_MS = 480;
const ADVANCE_DELAY_MS = CLEAR_DELAY_MS + 120;
const ADVANCE_MS = 200;
const SELECT_MS = 90;
/** Pause after the last animation before the result panel appears. */
const RESULT_DELAY_MS = 550;
/** How long the board shows it is full before the defeat panel. */
const BLOCKED_WARNING_MS = 1100;
const FADE_MS = 220;

const DEPTH_BACK = 5;
const DEPTH_FRONT = 10;
const DEPTH_DRAG = 100;
/** The drop-target outline: over shelves and empty slots, under items. */
const DEPTH_DROP_MARK = 9;
/** Shelves riding a track this faded out (at the ends of their loop) take no taps and no drops. */
const MIN_INTERACTIVE_ALPHA = 0.3;
const DEPTH_POPUP = 120;

/** What the game scene is started with. */
export interface GameData {
  /** The level to play (index in play order); by default the first one not completed. */
  readonly levelIndex?: number;
  /** A level in progress picked up from the save: it opens as it was, with the pause menu open. */
  readonly resume?: ResumedLevel;
}

/** Development only: ?show= opens its panel once, not again after the player moves on. */
let devShown = false;

const LOSE_TITLES: Record<LoseReason, MessageKey> = {
  timeUp: 'result.lost.timeUp',
  blocked: 'result.lost.blocked',
  stuck: 'result.lost.stuck',
};

interface SpriteTarget {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  depth: number;
  front: boolean;
}

/**
 * Draws the game state and turns pointer input into core actions.
 * All rules live in src/core; this scene only renders state and animates core events.
 */
export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: LevelDefinition;
  private state!: GameState;
  /** The board as laid out for the screen; shelves riding tracks at their time-0 place. */
  private base!: BoardLayout;
  /** The board right now (shelves riding tracks where they are), refreshed every frame. */
  private live!: LiveBoard;
  /** Same as live.layout: what drawing, hit tests and drop targets use. */
  private layout!: BoardLayout;

  private board!: BakedLayer;
  private hud!: Hud;
  private overlay!: ResultOverlay;
  private decor!: ThemeDecor;
  private themeIntro!: ThemeIntro;
  private tutorial!: TutorialHint;
  private effects!: Effects;
  private boosterBar!: BoosterBar;
  /** "Remove a triple" is armed: the next tap on an item removes its triple. */
  private aiming = false;
  private hintTimer: Phaser.Time.TimerEvent | null = null;
  /** Continues used in this attempt (each costs more, up to a maximum). */
  private continuesUsed = 0;
  /** Development only: what the win panel's main button does (for ?show=autoplay). */
  private overlayNext: (() => void) | null = null;
  /**
   * The first-triple tutorial is on: level 1 until the player clears a triple, once ever. The clock does not run
   * meanwhile.
   */
  private tutorialActive = false;
  private pauseMenu!: PauseMenu;
  /** The pause menu (or the level list over it) is open: nothing timed moves and the board takes no input. */
  private paused = false;
  /** Points the time left added when the level was won (for the victory panel). */
  private timeBonus = 0;
  /** The current press landed on the theme intro screen: its release is not a tap on the board. */
  private pressOnIntro = false;
  private locks!: LockOverlays;
  private closing!: ClosingShelves;
  private blocker!: BlockerView;
  private belt!: BeltController;
  private movingShelves!: MovingShelves;
  private dropMark!: Phaser.GameObjects.Graphics;
  /** Last pointer position, for the drop-target outline while dragging. */
  private pointerPos: { x: number; y: number } | null = null;
  /** Items on moving shelves animating toward a slot that keeps moving: lerped every frame to its live place. */
  private readonly flights = new Map<
    number,
    { fromX: number; fromY: number; fromScale: number; fromAlpha: number; start: number; delay: number; duration: number }
  >();

  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly popups = new Set<Phaser.GameObjects.Text>();

  private selectedId: number | null = null;
  private draggingId: number | null = null;
  /** A press on a shelf item that may turn into a drag once the pointer travels past the threshold. */
  private shelfPress: { pointerId: number; itemId: number; dragging: boolean } | null = null;
  /** Set when the current pointer press turned into a drag, so its pointerup is not a tap. */
  private dragOccurred = false;
  private lastWarningSecond: number | null = null;
  /** How urgent the clock was last frame, to chime once when time starts running low. */
  private timeStage: TimeStage = 'normal';

  /** The level to start with (index in play order), from whoever started this scene. */
  private startIndex: number | null = null;
  private resumeWith: ResumedLevel | null = null;
  /** A level picked up from the save shows its due booster intros once the pause menu closes. */
  private introsAfterPause = false;
  /** The arrangement of the level being played (see withArrangement). */
  private arrangement = 0;
  /** Boosters used in this attempt (kept in the level's snapshot). */
  private boostersUsed: Record<BoosterId, number> = { ...NO_BOOSTERS_USED };

  constructor(
    private readonly sfx: SoundService,
    private readonly store: ProgressStore,
    private readonly haptics: HapticsService,
  ) {
    super('Game');
  }

  init(data: GameData): void {
    this.startIndex = data?.levelIndex ?? null;
    this.resumeWith = data?.resume ?? null;
  }

  create(): void {
    // No music in levels: it fades out as the level opens.
    this.sfx.wantMusic(false);
    this.haptics.setEnabled(this.store.vibration);
    this.board = new BakedLayer(this, 0);
    this.movingShelves = new MovingShelves(this);
    this.dropMark = this.add.graphics().setDepth(DEPTH_DROP_MARK);
    this.locks = new LockOverlays(this);
    this.closing = new ClosingShelves(this);
    this.blocker = new BlockerView(this);
    this.belt = new BeltController({
      scene: this,
      sfx: this.sfx,
      getState: () => this.state,
      setState: (state) => (this.state = state),
      getLayout: () => this.layout,
      shelfItemScale: () => this.baseScale(),
      setLook: (sprite, front) => this.setLook(sprite, front),
      spriteFor: (itemId) => this.sprites.get(itemId),
      dropTarget: (x, y) => this.dropTarget(x, y, null),
      onPlaced: (events) => this.play(events),
      onPick: () => this.select(null),
    });
    this.hud = new Hud(this, { onPause: () => this.openPause() });
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => this.resume(),
      onRestart: () => {
        this.paused = false;
        this.transitionTo(this.levelIndex);
      },
      onHome: () => {
        this.paused = false;
        this.goHome();
      },
      onSound: (on: boolean) => {
        this.sfx.setMuted(!on);
        // Settings are saved when they change.
        this.store.setMuted(!on);
      },
      onColorBlind: (on: boolean) => {
        this.store.setColorBlindMode(on);
        this.applyColorBlindMode();
      },
      onVibration: (on: boolean) => {
        this.haptics.setEnabled(on);
        this.store.setVibration(on);
      },
      onReduceMotion: (on: boolean) => {
        this.store.setReduceMotion(on);
        setReducedMotion(on);
      },
      onMusic: (on: boolean) => {
        this.sfx.setMusic(on);
        this.store.setMusic(on);
      },
    });
    this.overlay = new ResultOverlay(this, (effect) => this.sfx.play(effect));
    this.decor = new ThemeDecor(this);
    this.themeIntro = new ThemeIntro(this);
    this.tutorial = new TutorialHint(this, () => this.skipTutorial());
    this.effects = new Effects(this);
    this.boosterBar = new BoosterBar(this, (booster) => this.pressBooster(booster));

    // A small movement threshold keeps taps from being read as drags, especially with fingers.
    // Pointer distances are in canvas pixels, hence the render ratio.
    this.input.dragDistanceThreshold = 8 * RENDER_RATIO;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    // The level asked for, or else the first one not completed yet (the last one once all are done).
    // When the page is hidden (the phone locked, another app or tab), the level pauses and is saved as it is:
    // mobile browsers may drop a page in the background, and it then picks up from there.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') this.leavePage();
    };
    const onPageHide = () => this.leavePage();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
    });

    const ids = playList.map((entry) => entry.level.id);
    // Development only: ?show=buy|continue skips the booster intros (giving their gifts quietly).
    const devShowParam = import.meta.env.DEV ? parseShowParam(window.location.search) : null;
    if ((devShowParam === 'buy' || devShowParam === 'continue' || devShowParam === 'stuck') && !devShown) BOOSTER_IDS.forEach((id) => this.store.introduceBooster(id));
    const devBoosters = import.meta.env.DEV ? parseBoostersParam(window.location.search) : null;
    if (devBoosters !== null && !devShown) {
      BOOSTER_IDS.forEach((id) => this.store.introduceBooster(id));
      this.store.setBoosterCounts(devBoosters);
    }
    const resume = this.resumeWith;
    this.resumeWith = null;
    if (resume) this.loadLevel(resume.levelIndex, resume);
    else this.loadLevel(this.startIndex ?? this.store.firstIncomplete(ids) ?? playList.length - 1);
    fadeIn(this);
    // On a computer, P opens and closes the pause menu. Not Escape: in the browser it leaves fullscreen, which
    // CrazyGames asks games not to take over.
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-P', this.togglePause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown-P', this.togglePause, this);
    });
    if (import.meta.env.DEV) {
      const show = parseShowParam(window.location.search);
      // Only once: the panel is not shown again when the player moves on.
      if (show && !devShown) {
        devShown = true;
        this.devShow(show);
      }
    }
  }

  /**
   * Development only (?show=autoplay): plays the level with the solver, a move every 0.65 s, to review the effects
   * and the whole way to the map without touching the screen. Belt picks go straight into their slot. With
   * ?preview (the store video) the win panel stays a shorter while.
   */
  private async devAutoplay(): Promise<void> {
    // The condition lets production builds drop the solver altogether.
    const simulator = import.meta.env.DEV ? await import('../../tools/simulator') : null;
    if (!simulator) return;
    const step = () => {
      if (this.state.status !== 'playing') {
        // Then on to the map, as the player would.
        const preview = new URLSearchParams(window.location.search).has('preview');
        this.time.delayedCall(preview ? 2300 : 3200, () => this.overlay.visible && this.overlayNext?.());
        return;
      }
      const move = simulator.suggestedMove(this.state);
      if (move && simulator.isBeltSource(move[0])) this.belt.pickAndPlace(move[0], move[1]);
      else if (move) this.tryMove(move[0] as Position, move[1]);
      this.time.delayedCall(650, step);
    };
    this.time.delayedCall(1200, step);
  }

  /** Back to the home screen (with the sequence that follows a win, when there is one). */
  private goHome(arrival?: Arrival): void {
    this.store.clearSnapshot();
    this.holdBoard();
    fadeToScene(this, 'Home', arrival ? { arrival } : {});
  }

  /** Development only (?show=): opens a panel at once, to review it without playing the level. */
  private devShow(show: ShowParam | null): void {
    if (show === 'autoplay') {
      void this.devAutoplay();
    } else if (show === 'buy') {
      this.offerBooster(this.unlockedBoosters()[0] ?? 'freeze');
    } else if (show === 'continue' || show === 'stuck') {
      const loseReason = show === 'stuck' ? 'stuck' : this.state.timeLeftMs === null ? 'blocked' : 'timeUp';
      this.state = { ...this.state, status: 'lost', loseReason };
      this.offerContinue(() =>
        this.overlay.show({ kind: 'lost', title: t(LOSE_TITLES[loseReason]), hint: t('result.lost.hint'), retry: () => this.transitionTo(this.levelIndex), home: () => this.goHome() }),
      );
    } else if (show === 'pause' || show === 'confirm') {
      this.state = startClock(this.state);
      this.openPause();
      if (show === 'confirm') this.pauseMenu.showConfirm('restart');
    } else if (show === 'won') {
      const timeLeftMs = this.state.timeLeftMs === null ? null : this.state.timeLeftMs * 0.4;
      const timeBonus = timeLeftMs === null ? 0 : Math.floor(timeLeftMs / 1000) * TIME_BONUS_PER_SECOND;
      const score = starThresholds(this.level).three + 50;
      this.timeBonus = timeBonus;
      this.overlay.show({
        kind: 'won',
        title: t('result.won.title'),
        stars: starsFor(score, starThresholds(this.level)),
        score,
        timeBonus,
        timeLeftMs,
        bestLine: t('result.newBest'),
        newBest: true,
        coins: winCoins(true, starsFor(score, starThresholds(this.level)), 0),
        next: () => this.goHome(),
        replay: () => this.transitionTo(this.levelIndex),
      });
    } else if (show === 'blocked') {
      // After a moment, so the board is seen first.
      this.time.delayedCall(1500, () => {
        this.sfx.play('blocked');
        this.effects.blockedWarning(this.layout.shelves.map((shelf) => shelf.rect), BLOCKED_WARNING_MS, t('result.lost.blocked'));
      });
      this.time.delayedCall(1500 + BLOCKED_WARNING_MS, () =>
        this.overlay.show({ kind: 'lost', title: t('result.lost.blocked'), hint: t('result.lost.hint'), retry: () => this.transitionTo(this.levelIndex), home: () => this.goHome() }),
      );
    } else if (show === 'lost') {
      this.overlay.show({ kind: 'lost', title: t('result.lost.timeUp'), hint: t('result.lost.hint'), retry: () => this.transitionTo(this.levelIndex), home: () => this.goHome() });
    }
  }

  /** Drops whatever the player was holding or had selected. */
  private holdBoard(): void {
    if (this.belt.holding) this.belt.sendBack(false);
    this.select(null);
  }

  /** Opens the pause menu: the clock, tracks and combo stop until it closes. */
  private openPause(): void {
    if (this.state.status !== 'playing' || this.overlay.visible || this.pauseMenu.visible || this.themeIntro.visible) return;
    this.holdBoard();
    this.setAiming(false);
    this.paused = true;
    this.pauseMenu.open({
      levelNumber: playList[this.levelIndex]!.number,
      special: isSpecialLevel(this.level),
      soundOn: !this.sfx.muted,
      music: this.sfx.hasMusic ? this.store.music : null,
      colorBlind: this.store.colorBlindMode,
      vibration: this.store.vibration,
      canVibrate: this.haptics.supported,
      reduceMotion: this.store.reduceMotion,
      started: this.state.clockStarted,
    });
  }

  private resume(): void {
    this.pauseMenu.close();
    this.paused = false;
    if (this.introsAfterPause) {
      this.introsAfterPause = false;
      this.introduceBoosters();
    }
  }

  private togglePause(): void {
    if (this.pauseMenu.visible) this.resume();
    else this.openPause();
  }

  override update(_time: number, delta: number): void {
    this.hud.setWaiting(this.state.status === 'playing' && !this.state.clockStarted);
    // The tutorial and the pause menu hold the clock (and everything timed: tracks, the combo window).
    if (this.state.status === 'playing' && !this.tutorialActive && !this.paused) {
      const result = tick(this.state, delta);
      this.state = result.state;
      this.hud.setTime(this.state.timeLeftMs, this.totalTimeMs());
      this.hud.setFrozen(this.state.frozenMs > 0);
      this.warnTicks();
      const combo = this.state.combo;
      this.hud.setCombo(combo.combo, combo.windowLeftMs, combo.windowMs);
      if (result.events.some((e) => e.kind === 'lost')) this.endLevel(0);
    }
    // Tracks are drawn every frame; they only move while playing because tick() is what advances them.
    this.refreshLive();
    this.movingShelves.update(this.live);
    this.locks.follow(this.live);
    this.followBlocker();
    this.followMovingItems();
    this.updateDropMark();
    this.belt.update();
  }

  /** Recomputes where shelves riding tracks are now; everything else reads this.layout. */
  private refreshLive(): void {
    this.live = liveBoard(this.base, this.state);
    this.layout = this.live.layout;
  }

  /** A shelf under (x, y) that can take taps and drops now, or -1 (shelves faded out at a loop end cannot). */
  private interactiveShelfAt(x: number, y: number): number {
    const shelf = shelfAt(this.layout, x, y);
    return shelf !== -1 && this.live.shelfAlpha[shelf]! >= MIN_INTERACTIVE_ALPHA ? shelf : -1;
  }

  private followBlocker(): void {
    const at = this.state.blocker?.at;
    if (!at || !this.live.moving[at.shelf]) return;
    this.blocker.follow(this.layout.shelves[at.shelf]!.slots[at.slot]!, this.live.shelfAlpha[at.shelf]!);
  }

  /** Items on moving shelves are placed every frame, gliding there when a flight is under way. */
  private followMovingItems(): void {
    if (!this.live.moving.some(Boolean)) return;
    const now = this.time.now;
    for (const [id, sprite] of this.sprites) {
      if (id === this.draggingId || this.belt.owns(id) || this.tweens.isTweening(sprite)) continue;
      const pos = findItem(this.state, id);
      if (!pos || !this.live.moving[pos.shelf]) continue;
      const target = this.targetFor(id, pos);
      let { x, y, scale } = target;
      let alpha = target.alpha * this.live.shelfAlpha[pos.shelf]!;
      const flight = this.flights.get(id);
      if (flight) {
        const t = (now - flight.start - flight.delay) / flight.duration;
        const k = Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(t, 0, 1));
        x = Phaser.Math.Linear(flight.fromX, x, k);
        y = Phaser.Math.Linear(flight.fromY, y, k);
        scale = Phaser.Math.Linear(flight.fromScale, scale, k);
        alpha = Phaser.Math.Linear(flight.fromAlpha, alpha, k);
        if (t >= 1) this.flights.delete(id);
      }
      sprite.setPosition(x, y).setScale(scale).setAlpha(alpha);
    }
  }

  /** Starts a glide toward an item's (moving) slot from wherever its sprite is now. */
  private fly(id: number, sprite: Phaser.GameObjects.Image, duration: number, delay = 0): void {
    this.tweens.killTweensOf(sprite);
    this.flights.set(id, {
      fromX: sprite.x,
      fromY: sprite.y,
      fromScale: sprite.scale,
      fromAlpha: sprite.alpha,
      start: this.time.now,
      delay,
      duration,
    });
  }

  /**
   * While dragging (a shelf item or a belt item), outlines the slot the item would land in if released now.
   * On a moving shelf the outline rides along with it; releasing uses the same slot.
   */
  private updateDropMark(): void {
    const g = this.dropMark.clear();
    const dragging = this.draggingId !== null || this.belt.dragging;
    if (!dragging || !this.pointerPos || this.state.status !== 'playing') return;
    const from = this.draggingId !== null ? findItem(this.state, this.draggingId) : null;
    const target = this.dropTarget(this.pointerPos.x, this.pointerPos.y, from);
    if (!target) return;
    const backHome = from !== null && from.shelf === target.shelf && from.slot === target.slot;
    if (backHome || itemAt(this.state, target) || isSlotBlocked(this.state, target.shelf, target.slot)) return;
    if (isShelfLocked(this.state, target.shelf)) return;
    const s = this.layout.slotSize;
    // The whole slot, as tall as it is.
    const cell = slotRect(this.layout.shelves[target.shelf]!, target.slot, s);
    const inset = s * 0.02;
    const color = hexNumber(SKIN.status.combo);
    g.lineStyle(Math.max(3, s * 0.07), color, 1).strokeRoundedRect(cell.x + inset, cell.y + inset, cell.width - inset * 2, cell.height - inset * 2, s * 0.14);
  }

  // ---------------------------------------------------------------- level lifecycle

  /** Fades out, loads the level, fades back in. Also used for restart and retry. */
  private transitionTo(index: number): void {
    const camera = this.cameras.main;
    if (camera.fadeEffect.isRunning) return;
    camera.fadeOut(FADE_MS, 27, 42, 58);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadLevel(index);
      camera.fadeIn(FADE_MS, 27, 42, 58);
    });
  }

  /**
   * Loads a level from its start, or (`resume`) as it was when it was saved, with the pause menu open. A fresh
   * start forgets any level in progress: restarting is never a way back to an earlier board.
   */
  private loadLevel(index: number, resume?: ResumedLevel): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    for (const popup of this.popups) popup.destroy();
    this.popups.clear();
    this.selectedId = null;
    this.draggingId = null;
    this.shelfPress = null;
    this.flights.clear();
    this.dropMark.clear();
    this.lastWarningSecond = null;
    this.overlay.hide();
    this.pauseMenu.close();
    this.paused = false;
    this.timeBonus = 0;

    this.levelIndex = index;
    if (resume) {
      this.arrangement = resume.arrangement;
      this.level = resume.level;
      this.state = resume.state;
    } else {
      this.store.clearSnapshot();
      // Each attempt plays another arrangement of the level's items (?arrangement=K picks one in development).
      const written = playList[index]!.level;
      const count = arrangementCount(written);
      const forced = import.meta.env.DEV ? parseArrangementParam(window.location.search, count) : null;
      this.arrangement = forced ?? this.store.takeArrangement(written.id, count);
      this.level = playedLevel(index, this.arrangement);
      this.state = createGame(this.level);
    }
    this.continuesUsed = resume?.continuesUsed ?? 0;
    this.boostersUsed = { ...(resume?.boostersUsed ?? NO_BOOSTERS_USED) };
    for (const shelf of this.state.shelves) {
      for (const layer of shelf.layers) {
        for (const item of layer) if (item) this.createSprite(item);
      }
    }
    for (const track of this.state.tracks) {
      for (const carrier of track.carriers) for (const item of stackOf(carrier)) this.createSprite(item);
    }
    this.belt.reset(this.state);
    this.hud.setLevel(playList[index]!.number, isSpecialLevel(this.level));
    this.timeStage = 'normal';
    this.hud.setTime(this.state.timeLeftMs, this.totalTimeMs());
    this.hud.setScore(this.state.combo.score, false);
    this.hud.setCombo(0, 0, 0);
    const locked = new Map<number, number>();
    this.state.shelves.forEach((_, shelf) => {
      if (isShelfLocked(this.state, shelf)) locked.set(shelf, triplesToUnlock(this.state, shelf));
    });
    this.locks.reset(locked);
    this.closing.reset(this.state.closesWhenEmpty, this.state.closed);
    // A themed level trims the shelves and the HUD in its colours (the background is drawn in relayout).
    const look = themeLook(this.levelTheme());
    useShelfTrim(look?.trim ?? null);
    this.hud.setAccent(look?.accent ?? null);
    this.relayout();
    this.sync(0);
    // The first time in a themed level: its name and the objects it brings. Seen once closed.
    this.themeIntro.clear();
    const themeId = this.levelTheme();
    this.setAiming(false);
    // Development only: a theme tried on with ?theme= always shows its intro, and is not remembered as seen.
    const tryingOn = import.meta.env.DEV && parseThemeParam(window.location.search) !== null;
    const themed = look && themeId && themeById(themeId) && (tryingOn || !this.store.themesSeen.includes(themeId));
    if (themed) {
      this.themeIntro.show(themeId as ThemeId, look, this.store.colorBlindMode, () => {
        if (!tryingOn) this.store.markThemeSeen(themeId);
        this.introduceBoosters();
      });
    }
    // The first time in level 1: how to make a triple, until the player makes one.
    this.tutorial.clear();
    this.tutorialActive = index === 0 && !this.store.isTutorialDone(FIRST_TRIPLE_TUTORIAL);
    this.showTutorial();
    // Picked up from the save: everything stays still until the player chooses to go on, and any booster intro
    // still due waits until then.
    this.introsAfterPause = Boolean(resume) && !themed;
    if (resume) this.openPause();
    else if (!themed) this.introduceBoosters();
  }

  // ---------------------------------------------------------------- the level in progress

  /** Saves the level as it is now, to pick it up after a reload; only while it is being played. */
  private saveSnapshot(): void {
    if (this.state.status !== 'playing') return;
    this.store.saveSnapshot(takeSnapshot(this.level, this.arrangement, this.state, { continuesUsed: this.continuesUsed, boostersUsed: this.boostersUsed }));
  }

  /** The page is being hidden or closed: pause and save the level as it is. */
  private leavePage(): void {
    if (this.state?.status !== 'playing') return;
    this.openPause();
    this.saveSnapshot();
  }

  // ---------------------------------------------------------------- boosters

  /** The level's theme; in development, ?theme= tries another theme's look and intro on any level. */
  private levelTheme(): string | undefined {
    return (import.meta.env.DEV ? parseThemeParam(window.location.search) : null) ?? this.level.theme;
  }

  /** The boosters unlocked at this level (by its number). */
  private unlockedBoosters(): BoosterId[] {
    return boostersUnlockedAt(playList[this.levelIndex]!.number);
  }

  private buildBoosterBar(): void {
    const { width, height } = viewSize(this);
    this.boosterBar.build(this.layout.side?.boosters ?? boosterBarRect(width, height, this.layout.hud.height), this.unlockedBoosters(), this.store.wallet.boosters);
    this.boosterBar.setActive(this.aiming ? 'removeTriple' : this.state.frozenMs > 0 ? 'freeze' : null);
  }

  /** A booster's first appearance: a one-line intro and its gift units (one at a time, if several are new). */
  private introduceBoosters(): void {
    const fresh = this.unlockedBoosters().find((id) => !this.store.wallet.introduced.includes(id));
    if (!fresh) return;
    this.store.introduceBooster(fresh);
    this.buildBoosterBar();
    this.paused = true;
    showOffer(this, {
      title: t('booster.new'),
      image: boosterTextureKey(fresh),
      body: `${t(`booster.${fresh}.name`)}: ${this.boosterIntro(fresh)} ${t('booster.gift', { n: ECONOMY.boosters[fresh].gift })}`,
      accept: null,
      decline: {
        label: t('offer.ok'),
        onPress: () => {
          this.paused = false;
          this.introduceBoosters();
        },
      },
    });
  }

  private boosterIntro(booster: BoosterId): string {
    return booster === 'freeze' ? t('booster.freeze.intro', { s: ECONOMY.boosters.freeze.seconds }) : t(`booster.${booster}.intro`);
  }

  /** A booster button: use one, or offer to buy one when none is left; a locked one says when it unlocks. */
  private pressBooster(booster: BoosterId): void {
    if (this.state.status !== 'playing' || this.overlay.visible || this.paused || this.themeIntro.visible) return;
    if (!this.unlockedBoosters().includes(booster)) {
      this.sfx.play('invalid');
      this.flashHint(t('shop.unlocksAt', { n: ECONOMY.boosters[booster].unlockLevel }));
      return;
    }
    if (this.store.wallet.boosters[booster] === 0) {
      this.offerBooster(booster);
      return;
    }
    this.holdBoard();
    if (booster === 'removeTriple') {
      this.setAiming(!this.aiming);
      return;
    }
    this.setAiming(false);
    const result = booster === 'freeze' ? freezeClock(startClock(this.state), ECONOMY.boosters.freeze.seconds * 1000) : shuffleBoard(this.state, Math.random);
    if (!result.ok) {
      this.sfx.play('invalid');
      return;
    }
    this.store.useBooster(booster);
    this.boostersUsed[booster]++;
    this.state = result.state;
    this.saveSnapshot();
    if (booster === 'shuffle') {
      this.sfx.play('advance');
      this.sync(DURATION.slow);
    } else {
      this.sfx.play('unlock');
    }
    this.buildBoosterBar();
  }

  /** A hint under the HUD for a moment (unless aiming, whose own hint stays). */
  private flashHint(text: string): void {
    if (this.aiming) return;
    this.hud.setHint(text);
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(1800, () => {
      if (!this.aiming) this.hud.setHint(null);
    });
  }

  /** Arms or disarms "remove a triple" (the next tap on an item removes its triple). */
  private setAiming(aiming: boolean): void {
    this.aiming = aiming;
    this.boosterBar.setActive(aiming ? 'removeTriple' : null);
    this.hud.setHint(aiming ? t('booster.tapItem') : null);
  }

  /** With "remove a triple" armed: removes the triple of the item tapped, if it is one that can be. */
  private aimAt(x: number, y: number): void {
    const hit = frontSlotAt(this.layout, x, y);
    const result = hit ? removeTriple(this.state, { shelf: hit.shelf, layer: 0, slot: hit.slot }) : null;
    if (!result?.ok) {
      this.sfx.play('invalid');
      return;
    }
    this.store.useBooster('removeTriple');
    this.boostersUsed.removeTriple++;
    this.setAiming(false);
    this.state = result.state;
    this.buildBoosterBar();
    this.play(result.events);
  }

  /** None left: offers to buy one with coins (or says there are not enough). */
  private offerBooster(booster: BoosterId): void {
    const coins = this.store.wallet.coins;
    const price = boosterPrice(booster);
    this.paused = true;
    const resume = () => {
      this.paused = false;
    };
    showOffer(this, {
      title: t('booster.buy.title', { name: t(`booster.${booster}.name`) }),
      image: boosterTextureKey(booster),
      body: coins >= price ? this.boosterIntro(booster) : t('booster.notEnough'),
      coins,
      accept:
        coins >= price
          ? {
              label: t('shop.buy'),
              price,
              onPress: () => {
                this.store.buyBooster(booster);
                this.buildBoosterBar();
                resume();
              },
            }
          : null,
      decline: { label: coins >= price ? t('offer.noThanks') : t('offer.ok'), onPress: resume },
    });
  }

  /**
   * After a defeat, if the attempt still has continues left (at most ECONOMY.continues.max). Out of time: more
   * seconds bought with coins, dearer each time (see extraTimePrice). Out of space or stuck: the boosters that fit
   * (see continueBoosters), each used from the player's own or bought at its shop price there and then: "remove a
   * triple" takes one away and "shuffle" mixes the board (only offered when a shuffle with a way on exists).
   * Giving up, or nothing to offer (no booster unlocked yet), shows the defeat panel.
   */
  private offerContinue(showLost: () => void): void {
    const reason = this.state.loseReason ?? 'blocked';
    const lost = this.state;
    const wallet = this.store.wallet;
    // Whatever way the player picks: the new state, then the board and HUD follow it.
    const carryOn = (state: GameState) => {
      this.continuesUsed++;
      this.state = state;
      this.overlay.hide();
      this.buildBoosterBar();
      this.hud.setTime(this.state.timeLeftMs, this.totalTimeMs());
    };
    const choices: ContinueChoice[] = [];
    if (reason === 'timeUp') {
      const price = extraTimePrice(this.continuesUsed);
      const { seconds } = ECONOMY.continues.time;
      if (price !== null) {
        choices.push({
          kind: 'time',
          seconds,
          price,
          onUse: () => {
            const result = addTime(lost, seconds * 1000);
            if (!result.ok || !this.store.spendCoins(price)) {
              showLost();
              return;
            }
            carryOn(result.state);
            this.sfx.play('unlock');
            this.saveSnapshot();
          },
        });
      }
    } else {
      const runs: Partial<Record<BoosterId, () => MoveResult>> = { removeTriple: () => continueAfterBlocked(lost) };
      const ids = continueBoosters(reason, playList[this.levelIndex]!.number, this.continuesUsed);
      if (ids.includes('shuffle')) {
        // Worked out now: offered only if a shuffle with a way on exists.
        const shuffled = continueByShuffling(lost, Math.random);
        if (shuffled.ok) runs.shuffle = () => shuffled;
      }
      for (const booster of ids) {
        const run = runs[booster];
        if (!run) continue;
        choices.push({
          kind: 'booster',
          booster,
          have: wallet.boosters[booster],
          price: boosterPrice(booster),
          onUse: () => {
            const result = run();
            if (!result.ok || !this.store.useOrBuyBooster(booster)) {
              showLost();
              return;
            }
            this.boostersUsed[booster]++;
            carryOn(result.state);
            if (booster === 'shuffle') {
              this.sfx.play('advance');
              this.sync(DURATION.slow);
              this.saveSnapshot();
            } else {
              this.play(result.events);
            }
          },
        });
      }
    }
    if (choices.length === 0) {
      showLost();
      return;
    }
    showContinue(this, {
      title: t(LOSE_TITLES[reason]),
      body: t(reason === 'timeUp' ? 'continue.time.body' : reason === 'blocked' ? 'continue.space.body' : 'continue.stuck.body'),
      coins: wallet.coins,
      choices,
      onGiveUp: showLost,
    });
  }

  /** Shows the tutorial, pointing at a move that completes a triple on the board as it is now. */
  private showTutorial(): void {
    if (!this.tutorialActive) return;
    const move = tutorialMove(this.state);
    const item = move && itemAt(this.state, move.from);
    this.tutorial.show({
      text: t('tutorial.firstTriple'),
      move,
      itemTexture: item ? itemTextureKey(item.type, this.store.colorBlindMode) : null,
    });
  }

  /** The player chose to skip the tutorial: done for good, as if completed. */
  private skipTutorial(): void {
    if (!this.tutorialActive) return;
    this.tutorialActive = false;
    this.store.markTutorialDone(FIRST_TRIPLE_TUTORIAL);
    this.tutorial.finish();
  }

  /** After a move during the tutorial: done for good with a triple, else it points at the board's new state. */
  private advanceTutorial(events: readonly GameEvent[]): void {
    if (!this.tutorialActive) return;
    if (completesFirstTriple(events)) {
      this.tutorialActive = false;
      this.store.markTutorialDone(FIRST_TRIPLE_TUTORIAL);
      this.tutorial.finish();
    } else {
      this.showTutorial();
    }
  }

  private createSprite(item: Item): void {
    // Not interactive: presses are matched to slots by layout (see onPointerDown), not to sprites.
    const sprite = this.add.image(0, 0, itemTextureKey(item.type, this.store.colorBlindMode)).setData('type', item.type);
    this.sprites.set(item.id, sprite);
  }

  /**
   * An item in front (its icon; in colour-blind mode with the variant mark), or behind another one (a dark,
   * blurred silhouette).
   */
  private setLook(sprite: Phaser.GameObjects.Image, front: boolean): void {
    const type = sprite.getData('type') as string;
    const key = front ? itemTextureKey(type, this.store.colorBlindMode) : itemBackTextureKey(type);
    // Called every frame for items on belts: nothing to do when the look is already right.
    if (sprite.texture.key === key) return;
    sprite.setTexture(key);
    // The silhouette texture carries its own flat colour: no tint either way.
    sprite.clearTint();
  }

  /** Colour-blind mode adds a colour-free mark to item variants: swaps the texture of every item in front. */
  private applyColorBlindMode(): void {
    for (const sprite of this.sprites.values()) {
      if (sprite.texture.key !== itemBackTextureKey(sprite.getData('type') as string)) this.setLook(sprite, true);
    }
    this.showTutorial();
  }

  /** Shows the win or defeat panel once the final animations have had time to play. */
  private endLevel(delay: number): void {
    // Won or lost: nothing to pick up any more (a continue saves the level again once it goes on).
    this.store.clearSnapshot();
    const { status, loseReason, timeLeftMs } = this.state;
    const score = this.state.combo.score;
    this.selectedId = null;
    this.hud.setCombo(0, 0, 0);
    this.pauseMenu.close();
    // Saved right away, when the level ends, not when the panel appears.
    const stars = starsFor(score, starThresholds(this.level));
    const totalBefore = this.store.totalStars;
    const starsBefore = this.store.bestStars(this.level.id) ?? 0;
    const record = status === 'won' ? this.store.recordWin(this.level.id, score, stars) : null;
    // The win's rewards: coins, experience (and any level-up gifts), and the chests the new stars reach.
    const rewards = record
      ? this.store.rewardWin({
          levelNumber: playList[this.levelIndex]!.number,
          firstClear: record.firstClear,
          stars,
          bestStarsBefore: starsBefore,
          score,
          totalStarsBefore: totalBefore,
          totalStarsAfter: this.store.totalStars,
        })
      : null;
    this.setAiming(false);
    const retry = () => this.transitionTo(this.levelIndex);
    if (status === 'lost') this.haptics.pulse('lose');
    this.time.delayedCall(delay, () => {
      if (record) {
        this.sfx.play('win');
        const bestLine = record.newBest
          ? t('result.newBest')
          : record.best !== null && record.best > score
            ? t('result.best', { score: formatScore(record.best, getLocale()) })
            : null;
        // After a win the player always goes back to the map: the stars land there and the next level waits.
        const ids = playList.map((entry) => entry.level.id);
        const arrival: Arrival = {
          level: this.levelIndex,
          starsBefore,
          starsAfter: record.bestStars,
          totalBefore,
          next: this.store.firstIncomplete(ids) ?? this.levelIndex,
          ...(rewards ? { rewards } : {}),
        };
        this.overlayNext = () => this.goHome(arrival);
        this.overlay.show({
          kind: 'won',
          title: t(this.levelIndex === playList.length - 1 ? 'result.allDone.title' : 'result.won.title'),
          stars,
          score,
          timeBonus: this.timeBonus,
          timeLeftMs,
          bestLine,
          newBest: record.newBest,
          coins: rewards?.coins ?? 0,
          next: () => this.goHome(arrival),
          replay: retry,
        });
      } else {
        this.sfx.play('lose');
        this.offerContinue(() =>
          this.overlay.show({ kind: 'lost', title: t(LOSE_TITLES[loseReason ?? 'blocked']), hint: t('result.lost.hint'), retry, home: () => this.goHome() }),
        );
      }
    });
  }

  /** The level's whole time, in ms (0 for an untimed level). */
  private totalTimeMs(): number {
    return (this.level.timeLimitSeconds ?? 0) * 1000;
  }

  /** An alert once when time starts running low, then a tick every second of the last ten. */
  private warnTicks(): void {
    const left = this.state.timeLeftMs;
    if (left === null || left <= 0) return;
    const stage = timeStage(left, this.totalTimeMs());
    if (stage !== this.timeStage) {
      if (stage === 'low') this.sfx.play('timeLow');
      this.timeStage = stage;
    }
    if (left > CRITICAL_TIME_MS) return;
    const second = Math.ceil(left / 1000);
    if (second !== this.lastWarningSecond) {
      this.lastWarningSecond = second;
      this.sfx.play('tick');
    }
  }

  // ---------------------------------------------------------------- layout & rendering

  private onResize(): void {
    this.relayout();
    this.sync(0);
  }

  private relayout(): void {
    fitCamera(this);
    const { width, height } = viewSize(this);
    this.base = layoutForLevel(this.level, this.state, width, height);
    this.refreshLive();
    this.hud.layout(width, this.layout);
    this.overlay.layout();
    this.pauseMenu.relayout();
    this.decor.draw(themeLook(this.levelTheme()), screenRect(this), this.layout, this.unlockedBoosters().length > 0);
    this.themeIntro.layout();
    this.tutorial.layout(width, height, this.layout, this.baseScale());
    this.buildBoosterBar();
    this.locks.relayout(this.layout);
    this.closing.relayout(this.layout);
    this.movingShelves.relayout(this.base, this.live.moving);
    this.placeBlocker();
    this.belt.relayout();
    this.drawBoard();
  }

  private placeBlocker(): void {
    const at = this.state.blocker?.at;
    this.blocker.place(at ? this.layout.shelves[at.shelf]!.slots[at.slot]! : null, this.layout.slotSize);
  }

  /** Fixed shelves; shelves riding tracks are drawn and moved by MovingShelves. */
  private drawBoard(): void {
    const fixed = this.base.shelves.filter((_, i) => !this.live.moving[i]).map((shelf) => shelf.rect);
    // Room for the brackets under each board.
    this.board.draw(boundsAround(fixed, this.base.slotSize * 0.3), (g) =>
      this.base.shelves.forEach((shelf, i) => {
        if (!this.live.moving[i]) art().drawShelf(g, shelf, this.base.slotSize);
      }),
    );
  }

  private baseScale(): number {
    return (this.layout.slotSize * ITEM_FILL) / ITEM_TEXTURE_SIZE;
  }

  private targetFor(itemId: number, pos: Position): SpriteTarget {
    const s = this.layout.slotSize;
    const shelf = this.layout.shelves[pos.shelf]!;
    const slot = shelf.slots[pos.slot]!;
    // In square slots (the game) every item is centred in its slot; taller test slots rest it on the base.
    const type = itemAt(this.state, pos)?.type;
    const fit = typeFit(type ?? '', slotAspect());
    const place = (scale: number) => ({ y: placeItem(slot.y, s, ITEM_FILL, fit, scale).y, scale: this.baseScale() * fit.scale * scale });

    if (pos.layer === 0) {
      const selected = itemId === this.selectedId;
      const at = place(selected ? SELECTED_SCALE : 1);
      return {
        x: slot.x,
        y: selected ? at.y - s * SELECTED_LIFT : at.y,
        scale: at.scale,
        alpha: 1,
        depth: DEPTH_FRONT,
        front: true,
      };
    }
    // The layer right behind the front sits under it, a silhouette seen only through an empty front slot;
    // deeper layers wait hidden.
    const at = place(BACK_SCALE);
    return {
      x: slot.x,
      y: at.y,
      scale: at.scale,
      alpha: pos.layer === 1 ? SILHOUETTE_ALPHA : 0,
      depth: DEPTH_BACK - pos.layer,
      front: false,
    };
  }

  /**
   * Moves every sprite to where the state says it is, tweening if duration > 0.
   * `delayFor` lets a caller stagger some sprites (e.g. a layer advancing after a triple pops).
   */
  private sync(duration: number, delayFor: (pos: Position) => number = () => 0, skip?: number): void {
    for (const [id, sprite] of this.sprites) {
      if (id === this.draggingId || id === skip) continue;
      // Belt items are positioned every frame by the belt and are taken with its own touch handling.
      if (this.belt.owns(id)) continue;
      const pos = findItem(this.state, id);
      if (!pos) {
        this.sprites.delete(id);
        sprite.destroy();
        continue;
      }
      const target = this.targetFor(id, pos);
      const { x, y, scale, alpha } = target;
      const applyLook = () => {
        sprite.setDepth(target.depth);
        this.setLook(sprite, target.front);
      };
      if (this.live.moving[pos.shelf]) {
        // Placed every frame by followMovingItems; animations become glides toward the moving slot.
        applyLook();
        if (duration > 0) this.fly(id, sprite, duration, delayFor(pos));
        else this.flights.delete(id);
        continue;
      }
      if (sprite.x === x && sprite.y === y && sprite.scale === scale && sprite.alpha === alpha) {
        sprite.setDepth(target.depth);
        continue;
      }

      this.tweens.killTweensOf(sprite);
      const delay = duration > 0 ? delayFor(pos) : 0;
      if (duration > 0) {
        this.tweens.add({
          targets: sprite,
          x,
          y,
          scale,
          alpha,
          duration,
          delay,
          ease: 'Cubic.easeOut',
          onStart: applyLook,
        });
      } else {
        applyLook();
        sprite.setPosition(x, y).setScale(scale).setAlpha(alpha);
      }
    }
  }

  // ---------------------------------------------------------------- input

  /**
   * A press on a front slot holding an item, on an unlocked shelf, may become a drag. The slot is found from
   * the layout, so an item still sliding forward from a back layer can be grabbed right away.
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.dragOccurred = false;
    this.sfx.unlock();
    this.pressOnIntro = this.themeIntro.visible;
    if (this.overlay.visible || this.pressOnIntro || this.paused) return;
    this.tutorial.setTouching(true);
    // Aiming "remove a triple": the tap is handled on release, nothing is picked up.
    if (this.aiming) return;
    if (this.belt.onPointerDown(pointer)) return;
    if (this.state.status !== 'playing' || this.shelfPress) return;
    this.pointerPos = pointerAt(pointer);
    const hit = frontSlotAt(this.layout, this.pointerPos.x, this.pointerPos.y);
    if (!hit || this.live.shelfAlpha[hit.shelf]! < MIN_INTERACTIVE_ALPHA) return;
    const item = itemAt(this.state, { shelf: hit.shelf, layer: 0, slot: hit.slot });
    // Touching an item starts the level's time (picking from a belt does it in the core).
    if (item) this.state = startClock(this.state);
    if (isShelfLocked(this.state, hit.shelf)) return;
    if (item) this.shelfPress = { pointerId: pointer.id, itemId: item.id, dragging: false };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.pointerPos = pointerAt(pointer);
    this.belt.onPointerMove(pointer);
    const press = this.shelfPress;
    if (!press || pointer.id !== press.pointerId || !pointer.isDown) return;
    if (!press.dragging) {
      if (pointer.getDistance() <= this.input.dragDistanceThreshold) return;
      press.dragging = this.startDrag(press.itemId);
      if (!press.dragging) {
        this.shelfPress = null;
        return;
      }
    }
    this.sprites.get(press.itemId)?.setPosition(this.pointerPos.x, this.pointerPos.y);
  }

  /** Lifts a shelf item to follow the pointer. Returns false if it can no longer be dragged. */
  private startDrag(id: number): boolean {
    const sprite = this.sprites.get(id);
    const from = findItem(this.state, id);
    if (!sprite || !from || from.layer !== 0 || this.state.status !== 'playing') return false;
    // Starting something else while a belt item waits for a destination sends it back to the belt.
    if (this.belt.holding) this.belt.sendBack(false);
    this.dragOccurred = true;
    this.draggingId = id;
    if (this.selectedId !== null) this.select(null);
    // Lift: the item grows a little and comes to the front while held.
    this.tweens.killTweensOf(sprite);
    sprite.setDepth(DEPTH_DRAG);
    // Tall items keep their size in the hand: only the pickup scale is added.
    const fit = typeFit(sprite.getData('type') as string, slotAspect()).scale;
    this.tweens.add({ targets: sprite, scale: this.baseScale() * fit * PICKUP_SCALE, duration: PICKUP_MS, ease: 'Quad.easeOut' });
    this.sfx.play('pick');
    return true;
  }

  private endDrag(pointer: Phaser.Input.Pointer, id: number): void {
    const sprite = this.sprites.get(id);
    if (!sprite || id !== this.draggingId) return;
    this.draggingId = null;
    const from = findItem(this.state, id);
    const at = pointerAt(pointer);
    const to = from && this.dropTarget(at.x, at.y, from);
    if (from && to && this.tryMove(from, to)) return;

    // Invalid drop: the item returns to its slot. Dropping it back where it was is not a mistake.
    const backHome = from !== null && to !== null && from.shelf === to.shelf && from.slot === to.slot;
    if (!backHome) this.sfx.play('invalid');
    if (from && this.live.moving[from.shelf]) {
      // Its shelf kept moving while it was dragged: glide back to where the slot is now.
      sprite.setDepth(this.targetFor(id, from).depth);
      this.fly(id, sprite, RETURN_MS);
    } else if (from) {
      const target = this.targetFor(id, from);
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        x: target.x,
        y: target.y,
        scale: target.scale,
        duration: RETURN_MS,
        ease: 'Back.easeOut',
        onComplete: () => sprite.setDepth(target.depth),
      });
    }
  }

  /**
   * Free slot on the shelf under the pointer, closest to it; an occupied slot if the shelf is full.
   * On the item's own shelf its original slot also counts, so letting go near it puts it back.
   * `from` is null for an item coming from the belt.
   */
  private dropTarget(x: number, y: number, from: Position | null): Position | null {
    const shelfIndex = this.interactiveShelfAt(x, y);
    if (shelfIndex === -1) return null;
    const shelf = this.layout.shelves[shelfIndex]!;
    const candidates = freeFrontSlots(this.state, shelfIndex);
    if (from && shelfIndex === from.shelf) candidates.push(from.slot);
    const slot = nearestFreeSlot(shelf, candidates, x) ?? nearestSlot(shelf, x);
    return { shelf: shelfIndex, layer: 0, slot };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.tutorial.setTouching(false);
    // The intro screen closes itself on this release; it is no tap on the board, and does not start the clock.
    if (this.pressOnIntro) {
      this.pressOnIntro = false;
      return;
    }
    // Presses that began on the belt are the belt's to finish, whatever the game state.
    if (this.belt.onPointerUp(pointer)) return;
    const press = this.shelfPress;
    if (press && pointer.id === press.pointerId) {
      this.shelfPress = null;
      if (press.dragging) {
        this.endDrag(pointer, press.itemId);
        return;
      }
    }
    if (this.dragOccurred || this.overlay.visible || this.paused || this.state.status !== 'playing') return;
    // A press that travelled (e.g. a drag attempt on a locked shelf) is not a tap where it ended.
    if (pointer.getDistance() > this.input.dragDistanceThreshold) return;
    const at = pointerAt(pointer);
    this.handleTap(at.x, at.y);
  }

  /** Tap an item to select it (tap again to deselect); then tap an empty slot (any shelf) to move it there. */
  private handleTap(x: number, y: number): void {
    if (this.aiming) {
      this.aimAt(x, y);
      return;
    }
    // With a belt item lifted by a tap, this tap says where it goes (or sends it back).
    if (this.belt.onTapWhileHolding(x, y)) return;
    // The slot under the finger at the moment of the tap, moving shelves included.
    const shelfIndex = this.interactiveShelfAt(x, y);
    if (shelfIndex === -1) {
      this.select(null);
      return;
    }
    if (isShelfLocked(this.state, shelfIndex)) {
      // Locked shelves ignore taps; a pending selection gets the usual "can't go there" shake.
      this.sfx.play('invalid');
      if (this.selectedId !== null) this.rejectFeedback(this.selectedId);
      return;
    }
    const shelfLayout = this.layout.shelves[shelfIndex]!;
    let tapped: Position = { shelf: shelfIndex, layer: 0, slot: nearestSlot(shelfLayout, x) };
    let item = itemAt(this.state, tapped);
    // A moving shelf is hard to hit exactly: with an item selected, a tap anywhere on it means "put it here",
    // in its free slot nearest to the finger (if it has none, the tap selects as usual).
    if (item && this.selectedId !== null && item.id !== this.selectedId && this.live.moving[shelfIndex]) {
      const free = nearestFreeSlot(shelfLayout, freeFrontSlots(this.state, shelfIndex), x);
      if (free !== undefined) {
        tapped = { shelf: shelfIndex, layer: 0, slot: free };
        item = null;
      }
    }
    if (item) {
      const deselect = item.id === this.selectedId;
      this.select(deselect ? null : item.id);
      if (!deselect) this.sfx.play('pick');
      return;
    }
    if (this.selectedId === null) return;

    const from = findItem(this.state, this.selectedId);
    if (from && !this.tryMove(from, tapped)) {
      this.sfx.play('invalid');
      this.rejectFeedback(this.selectedId);
    }
  }

  private select(itemId: number | null): void {
    if (itemId === this.selectedId) return;
    this.selectedId = itemId;
    this.sync(SELECT_MS);
  }

  private rejectFeedback(itemId: number): void {
    const sprite = this.sprites.get(itemId);
    const pos = findItem(this.state, itemId);
    if (!sprite || !pos) return;
    const { x } = this.targetFor(itemId, pos);
    this.tweens.killTweensOf(sprite);
    sprite.setX(x);
    this.tweens.add({ targets: sprite, x: x + this.layout.slotSize * 0.08, duration: 50, yoyo: true, repeat: 2 });
  }

  // ---------------------------------------------------------------- core actions & animation

  private tryMove(from: Position, to: Position): boolean {
    const result = moveItem(this.state, from, to);
    if (!result.ok) return false;
    this.selectedId = null;
    this.state = result.state;
    this.play(result.events);
    return true;
  }

  /**
   * Animates core events: the item snaps into its slot, cleared triples pop, back layers slide forward.
   * Nothing here blocks input: the next move already works on the new state.
   */
  private play(events: readonly GameEvent[]): void {
    let moved: { itemId: number; to: Position } | undefined;
    const advancedShelves = new Set<number>();
    const cleared: number[] = [];
    // A triple taken by the booster first gathers (see gatherTriple); everything after it waits for that.
    const gathered = new Map<GameEvent, { x: number; y: number }>();
    for (const event of events) {
      if (event.kind === 'tripleCleared' && event.byBooster) gathered.set(event, this.gatherTriple(event.itemIds));
    }
    const lead = gathered.size > 0 ? GATHER_MS : 0;
    for (const event of events) {
      if (event.kind === 'moved' || event.kind === 'beltItemPlaced') moved = event;
      else if (event.kind === 'layerAdvanced') advancedShelves.add(event.shelf);
      else if (event.kind === 'tripleCleared' && !gathered.has(event)) cleared.push(...event.itemIds);
      else if (event.kind === 'timeBonus') this.timeBonus = event.points;
    }

    // Snap: the moved item drops into its slot with a slight overshoot.
    if (moved) {
      const sprite = this.sprites.get(moved.itemId);
      if (sprite && this.live.moving[moved.to.shelf]) {
        // Onto a moving shelf: glide to the slot where it is on each frame, not where it was at the drop.
        sprite.setDepth(this.targetFor(moved.itemId, moved.to).depth);
        this.fly(moved.itemId, sprite, SNAP_MS);
      } else if (sprite) {
        const target = this.targetFor(moved.itemId, moved.to);
        this.tweens.killTweensOf(sprite);
        sprite.setDepth(DEPTH_DRAG);
        this.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          scale: target.scale,
          duration: SNAP_MS,
          ease: 'Back.easeOut',
          onComplete: () => sprite.setDepth(target.depth),
        });
      }
    }
    this.sfx.play('drop');

    // Pop: cleared items leave the board right away (no input on them) and burst once the move lands.
    for (const id of cleared) {
      const sprite = this.sprites.get(id);
      if (!sprite) continue;
      this.sprites.delete(id);
      sprite.disableInteractive();
      this.tweens.add({
        targets: sprite,
        scale: sprite.scale * 1.35,
        alpha: 0,
        delay: CLEAR_DELAY_MS + lead,
        duration: CLEAR_MS,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
    }
    if (cleared.length > 0 || lead > 0) this.time.delayedCall(CLEAR_DELAY_MS + lead, () => this.sfx.play('clear'));
    if (advancedShelves.size > 0) this.time.delayedCall(ADVANCE_DELAY_MS + lead, () => this.sfx.play('advance'));

    // Advance: items behind slide forward after the pop; everything else settles immediately.
    this.sync(ADVANCE_MS, (pos) => (advancedShelves.has(pos.shelf) ? ADVANCE_DELAY_MS + lead : 0), moved?.itemId);
    this.playMechanics(events, lead, gathered);
    this.advanceTutorial(events);

    if (this.state.status === 'won') {
      const { width, height } = viewSize(this);
      this.time.delayedCall(CLEAR_DELAY_MS + CLEAR_MS, () => this.effects.celebrate(width, height));
      this.endLevel(RESULT_DELAY_MS);
    } else if (this.state.status === 'lost') {
      // No space left, or no move that can lead anywhere: the shelves flash red and the board shakes before the
      // panel says so, with the reason.
      const reason = t(LOSE_TITLES[this.state.loseReason ?? 'blocked']);
      this.time.delayedCall(SNAP_MS, () => {
        this.sfx.play('blocked');
        this.effects.blockedWarning(this.layout.shelves.map((shelf) => shelf.rect), BLOCKED_WARNING_MS, reason);
      });
      this.endLevel(SNAP_MS + BLOCKED_WARNING_MS);
    } else {
      // After every move: a reload picks the level up from here.
      this.saveSnapshot();
    }
  }

  /**
   * "Remove a triple": its three items, wherever they are (in view, in a back layer, deep in a track's stack), fly
   * together side by side at the one the player tapped, in full view, and then pop. So it is clear the whole
   * triple went. Returns where they gathered.
   */
  private gatherTriple(ids: readonly number[]): { x: number; y: number } {
    const sprites = ids.map((id) => this.sprites.get(id)).filter((sprite): sprite is Phaser.GameObjects.Image => sprite !== undefined);
    // The item tapped comes first; the others join it.
    const anchor = sprites[0];
    if (!anchor) return { x: 0, y: 0 };
    const { width } = viewSize(this);
    const scale = anchor.scale;
    const step = Math.min(this.layout.slotSize, anchor.displayWidth * 1.05);
    const x = Math.max(step * 1.5, Math.min(width - step * 1.5, anchor.x));
    const y = anchor.y;
    sprites.forEach((sprite, i) => {
      const id = ids[i]!;
      this.sprites.delete(id);
      this.flights.delete(id);
      this.tweens.killTweensOf(sprite);
      sprite.disableInteractive();
      // Hidden ones (back layers, deep in a stack) come into full view as they fly.
      sprite.setVisible(true).setDepth(DEPTH_DRAG + 1);
      this.setLook(sprite, true);
      const offset = i === 0 ? 0 : i === 1 ? -step : step;
      this.tweens.chain({
        targets: sprite,
        tweens: [
          { x: x + offset, y, scale, alpha: 1, duration: GATHER_MS, ease: 'Cubic.easeInOut' },
          { scale: scale * 1.35, alpha: 0, delay: CLEAR_DELAY_MS, duration: CLEAR_MS, ease: 'Quad.easeIn' },
        ],
        onComplete: () => sprite.destroy(),
      });
    });
    return { x, y };
  }

  /** Score and combo popups, shelf unlocks and blocker hops, timed to land with the triple pop. */
  private playMechanics(events: readonly GameEvent[], lead = 0, gathered: ReadonlyMap<GameEvent, { x: number; y: number }> = new Map()): void {
    const popAt = CLEAR_DELAY_MS + lead;
    let combo = 0;
    let blockerTo: { shelf: number; slot: number } | null = null;
    for (const event of events) {
      switch (event.kind) {
        case 'comboChanged':
          combo = event.combo;
          break;
        case 'tripleCleared': {
          // A triple the booster took bursts where its items gathered.
          const point = gathered.get(event);
          if (point) {
            this.time.delayedCall(popAt, () => this.effects.tripleBurst(point.x, point.y, this.layout.slotSize * 2, 1));
            this.haptics.pulse('triple');
            break;
          }
          const shelf = this.layout.shelves[event.shelf];
          if (!shelf) break;
          const { rect } = shelf;
          const at = { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.45 };
          const chain = combo;
          this.time.delayedCall(popAt, () => this.effects.tripleBurst(at.x, at.y, rect.width, Math.max(1, chain + 1)));
          this.haptics.pulse('triple');
          break;
        }
        case 'scoreChanged': {
          const { rect } = this.layout.shelves[event.shelf]!;
          const x = rect.x + rect.width / 2;
          // The points fly to the score pill, which counts up as they land.
          const score = event.score;
          this.effects.flyPoints(t('popup.points', { points: event.delta }), { x, y: rect.y + rect.height * 0.35 }, this.hud.scoreAnchor(), popAt, () => {
            this.hud.setScore(score, true);
            this.hud.bumpScore();
          });
          if (combo >= 2) {
            this.effects.comboBurst(x, rect.y - this.layout.slotSize * 0.55, combo, popAt + 60, viewSize(this).width);
            if (combo >= 4) this.haptics.pulse('combo');
            this.time.delayedCall(popAt, () => {
              this.sfx.play('combo', combo);
              this.hud.pulseCombo();
            });
          }
          break;
        }
        case 'shelfClosed': {
          // Boarded up once the move lands (and after any pop that emptied it).
          this.closing.close(event.shelf, popAt + CLEAR_MS, reducedMotion());
          this.time.delayedCall(popAt + CLEAR_MS, () => this.sfx.play('shelfClosed'));
          break;
        }
        case 'shelfUnlocked': {
          const { rect } = this.layout.shelves[event.shelf]!;
          this.time.delayedCall(popAt + 120, () => {
            this.locks.unlock(event.shelf);
            this.sfx.play('unlock');
            // The shelf's items become draggable now.
            this.sync(0);
          });
          this.effects.unlockBurst(rect, popAt + 120);
          this.popup(rect.x + rect.width / 2, rect.y + rect.height / 2, t('popup.unlocked'), SKIN.text.accent, popAt + 120);
          break;
        }
        case 'blockerMoved':
          blockerTo = event.to;
          break;
        case 'blockerRemoved': {
          const slot = this.layout.shelves[event.at.shelf]!.slots[event.at.slot]!;
          this.blocker.remove(popAt);
          this.effects.crateBreak(slot.x, slot.y, popAt);
          this.popup(slot.x, slot.y - this.layout.slotSize * 0.6, t('popup.blockerRemoved'), SKIN.status.combo, popAt);
          this.time.delayedCall(popAt, () => this.sfx.play('blockerGone'));
          break;
        }
        default:
          break;
      }
    }
    if (blockerTo) {
      // Several triples in one move mean several jumps; animate straight to the last slot.
      const to = blockerTo;
      // Read every frame: on a moving shelf the slot keeps moving while the plate is in the air.
      this.blocker.hop(() => this.layout.shelves[to.shelf]!.slots[to.slot]!, popAt + CLEAR_MS);
      this.time.delayedCall(popAt + CLEAR_MS, () => this.sfx.play('blockerMove'));
    }
    this.state.shelves.forEach((_, shelf) => {
      if (isShelfLocked(this.state, shelf)) this.locks.setRemaining(shelf, triplesToUnlock(this.state, shelf));
    });
  }

  /** Floating text that rises and fades. */
  private popup(x: number, y: number, text: string, color: string, delay: number): void {
    const label = kitText(this, 'number', text, color, Math.round(Math.max(18, this.layout.slotSize * 0.34)))
      .setStroke(SKIN.surface.border, 5)
      .setPosition(x, y)
      .setDepth(DEPTH_POPUP)
      .setAlpha(0);
    this.popups.add(label);
    this.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0 },
      y: y - this.layout.slotSize * 0.6,
      delay,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.popups.delete(label);
        label.destroy();
      },
    });
  }
}
