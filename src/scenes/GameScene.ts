import * as Phaser from 'phaser';
import {
  createGame,
  findItem,
  freeFrontSlots,
  itemAt,
  moveItem,
  type GameEvent,
  type GameState,
  type Item,
  type LevelDefinition,
  type Position,
} from '../core';
import { levels } from '../data/levels';
import { t } from '../i18n';
import {
  BACK_SCALE,
  computeBoardLayout,
  nearestFreeSlot,
  nearestSlot,
  shelfAt,
  type BoardLayout,
} from '../ui/boardLayout';
import { titleFontSize } from '../ui/layout';
import { theme } from '../ui/theme';
import { ensureItemTexture, ITEM_TEXTURE_SIZE } from './itemTextures';

/** Item size relative to its slot. */
const ITEM_FILL = 0.86;
const BACK_TINT = 0x777777;
const SELECTED_LIFT = 0.15;
const SELECTED_SCALE = 1.12;

const MOVE_MS = 140;
const CLEAR_MS = 220;
const SETTLE_MS = 200;
const SELECT_MS = 90;

const DEPTH_BACK = 5;
const DEPTH_FRONT = 10;
const DEPTH_DRAG = 100;
const DEPTH_HUD = 150;
const DEPTH_WON = 200;

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
  private level!: LevelDefinition;
  private state!: GameState;
  private layout!: BoardLayout;

  private board!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private restartButton!: Phaser.GameObjects.Text;
  private wonText!: Phaser.GameObjects.Text;

  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly spriteIds = new WeakMap<Phaser.GameObjects.GameObject, number>();

  private selectedId: number | null = null;
  /** True while move/clear animations play; input on items is disabled meanwhile. */
  private busy = false;
  /** Set when the current pointer press turned into a drag, so its pointerup is not a tap. */
  private dragOccurred = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.level = levels[0]!;
    this.board = this.add.graphics();

    const resolution = window.devicePixelRatio || 1;
    this.titleText = this.add
      .text(0, 0, t('game.title'), { fontFamily: theme.fontFamily, fontStyle: 'bold', color: theme.titleColor })
      .setOrigin(0, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD);
    this.restartButton = this.add
      .text(0, 0, t('hud.restart'), {
        fontFamily: theme.fontFamily,
        fontStyle: 'bold',
        color: theme.textColor,
        backgroundColor: theme.buttonColor,
      })
      .setOrigin(1, 0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_HUD)
      .setInteractive({ useHandCursor: true });
    this.restartButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.restart());
    this.wonText = this.add
      .text(0, 0, t('game.won'), { fontFamily: theme.fontFamily, fontStyle: 'bold', color: theme.titleColor })
      .setOrigin(0.5)
      .setResolution(resolution)
      .setDepth(DEPTH_WON)
      .setVisible(false);

    // A small movement threshold keeps taps from being read as drags, especially with fingers.
    this.input.dragDistanceThreshold = 8;
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => (this.dragOccurred = false));
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.DRAG_START, this.onDragStart, this);
    this.input.on(Phaser.Input.Events.DRAG, this.onDrag, this);
    this.input.on(Phaser.Input.Events.DRAG_END, this.onDragEnd, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.relayout();
    this.restart();
  }

  // ---------------------------------------------------------------- level lifecycle

  private restart(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.selectedId = null;
    this.busy = false;
    this.wonText.setVisible(false);

    this.state = createGame(this.level);
    for (const shelf of this.state.shelves) {
      for (const layer of shelf.layers) {
        for (const item of layer) if (item) this.createSprite(item);
      }
    }
    this.sync(0);
  }

  private createSprite(item: Item): void {
    const sprite = this.add.image(0, 0, ensureItemTexture(this, item.type)).setInteractive({ draggable: true });
    this.sprites.set(item.id, sprite);
    this.spriteIds.set(sprite, item.id);
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

    const hud = this.layout.hud;
    const pad = Math.round(hud.height * 0.2);
    this.titleText.setFontSize(Math.round(hud.height * 0.42)).setPosition(16, hud.height / 2);
    this.restartButton
      .setFontSize(Math.round(hud.height * 0.32))
      .setPadding(pad * 1.5, pad, pad * 1.5, pad)
      .setPosition(width - 16, hud.height / 2);
    this.wonText.setFontSize(Math.round(titleFontSize(width, height) * 0.7)).setPosition(width / 2, height / 2);

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

  private targetFor(itemId: number, pos: Position): SpriteTarget {
    const s = this.layout.slotSize;
    const shelf = this.layout.shelves[pos.shelf]!;
    const baseScale = (s * ITEM_FILL) / ITEM_TEXTURE_SIZE;

    if (pos.layer === 0) {
      const slot = shelf.slots[pos.slot]!;
      const selected = itemId === this.selectedId;
      return {
        x: slot.x,
        y: selected ? slot.y - s * SELECTED_LIFT : slot.y,
        scale: selected ? baseScale * SELECTED_SCALE : baseScale,
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
      scale: baseScale * BACK_SCALE,
      alpha: pos.layer === 1 ? 1 : 0,
      depth: DEPTH_BACK - pos.layer,
      front: false,
    };
  }

  /** Moves every sprite to where the state says it is, tweening if duration > 0. */
  private sync(duration: number): void {
    for (const [id, sprite] of this.sprites) {
      const pos = findItem(this.state, id);
      if (!pos) {
        this.sprites.delete(id);
        sprite.destroy();
        continue;
      }
      const target = this.targetFor(id, pos);
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(target.depth);
      if (target.front) sprite.clearTint();
      else sprite.setTint(BACK_TINT);
      if (sprite.input) sprite.input.enabled = target.front && !this.busy;

      const { x, y, scale, alpha } = target;
      if (duration > 0) {
        this.tweens.add({ targets: sprite, x, y, scale, alpha, duration, ease: 'Cubic.easeOut' });
      } else {
        sprite.setPosition(x, y).setScale(scale).setAlpha(alpha);
      }
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    for (const [id, sprite] of this.sprites) {
      if (!sprite.input) continue;
      sprite.input.enabled = !busy && findItem(this.state, id)?.layer === 0;
    }
  }

  // ---------------------------------------------------------------- input

  private onDragStart(_pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image): void {
    this.dragOccurred = true;
    this.selectedId = null;
    this.sync(SELECT_MS);
    this.tweens.killTweensOf(sprite);
    sprite.setDepth(DEPTH_DRAG);
  }

  private onDrag(_pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image, dragX: number, dragY: number): void {
    sprite.setPosition(dragX, dragY);
  }

  private onDragEnd(pointer: Phaser.Input.Pointer, sprite: Phaser.GameObjects.Image): void {
    const id = this.spriteIds.get(sprite);
    const from = id === undefined ? null : findItem(this.state, id);
    const to = from && this.dropTarget(pointer.x, pointer.y, from);
    if (from && to && this.tryMove(from, to)) return;
    // Invalid drop: the item returns to its slot.
    this.sync(MOVE_MS);
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
    if (this.dragOccurred || this.busy) return;
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
      this.select(item.id === this.selectedId ? null : item.id);
      return;
    }
    if (this.selectedId === null) return;

    const from = findItem(this.state, this.selectedId);
    if (from && !this.tryMove(from, tapped)) this.rejectFeedback(this.selectedId);
  }

  private select(itemId: number | null): void {
    if (itemId === this.selectedId) return;
    this.selectedId = itemId;
    this.sync(SELECT_MS);
  }

  private rejectFeedback(itemId: number): void {
    const sprite = this.sprites.get(itemId);
    if (!sprite) return;
    this.tweens.killTweensOf(sprite);
    const x = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: x + this.layout.slotSize * 0.08,
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => sprite.setX(x),
    });
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

  /** Animates core events in order: the move, then any cleared triples, then everything settles. */
  private play(events: readonly GameEvent[]): void {
    this.setBusy(true);

    for (const event of events) {
      if (event.kind !== 'moved') continue;
      const sprite = this.sprites.get(event.itemId);
      if (!sprite) continue;
      const target = this.targetFor(event.itemId, event.to);
      this.tweens.killTweensOf(sprite);
      sprite.setDepth(DEPTH_DRAG);
      this.tweens.add({ targets: sprite, x: target.x, y: target.y, scale: target.scale, duration: MOVE_MS, ease: 'Cubic.easeOut' });
    }

    const cleared = events.flatMap((e) => (e.kind === 'tripleCleared' ? e.itemIds : []));
    let settleAt = MOVE_MS;
    if (cleared.length > 0) {
      this.time.delayedCall(MOVE_MS, () => {
        for (const id of cleared) {
          const sprite = this.sprites.get(id);
          if (!sprite) continue;
          this.sprites.delete(id);
          this.tweens.killTweensOf(sprite);
          this.tweens.add({
            targets: sprite,
            scale: sprite.scale * 1.3,
            alpha: 0,
            duration: CLEAR_MS,
            ease: 'Quad.easeIn',
            onComplete: () => sprite.destroy(),
          });
        }
      });
      settleAt += CLEAR_MS;
    }

    const won = events.some((e) => e.kind === 'won');
    this.time.delayedCall(settleAt, () => {
      this.setBusy(false);
      // Covers layerAdvanced: back items slide forward to their new front positions.
      this.sync(SETTLE_MS);
      if (won) this.showWon();
    });
  }

  private showWon(): void {
    this.wonText.setVisible(true).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: this.wonText, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}
