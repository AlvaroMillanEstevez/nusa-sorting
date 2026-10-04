import * as Phaser from 'phaser';
import {
  createGame,
  findItem,
  freeFrontSlots,
  isShelfLocked,
  isSlotBlocked,
  itemAt,
  moveItem,
  tick,
  triplesToUnlock,
  type GameEvent,
  type GameState,
  type Item,
  type LevelDefinition,
  type LoseReason,
  type Position,
  stackOf,
} from '../core';
import { levels } from '../data/levels';
import { applyBeltOverrides } from '../dev/beltOverrides';
import { parseLevelParam } from '../dev/levelParam';
import { t, type MessageKey } from '../i18n';
import type { ProgressStore } from '../services/ProgressStore';
import type { SoundService } from '../services/SoundService';
import {
  BACK_SCALE,
  SILHOUETTE_ALPHA,
  SILHOUETTE_TINT,
  frontSlotAt,
  nearestFreeSlot,
  nearestSlot,
  shelfAt,
  boundsAround,
  type BoardLayout,
} from '../ui/boardLayout';
import { formatTime } from '../ui/format';
import { ITEM_FILL, layoutForLevel, liveBoard, type LiveBoard } from '../ui/levelLayout';
import { theme } from '../ui/theme';
import { art } from './art/ArtSet';
import { BakedLayer } from './art/BakedLayer';
import { BeltController } from './BeltController';
import { BlockerView, LockOverlays } from './BoardDecor';
import { Hud, WARNING_MS } from './Hud';
import { ITEM_TEXTURE_SIZE, itemBackTextureKey, itemTextureKey } from './itemTextures';
import type { LevelSelectData } from './LevelSelectScene';
import { MovingShelves } from './MovingShelves';
import { ResultOverlay } from './ResultOverlay';
import { fitCamera, pointerAt, RENDER_RATIO, viewSize } from './view';

const SELECTED_LIFT = 0.15;
const SELECTED_SCALE = 1.12;
const PICKUP_SCALE = 1.18;

// Animations are visual only: the core state is already final, so input is never locked while they play.
const PICKUP_MS = 80;
const SNAP_MS = 130;
const RETURN_MS = 160;
const CLEAR_DELAY_MS = 90;
const CLEAR_MS = 200;
const ADVANCE_DELAY_MS = CLEAR_DELAY_MS + 120;
const ADVANCE_MS = 200;
const SELECT_MS = 90;
/** Pause after the last animation before the result panel appears. */
const RESULT_DELAY_MS = 550;
const FADE_MS = 220;

const DEPTH_BACK = 5;
const DEPTH_FRONT = 10;
const DEPTH_DRAG = 100;
/** The drop-target outline: over shelves and empty slots, under items. */
const DEPTH_DROP_MARK = 9;
/** Shelves riding a track this faded out (at the ends of their loop) take no taps and no drops. */
const MIN_INTERACTIVE_ALPHA = 0.3;
const DEPTH_POPUP = 120;

