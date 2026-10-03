import * as Phaser from 'phaser';
import {
  beltSlotOffset,
  dropHeld,
  findBeltItem,
  pickFromBelt,
  returnHeld,
  type GameEvent,
  type GameState,
  type Position,
} from '../core';
import type { SoundService } from '../services/SoundService';
import { beltPose, beltSlotAt, isOnBelt, type BeltLayout, type BeltPose, type BoardLayout } from '../ui/boardLayout';
import { BeltView, DEPTH_BELT_ITEM } from './BeltView';
import { ITEM_TEXTURE_SIZE } from './itemTextures';

/** Item size relative to the belt pitch. */
const BELT_ITEM_FILL = 0.8;
/** A held item is at least this much bigger than on the belt. */
const HELD_SCALE = 1.2;
const RETURN_MS = 220;
const DEPTH_HELD = 100;

/** What the conveyor needs from the game scene. Everything else about the belt lives here. */
export interface BeltHost {
  readonly scene: Phaser.Scene;
  readonly sfx: SoundService;
  getState(): GameState;
  setState(state: GameState): void;
  getLayout(): BoardLayout;
  /** Scale of an item sitting on a shelf; a held belt item grows to it so it reads like any other item. */
  shelfItemScale(): number;
  spriteFor(itemId: number): Phaser.GameObjects.Image | undefined;
  /** Front slot a held item would go to if released at (x, y), or null. */
  dropTarget(x: number, y: number): Position | null;
  /** Animates the events of a successful placement (snap, triples, unlocks...). */
  onPlaced(events: readonly GameEvent[]): void;
  /** Called when the player takes something from the belt, so a shelf selection can be cleared. */
  onPick(): void;
}

interface Press {
  pointerId: number;
  itemId: number;
  dragging: boolean;
}

interface Returning {
  startedAt: number;
  fromX: number;
  fromY: number;
  fromScale: number;
}

/**
 * Conveyor input and animation. Pressing anywhere near an item on the belt takes it at once (core
 * pickFromBelt): drag it to a shelf, or release and then tap a free slot. Invalid drops send it back to its
 * slot, which has kept moving (returnHeld). Items on the belt are repositioned every frame from game time.
 */
