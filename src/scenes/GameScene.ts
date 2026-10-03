import * as Phaser from 'phaser';
import {
  createGame,
  findItem,
  freeFrontSlots,
  itemAt,
  moveItem,
  tick,
  type GameEvent,
  type GameState,
  type Item,
  type LevelDefinition,
  type LoseReason,
  type Position,
} from '../core';
import { levels } from '../data/levels';
import { t, type MessageKey } from '../i18n';
import type { SoundService } from '../services/SoundService';
import { BACK_SCALE, computeBoardLayout, nearestFreeSlot, nearestSlot, shelfAt, type BoardLayout } from '../ui/boardLayout';
import { formatTime } from '../ui/format';
import { theme } from '../ui/theme';
import { Hud, WARNING_MS } from './Hud';
import { ensureItemTexture, ITEM_TEXTURE_SIZE } from './itemTextures';
import { ResultOverlay } from './ResultOverlay';

/** Item size relative to its slot. */
const ITEM_FILL = 0.86;
const BACK_TINT = 0x777777;
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
  private layout!: BoardLayout;

  private board!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private overlay!: ResultOverlay;

  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly spriteIds = new WeakMap<Phaser.GameObjects.GameObject, number>();

  private selectedId: number | null = null;
  private draggingId: number | null = null;
  /** Set when the current pointer press turned into a drag, so its pointerup is not a tap. */
  private dragOccurred = false;
  private lastWarningSecond: number | null = null;

  constructor(private readonly sfx: SoundService) {
    super('Game');
  }

  create(): void {
    this.board = this.add.graphics();
    this.hud = new Hud(this, {
      onRestart: () => this.transitionTo(this.levelIndex),
      onToggleMute: () => {
        this.sfx.setMuted(!this.sfx.muted);
        this.hud.setMuted(this.sfx.muted);
      },
    });
    this.hud.setMuted(this.sfx.muted);
    this.overlay = new ResultOverlay(this);

    // A small movement threshold keeps taps from being read as drags, especially with fingers.
    this.input.dragDistanceThreshold = 8;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.dragOccurred = false;
      this.sfx.unlock();
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.DRAG_START, this.onDragStart, this);
    this.input.on(Phaser.Input.Events.DRAG, this.onDrag, this);
    this.input.on(Phaser.Input.Events.DRAG_END, this.onDragEnd, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.loadLevel(0);
  }

  override update(_time: number, delta: number): void {
    if (this.state.status !== 'playing') return;
    const result = tick(this.state, delta);
    this.state = result.state;
    this.hud.setTime(this.state.timeLeftMs);
    this.warnTicks();
    if (result.events.some((e) => e.kind === 'lost')) this.endLevel(0);
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
    this.selectedId = null;
    this.draggingId = null;
    this.lastWarningSecond = null;
    this.overlay.hide();

    this.levelIndex = index;
    this.level = levels[index]!;
    this.state = createGame(this.level);
    for (const shelf of this.state.shelves) {
      for (const layer of shelf.layers) {
        for (const item of layer) if (item) this.createSprite(item);
      }
    }
    this.hud.setLevel(index + 1);
    this.hud.setTime(this.state.timeLeftMs);
    this.relayout();
    this.sync(0);
  }

  private createSprite(item: Item): void {
    const sprite = this.add.image(0, 0, ensureItemTexture(this, item.type)).setInteractive({ draggable: true });
    this.sprites.set(item.id, sprite);
    this.spriteIds.set(sprite, item.id);
  }

  /** Shows the win or defeat panel once the final animations have had time to play. */
  private endLevel(delay: number): void {
    const { status, loseReason, timeLeftMs } = this.state;
    this.selectedId = null;
    this.time.delayedCall(delay, () => {
      if (status === 'won') {
        this.sfx.play('win');
        const isLast = this.levelIndex === levels.length - 1;
        this.overlay.show({
          title: t(isLast ? 'result.allDone.title' : 'result.won.title'),
          subtitle: timeLeftMs === null ? '' : t('result.won.timeLeft', { time: formatTime(timeLeftMs) }),
          button: t(isLast ? 'result.playAgain' : 'result.next'),
          onButton: () => this.transitionTo(isLast ? 0 : this.levelIndex + 1),
        });
      } else {
        this.sfx.play('lose');
        this.overlay.show({
          title: t(LOSE_TITLES[loseReason ?? 'blocked']),
          subtitle: t('result.lost.hint'),
          button: t('result.retry'),
          onButton: () => this.transitionTo(this.levelIndex),
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
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setSize(width, height);
    this.layout = computeBoardLayout(width, height, this.level.shelves.length);
    this.hud.layout(width, this.layout.hud.height);
    this.overlay.layout(width, height);
    this.drawBoard();
  }

  private drawBoard(): void {
    const g = this.board.clear();
    const s = this.layout.slotSize;
    for (const shelf of this.layout.shelves) {
      const { rect } = shelf;
      g.fillStyle(theme.shelfBack, 1);
      g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, s * 0.12);

      const guide = s * 0.9;
      g.fillStyle(theme.slotGuide, 1);
      for (const slot of shelf.slots) {
        g.fillRoundedRect(slot.x - guide / 2, slot.y - guide / 2, guide, guide, s * 0.1);
      }

      const plankTop = shelf.slots[0]!.y + s / 2;
      g.fillStyle(theme.shelfPlank, 1);
      g.fillRoundedRect(rect.x, plankTop, rect.width, rect.y + rect.height - plankTop, s * 0.05);
    }
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
    // Only the layer right behind the front is visible (dimmed); deeper layers wait hidden behind it.
    const slot = shelf.backSlots[pos.slot]!;
    return {
      x: slot.x,
      y: slot.y,
      scale: this.baseScale() * BACK_SCALE,
      alpha: pos.layer === 1 ? 1 : 0,
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
      const pos = findItem(this.state, id);
      if (!pos) {
        this.sprites.delete(id);
        sprite.destroy();
        continue;
      }
      const target = this.targetFor(id, pos);
      if (sprite.input) sprite.input.enabled = target.front && this.state.status === 'playing';
      const { x, y, scale, alpha } = target;
      if (sprite.x === x && sprite.y === y && sprite.scale === scale && sprite.alpha === alpha) {
        sprite.setDepth(target.depth);
        continue;
      }

      this.tweens.killTweensOf(sprite);
      const delay = duration > 0 ? delayFor(pos) : 0;
      const applyLook = () => {
        sprite.setDepth(target.depth);
        if (target.front) sprite.clearTint();
        else sprite.setTint(BACK_TINT);
      };
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

  private onDragStart(_pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image): void {
    const id = this.spriteIds.get(sprite);
    if (id === undefined || this.state.status !== 'playing') return;
    this.dragOccurred = true;
    this.draggingId = id;
    if (this.selectedId !== null) this.select(null);
    // Lift: the item grows a little and comes to the front while held.
    this.tweens.killTweensOf(sprite);
    sprite.setDepth(DEPTH_DRAG);
    this.tweens.add({ targets: sprite, scale: this.baseScale() * PICKUP_SCALE, duration: PICKUP_MS, ease: 'Quad.easeOut' });
    this.sfx.play('pick');
  }

  private onDrag(_pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image, dragX: number, dragY: number): void {
    if (this.spriteIds.get(sprite) !== this.draggingId) return;
    sprite.setPosition(dragX, dragY);
  }

  private onDragEnd(pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image): void {
    const id = this.spriteIds.get(sprite);
    if (id === undefined || id !== this.draggingId) return;
    this.draggingId = null;
    const from = findItem(this.state, id);
    const to = from && this.dropTarget(pointer.x, pointer.y, from);
    if (from && to && this.tryMove(from, to)) return;

    // Invalid drop: the item returns to its slot. Dropping it back where it was is not a mistake.
    const backHome = from !== null && to !== null && from.shelf === to.shelf && from.slot === to.slot;
    if (!backHome) this.sfx.play('invalid');
    if (from) {
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
   */
  private dropTarget(x: number, y: number, from: Position): Position | null {
    const shelfIndex = shelfAt(this.layout, x, y);
    if (shelfIndex === -1) return null;
    const shelf = this.layout.shelves[shelfIndex]!;
    const candidates = freeFrontSlots(this.state, shelfIndex);
    if (shelfIndex === from.shelf) candidates.push(from.slot);
    const slot = nearestFreeSlot(shelf, candidates, x) ?? nearestSlot(shelf, x);
    return { shelf: shelfIndex, layer: 0, slot };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.dragOccurred || this.overlay.visible || this.state.status !== 'playing') return;
    this.handleTap(pointer.x, pointer.y);
  }

  /** Tap an item to select it (tap again to deselect); then tap an empty slot (any shelf) to move it there. */
  private handleTap(x: number, y: number): void {
    const shelfIndex = shelfAt(this.layout, x, y);
    if (shelfIndex === -1) {
      this.select(null);
      return;
    }
    const tapped: Position = { shelf: shelfIndex, layer: 0, slot: nearestSlot(this.layout.shelves[shelfIndex]!, x) };
    const item = itemAt(this.state, tapped);
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
      if (event.kind === 'moved') moved = event;
      else if (event.kind === 'layerAdvanced') advancedShelves.add(event.shelf);
      else if (event.kind === 'tripleCleared') cleared.push(...event.itemIds);
    }

    // Snap: the moved item drops into its slot with a slight overshoot.
    if (moved) {
      const sprite = this.sprites.get(moved.itemId);
      if (sprite) {
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

    if (this.state.status !== 'playing') this.endLevel(RESULT_DELAY_MS);
  }
}