const LOSE_TITLES: Record<LoseReason, MessageKey> = {
  timeUp: 'result.lost.timeUp',
  blocked: 'result.lost.blocked',
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
  private locks!: LockOverlays;
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

  constructor(
    private readonly sfx: SoundService,
    private readonly store: ProgressStore,
  ) {
    super('Game');
  }

  create(): void {
    this.board = new BakedLayer(this, 0);
    this.movingShelves = new MovingShelves(this);
    this.dropMark = this.add.graphics().setDepth(DEPTH_DROP_MARK);
    this.locks = new LockOverlays(this);
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
    this.hud = new Hud(this, {
      onRestart: () => this.transitionTo(this.levelIndex),
      onToggleMute: () => {
        this.sfx.setMuted(!this.sfx.muted);
        this.hud.setMuted(this.sfx.muted);
        // Settings are saved when they change.
        this.store.setMuted(this.sfx.muted);
      },
      onLevels: () => this.openLevelList(),
    });
    this.hud.setMuted(this.sfx.muted);
    this.overlay = new ResultOverlay(this);

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

    // Straight into play: the first level not completed yet (level 1 on a first visit). With everything
    // completed, show the list over the last level. Dev builds can force a level with ?level=N.
    const ids = levels.map((level) => level.id);
    const devLevel = import.meta.env.DEV ? parseLevelParam(window.location.search, levels.length) : null;
    const next = this.store.firstIncomplete(ids);
    this.loadLevel(devLevel ?? next ?? levels.length - 1);
    if (devLevel === null && next === null) this.openLevelList();
  }

  /** Pauses the game (clock and belt included) and shows the level list on top. */
  private openLevelList(): void {
    if (this.scene.isPaused()) return;
    if (this.belt.holding) this.belt.sendBack(false);
    this.select(null);
    const data: LevelSelectData = {
      currentIndex: this.levelIndex,
      onChoose: (index) => {
        this.scene.resume();
        this.transitionTo(index);
      },
      onClose: () => this.scene.resume(),
      onColorBlindModeChanged: () => this.applyColorBlindMode(),
    };
    this.scene.launch('LevelSelect', data);
    this.scene.pause();
  }

  override update(_time: number, delta: number): void {
    if (this.state.status === 'playing') {
      const result = tick(this.state, delta);
      this.state = result.state;
      this.hud.setTime(this.state.timeLeftMs);
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
    const slot = this.layout.shelves[target.shelf]!.slots[target.slot]!;
    const s = this.layout.slotSize;
    const size = s * 0.96;
    const color = Phaser.Display.Color.HexStringToColor(theme.comboColor).color;
    g.lineStyle(Math.max(3, s * 0.07), color, 1).strokeRoundedRect(slot.x - size / 2, slot.y - size / 2, size, size, s * 0.14);
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

  private loadLevel(index: number): void {
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

    this.levelIndex = index;
    // Development only: ?beltSpeed= and ?beltSlots= retune the conveyor while playing.
    this.level = import.meta.env.DEV ? applyBeltOverrides(levels[index]!, window.location.search) : levels[index]!;
    this.state = createGame(this.level);
    for (const shelf of this.state.shelves) {
      for (const layer of shelf.layers) {
        for (const item of layer) if (item) this.createSprite(item);
      }
    }
    for (const track of this.state.tracks) {
      for (const carrier of track.carriers) for (const item of stackOf(carrier)) this.createSprite(item);
    }
    this.belt.reset(this.state);
    this.hud.setLevel(index + 1);
    this.hud.setTime(this.state.timeLeftMs);
    this.hud.setScore(this.state.combo.score, false);
    this.hud.setCombo(0, 0, 0);
    const locked = new Map<number, number>();
    this.state.shelves.forEach((_, shelf) => {
      if (isShelfLocked(this.state, shelf)) locked.set(shelf, triplesToUnlock(this.state, shelf));
    });
    this.locks.reset(locked);
    this.relayout();
    this.sync(0);
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
    if (front) sprite.clearTint();
    else sprite.setTint(SILHOUETTE_TINT);
  }

  /** Colour-blind mode adds a colour-free mark to item variants: swaps the texture of every item in front. */
  private applyColorBlindMode(): void {
    for (const sprite of this.sprites.values()) {
      if (sprite.texture.key !== itemBackTextureKey(sprite.getData('type') as string)) this.setLook(sprite, true);
    }
  }

  /** Shows the win or defeat panel once the final animations have had time to play. */
  private endLevel(delay: number): void {
    const { status, loseReason, timeLeftMs } = this.state;
    const score = this.state.combo.score;
    this.selectedId = null;
    this.hud.setCombo(0, 0, 0);
    // Saved right away, when the level ends, not when the panel appears.
    const record = status === 'won' ? this.store.recordWin(this.level.id, score) : null;
    const levelsButton = { label: t('result.levels'), onPress: () => this.openLevelList() };
    this.time.delayedCall(delay, () => {
      if (record) {
        this.sfx.play('win');
        const isLast = this.levelIndex === levels.length - 1;
        const bestLine = record.newBest
          ? t('result.newBest')
          : record.best !== null && score !== null && record.best > score
            ? t('result.best', { score: record.best })
            : null;
        const lines = [
          timeLeftMs === null ? null : t('result.won.timeLeft', { time: formatTime(timeLeftMs) }),
          score === null ? null : t('result.won.score', { score }),
          bestLine,
        ];
        this.overlay.show({
          title: t(isLast ? 'result.allDone.title' : 'result.won.title'),
          subtitle: lines.filter((line) => line !== null).join('\n'),
          primary: {
            label: t(isLast ? 'result.playAgain' : 'result.next'),
            onPress: () => this.transitionTo(isLast ? 0 : this.levelIndex + 1),
          },
          secondary: levelsButton,
        });
      } else {
        this.sfx.play('lose');
        this.overlay.show({
          title: t(LOSE_TITLES[loseReason ?? 'blocked']),
          subtitle: t('result.lost.hint'),
          primary: { label: t('result.retry'), onPress: () => this.transitionTo(this.levelIndex) },
          secondary: levelsButton,
        });
      }
    });
  }

  private warnTicks(): void {
    const left = this.state.timeLeftMs;
    if (left === null || left > WARNING_MS || left <= 0) return;
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
    this.hud.layout(width, this.layout.hudRowHeight, this.layout.statusRow, this.layout.statusInline);
    this.overlay.layout(width, height);
    this.locks.relayout(this.layout);
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

    if (pos.layer === 0) {
      const slot = shelf.slots[pos.slot]!;
      const selected = itemId === this.selectedId;
      return {
        x: slot.x,
        y: selected ? slot.y - s * SELECTED_LIFT : slot.y,
        scale: selected ? this.baseScale() * SELECTED_SCALE : this.baseScale(),
        alpha: 1,
        depth: DEPTH_FRONT,
        front: true,
      };
    }
    // The layer right behind the front sits under it, a silhouette seen only through an empty front slot;
    // deeper layers wait hidden.
    const slot = shelf.slots[pos.slot]!;
    return {
      x: slot.x,
      y: slot.y,
      scale: this.baseScale() * BACK_SCALE,
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
    if (this.overlay.visible) return;
    if (this.belt.onPointerDown(pointer)) return;
    if (this.state.status !== 'playing' || this.shelfPress) return;
    this.pointerPos = pointerAt(pointer);
    const hit = frontSlotAt(this.layout, this.pointerPos.x, this.pointerPos.y);
    if (!hit || isShelfLocked(this.state, hit.shelf) || this.live.shelfAlpha[hit.shelf]! < MIN_INTERACTIVE_ALPHA) return;
    const item = itemAt(this.state, { shelf: hit.shelf, layer: 0, slot: hit.slot });
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
    this.tweens.add({ targets: sprite, scale: this.baseScale() * PICKUP_SCALE, duration: PICKUP_MS, ease: 'Quad.easeOut' });
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
    if (this.dragOccurred || this.overlay.visible || this.state.status !== 'playing') return;
    // A press that travelled (e.g. a drag attempt on a locked shelf) is not a tap where it ended.
    if (pointer.getDistance() > this.input.dragDistanceThreshold) return;
    const at = pointerAt(pointer);
    this.handleTap(at.x, at.y);
  }

  /** Tap an item to select it (tap again to deselect); then tap an empty slot (any shelf) to move it there. */
  private handleTap(x: number, y: number): void {
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
    for (const event of events) {
      if (event.kind === 'moved' || event.kind === 'beltItemPlaced') moved = event;
      else if (event.kind === 'layerAdvanced') advancedShelves.add(event.shelf);
      else if (event.kind === 'tripleCleared') cleared.push(...event.itemIds);
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
        delay: CLEAR_DELAY_MS,
        duration: CLEAR_MS,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
    }
    if (cleared.length > 0) this.time.delayedCall(CLEAR_DELAY_MS, () => this.sfx.play('clear'));
    if (advancedShelves.size > 0) this.time.delayedCall(ADVANCE_DELAY_MS, () => this.sfx.play('advance'));

    // Advance: items behind slide forward after the pop; everything else settles immediately.
    this.sync(ADVANCE_MS, (pos) => (advancedShelves.has(pos.shelf) ? ADVANCE_DELAY_MS : 0), moved?.itemId);
    this.playMechanics(events);

    if (this.state.status !== 'playing') this.endLevel(RESULT_DELAY_MS);
  }

  /** Score and combo popups, shelf unlocks and blocker hops, timed to land with the triple pop. */
  private playMechanics(events: readonly GameEvent[]): void {
    const popAt = CLEAR_DELAY_MS;
    let combo = 0;
    let blockerTo: { shelf: number; slot: number } | null = null;
    for (const event of events) {
      switch (event.kind) {
        case 'comboChanged':
          combo = event.combo;
          break;
        case 'scoreChanged': {
          const { rect } = this.layout.shelves[event.shelf]!;
          const x = rect.x + rect.width / 2;
          this.popup(x, rect.y + rect.height * 0.35, t('popup.points', { points: event.delta }), theme.textColor, popAt);
          if (combo >= 2) {
            this.popup(x, rect.y, t('popup.combo', { n: combo }), theme.comboColor, popAt + 60);
            this.time.delayedCall(popAt, () => {
              this.sfx.play('combo');
              this.hud.pulseCombo();
            });
          }
          this.time.delayedCall(popAt, () => this.hud.setScore(event.score, true));
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
          this.popup(rect.x + rect.width / 2, rect.y + rect.height / 2, t('popup.unlocked'), theme.titleColor, popAt + 120);
          break;
        }
        case 'blockerMoved':
          blockerTo = event.to;
          break;
        case 'blockerRemoved': {
          const slot = this.layout.shelves[event.at.shelf]!.slots[event.at.slot]!;
          this.blocker.remove(popAt);
          this.popup(slot.x, slot.y - this.layout.slotSize * 0.6, t('popup.blockerRemoved'), theme.comboColor, popAt);
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
    const label = this.add
      .text(x, y, text, { fontFamily: theme.fontFamily, fontStyle: 'bold', color, stroke: '#1b2a3a', strokeThickness: 4 })
      .setOrigin(0.5)
      .setResolution(RENDER_RATIO)
      .setFontSize(Math.round(Math.max(16, this.layout.slotSize * 0.32)))
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