export class BeltController {
  private readonly view: BeltView;
  private press: Press | null = null;
  /** Held item waiting for a destination tap, lifted above the belt. */
  private tapHeldId: number | null = null;
  private readonly returning = new Map<number, Returning>();
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };

  constructor(private readonly host: BeltHost) {
    this.view = new BeltView(host.scene);
  }

  private get belt(): BeltLayout | null {
    return this.host.getLayout().belt;
  }

  /** New level: rebuild the strip and forget any held or returning item. */
  reset(state: GameState): void {
    this.press = null;
    this.tapHeldId = null;
    this.returning.clear();
    this.view.reset(state.conveyor);
  }

  relayout(): void {
    this.view.relayout(this.belt);
    this.update();
  }

  /** True for items that are on the belt or held from it; the scene leaves those sprites to the belt. */
  owns(itemId: number): boolean {
    const state = this.host.getState();
    return findBeltItem(state, itemId) !== null || state.conveyor?.held?.item.id === itemId;
  }

  get holding(): boolean {
    return this.host.getState().conveyor?.held != null;
  }

  private heldScale(): number {
    return Math.max(this.itemScale() * HELD_SCALE, this.host.shelfItemScale());
  }

  private itemScale(): number {
    return ((this.belt?.pitch ?? 0) * BELT_ITEM_FILL) / ITEM_TEXTURE_SIZE;
  }

  /** Per frame: plates and belt items follow the belt; returning items fly back to their moving slot. */
  update(): void {
    const belt = this.belt;
    const conveyor = this.host.getState().conveyor;
    this.view.update(conveyor);
    if (!belt || !conveyor) return;
    const now = this.host.scene.time.now;
    const scale = this.itemScale();
    for (let i = 0; i < conveyor.slots.length; i++) {
      const item = conveyor.slots[i];
      if (!item) continue;
      const sprite = this.host.spriteFor(item.id);
      if (!sprite) continue;
      const pose = beltPose(belt, beltSlotOffset(conveyor, i), this.pose);
      const flight = this.returning.get(item.id);
      if (flight) {
        const t = Math.min(1, (now - flight.startedAt) / RETURN_MS);
        const k = Phaser.Math.Easing.Cubic.Out(t);
        sprite
          .setPosition(Phaser.Math.Linear(flight.fromX, pose.x, k), Phaser.Math.Linear(flight.fromY, pose.y, k))
          .setScale(Phaser.Math.Linear(flight.fromScale, scale, k))
          .setAlpha(Phaser.Math.Linear(1, pose.alpha, k));
        if (t >= 1) {
          this.returning.delete(item.id);
          sprite.setDepth(DEPTH_BELT_ITEM);
        }
        continue;
      }
      sprite.setPosition(pose.x, pose.y).setScale(scale).setAlpha(pose.alpha).setDepth(DEPTH_BELT_ITEM);
    }
  }

  // ---------------------------------------------------------------- input

  /** Pointer down: takes the nearest belt item if the press is on the belt. Returns true if it handled it. */
  onPointerDown(pointer: Phaser.Input.Pointer): boolean {
    const belt = this.belt;
    const state = this.host.getState();
    if (!belt || !state.conveyor || state.status !== 'playing' || this.press) return false;
    if (!isOnBelt(belt, pointer.x, pointer.y)) return false;

    // A second belt press while holding something sends the held item back first.
    if (this.holding) this.sendBack(false);
    const conveyor = this.host.getState().conveyor!;
    const offsets = conveyor.slots.map((item, i) => (item ? beltSlotOffset(conveyor, i) : null));
    const slot = beltSlotAt(belt, offsets, pointer.x, pointer.y);
    if (slot === null) return true;

    const result = pickFromBelt(this.host.getState(), slot);
    if (!result.ok) return true;
    this.host.setState(result.state);
    const itemId = result.state.conveyor!.held!.item.id;
    this.returning.delete(itemId);
    this.press = { pointerId: pointer.id, itemId, dragging: false };
    this.host.onPick();
    this.host.sfx.play('beltPick');

    // The item leaves the belt at once, under the finger.
    const sprite = this.host.spriteFor(itemId);
    if (sprite) {
      this.host.scene.tweens.killTweensOf(sprite);
      sprite.setDepth(DEPTH_HELD).setAlpha(1).setPosition(pointer.x, pointer.y);
      this.host.scene.tweens.add({ targets: sprite, scale: this.heldScale(), duration: 80, ease: 'Quad.easeOut' });
    }
    return true;
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (!press || pointer.id !== press.pointerId || !pointer.isDown) return;
    if (!press.dragging && pointer.getDistance() > this.host.scene.input.dragDistanceThreshold) press.dragging = true;
    this.host.spriteFor(press.itemId)?.setPosition(pointer.x, pointer.y);
  }

  /** Pointer up for a press that began on the belt. Returns true if it handled it. */
  onPointerUp(pointer: Phaser.Input.Pointer): boolean {
    const press = this.press;
    if (!press || pointer.id !== press.pointerId) return false;
    this.press = null;
    if (press.dragging) {
      this.placeOrReturn(pointer.x, pointer.y);
    } else {
      // A tap: keep it lifted above the belt until the player taps where it should go.
      this.tapHeldId = press.itemId;
      const sprite = this.host.spriteFor(press.itemId);
      const belt = this.belt;
      if (sprite && belt) {
        this.host.scene.tweens.add({
          targets: sprite,
          x: Phaser.Math.Clamp(pointer.x, belt.rect.x, belt.rect.x + belt.rect.width),
          y: belt.rect.y - belt.pitch * 0.45,
          duration: 120,
          ease: 'Back.easeOut',
        });
      }
    }
    return true;
  }

  /** A tap elsewhere while an item is held from a tap: place it there or send it back. Returns true if handled. */
  onTapWhileHolding(x: number, y: number): boolean {
    if (this.tapHeldId === null || !this.holding) return false;
    this.placeOrReturn(x, y);
    return true;
  }

  /** Sends a held item back to its slot (e.g. when the player starts doing something else). */
  sendBack(withFeedback: boolean): void {
    const state = this.host.getState();
    const held = state.conveyor?.held;
    if (!held) return;
    const result = returnHeld(state);
    if (!result.ok) return;
    this.host.setState(result.state);
    this.tapHeldId = null;
    const sprite = this.host.spriteFor(held.item.id);
    if (sprite) {
      this.host.scene.tweens.killTweensOf(sprite);
      this.returning.set(held.item.id, {
        startedAt: this.host.scene.time.now,
        fromX: sprite.x,
        fromY: sprite.y,
        fromScale: sprite.scale,
      });
    }
    if (withFeedback) this.host.sfx.play('invalid');
  }

  private placeOrReturn(x: number, y: number): void {
    this.tapHeldId = null;
    const to = this.host.dropTarget(x, y);
    const result = to ? dropHeld(this.host.getState(), to) : null;
    if (result?.ok) {
      this.host.setState(result.state);
      this.host.onPlaced(result.events);
      return;
    }
    // Released over nothing useful: back to the belt, without a buzz if it never left the strip.
    const belt = this.belt;
    this.sendBack(!(belt && isOnBelt(belt, x, y)));
  }
}
