import * as Phaser from 'phaser';
import {
  carrierOffset,
  dropHeld,
  findTrackItem,
  pickFromTrack,
  returnHeld,
  type CarrierRef,
  type GameEvent,
  type GameState,
  type Position,
  stackOf,
} from '../core';
import type { SoundService } from '../services/SoundService';
import { BACK_SCALE, isOnTrack, trackCarrierAt, trackPose, type BeltPose, type BoardLayout } from '../ui/boardLayout';
import { BeltView, DEPTH_BELT_ITEM } from './BeltView';

/** A held item grows like a picked-up shelf item. */
const HELD_SCALE = 1.18;
const RETURN_MS = 220;
/** How long the next item of a stack takes to come forward once the top one is taken. */
const PROMOTE_MS = 160;
const DEPTH_HELD = 100;
/** The second item of a stack peeks out behind the top one: up and to the left, smaller and dimmed. */
const BEHIND_OFFSET = 0.2;
const BEHIND_TINT = 0x777777;

/** What the conveyor needs from the game scene. Everything else about the tracks lives here. */
export interface BeltHost {
  readonly scene: Phaser.Scene;
  readonly sfx: SoundService;
  getState(): GameState;
  setState(state: GameState): void;
  getLayout(): BoardLayout;
  /** Scale of an item sitting on a shelf; items on tracks are drawn at the same size. */
  shelfItemScale(): number;
  spriteFor(itemId: number): Phaser.GameObjects.Image | undefined;
  /** Front slot a held item would go to if released at (x, y), or null. */
  dropTarget(x: number, y: number): Position | null;
  /** Animates the events of a successful placement (snap, triples, unlocks...). */
  onPlaced(events: readonly GameEvent[]): void;
  /** Called when the player takes something from a track, so a shelf selection can be cleared. */
  onPick(): void;
}

interface Press {
  pointerId: number;
  itemId: number;
  dragging: boolean;
}

interface Flight {
  startedAt: number;
  fromX: number;
  fromY: number;
  fromScale: number;
}

/**
 * Conveyor input and animation for every track. Pressing anywhere near a carrier takes its top item at once
 * (core pickFromTrack): drag it to a shelf, or release and then tap a free slot. Invalid drops send it back
 * to its carrier, which has kept moving (returnHeld). Each frame, every carrier's top item is drawn on it,
 * the next one dimmed behind, and deeper ones hidden.
 */
export class BeltController {
  private readonly view: BeltView;
  private press: Press | null = null;
  /** Held item waiting for a destination tap, lifted off its track. */
  private tapHeldId: number | null = null;
  /** Items flying back to their carrier after an invalid drop. */
  private readonly returning = new Map<number, Flight>();
  /** Items moving from second place to the top of their stack. */
  private readonly promoting = new Map<number, number>();
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };

  constructor(private readonly host: BeltHost) {
    this.view = new BeltView(host.scene);
  }

  /** New level: rebuild the tracks and forget any held, returning or promoting item. */
  reset(state: GameState): void {
    this.press = null;
    this.tapHeldId = null;
    this.returning.clear();
    this.promoting.clear();
    this.view.reset(state);
  }

  relayout(): void {
    this.view.relayout(this.host.getLayout().tracks);
    this.update();
  }

  /** True for items on a track or held from one; the scene leaves those sprites to the tracks. */
  owns(itemId: number): boolean {
    const state = this.host.getState();
    return findTrackItem(state, itemId) !== null || state.held?.item.id === itemId;
  }

  get holding(): boolean {
    return this.host.getState().held !== null;
  }

  /** Items on tracks are drawn exactly like shelf items: a track's pitch is the shelves' slot size. */
  private itemScale(): number {
    return this.host.shelfItemScale();
  }

  /** Per frame: plates follow their tracks; items follow their carrier by depth in its stack. */
  update(): void {
    const state = this.host.getState();
    this.view.update(state);
    const layouts = this.host.getLayout().tracks;
    const now = this.host.scene.time.now;
    const scale = this.itemScale();
    for (let t = 0; t < state.tracks.length; t++) {
      const track = state.tracks[t]!;
      const layout = layouts[t];
      if (!layout) continue;
      const behind = layout.pitch * BEHIND_OFFSET;
      for (let c = 0; c < track.carriers.length; c++) {
        const stack = stackOf(track.carriers[c]!);
        if (stack.length === 0) continue;
        const pose = trackPose(layout, carrierOffset(track, c, state.trackTimeMs), this.pose);
        for (let depth = 0; depth < stack.length; depth++) {
          const id = stack[depth]!.id;
          const sprite = this.host.spriteFor(id);
          if (!sprite) continue;
          if (depth >= 2) {
            // Deeper items stay hidden until they come up to second place.
            if (sprite.visible) sprite.setVisible(false);
            continue;
          }
          let x = depth === 0 ? pose.x : pose.x - behind;
          let y = depth === 0 ? pose.y : pose.y - behind;
          let itemScale = depth === 0 ? scale : scale * BACK_SCALE;
          let alpha = pose.alpha;
          sprite.setVisible(true).setDepth(DEPTH_BELT_ITEM - depth);
          if (depth === 0) sprite.clearTint();
          else sprite.setTint(BEHIND_TINT);

          const flight = this.returning.get(id);
          const promotedAt = this.promoting.get(id);
          if (depth === 0 && flight) {
            const k = Phaser.Math.Easing.Cubic.Out(Math.min(1, (now - flight.startedAt) / RETURN_MS));
            x = Phaser.Math.Linear(flight.fromX, x, k);
            y = Phaser.Math.Linear(flight.fromY, y, k);
            itemScale = Phaser.Math.Linear(flight.fromScale, itemScale, k);
            alpha = Phaser.Math.Linear(1, alpha, k);
            if (k >= 1) this.returning.delete(id);
            sprite.setDepth(k >= 1 ? DEPTH_BELT_ITEM : DEPTH_HELD);
          } else if (depth === 0 && promotedAt !== undefined) {
            const k = Phaser.Math.Easing.Quadratic.Out(Math.min(1, (now - promotedAt) / PROMOTE_MS));
            x = Phaser.Math.Linear(pose.x - behind, x, k);
            y = Phaser.Math.Linear(pose.y - behind, y, k);
            itemScale = Phaser.Math.Linear(scale * BACK_SCALE, itemScale, k);
            if (k >= 1) this.promoting.delete(id);
          }
          sprite.setPosition(x, y).setScale(itemScale).setAlpha(alpha);
        }
      }
    }
  }

  // ---------------------------------------------------------------- input

  /** Pointer down: takes the top item of the nearest carrier if the press is on a track. True if handled. */
  onPointerDown(pointer: Phaser.Input.Pointer): boolean {
    const state = this.host.getState();
    if (state.tracks.length === 0 || state.status !== 'playing' || this.press) return false;
    const layouts = this.host.getLayout().tracks;
    const t = layouts.findIndex((layout) => layout && isOnTrack(layout, pointer.x, pointer.y));
    if (t === -1) return false;

    // A second press on a track while holding something sends the held item back first.
    if (this.holding) this.sendBack(false);
    const now = this.host.getState();
    const track = now.tracks[t]!;
    const offsets = track.carriers.map((carrier, c) => (stackOf(carrier).length ? carrierOffset(track, c, now.trackTimeMs) : null));
    const carrier = trackCarrierAt(layouts[t]!, offsets, pointer.x, pointer.y);
    if (carrier === null) return true;

    const from: CarrierRef = { track: t, carrier };
    const result = pickFromTrack(now, from);
    if (!result.ok) return true;
    this.host.setState(result.state);
    const itemId = result.state.held!.item.id;
    this.returning.delete(itemId);
    // The next item of this stack, if any, comes forward.
    const next = stackOf(result.state.tracks[t]!.carriers[carrier]!)[0];
    if (next) this.promoting.set(next.id, this.host.scene.time.now);
    this.press = { pointerId: pointer.id, itemId, dragging: false };
    this.host.onPick();
    this.host.sfx.play('beltPick');

    // The item leaves the track at once, under the finger.
    const sprite = this.host.spriteFor(itemId);
    if (sprite) {
      this.host.scene.tweens.killTweensOf(sprite);
      sprite.setDepth(DEPTH_HELD).setAlpha(1).clearTint().setVisible(true).setPosition(pointer.x, pointer.y);
      this.host.scene.tweens.add({ targets: sprite, scale: this.itemScale() * HELD_SCALE, duration: 80, ease: 'Quad.easeOut' });
    }
    return true;
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    const press = this.press;
    if (!press || pointer.id !== press.pointerId || !pointer.isDown) return;
    if (!press.dragging && pointer.getDistance() > this.host.scene.input.dragDistanceThreshold) press.dragging = true;
    this.host.spriteFor(press.itemId)?.setPosition(pointer.x, pointer.y);
  }

  /** Pointer up for a press that began on a track. Returns true if it handled it. */
  onPointerUp(pointer: Phaser.Input.Pointer): boolean {
    const press = this.press;
    if (!press || pointer.id !== press.pointerId) return false;
    this.press = null;
    if (press.dragging) {
      this.placeOrReturn(pointer.x, pointer.y);
      return true;
    }
    // A tap: keep it lifted off the track until the player taps where it should go.
    this.tapHeldId = press.itemId;
    const sprite = this.host.spriteFor(press.itemId);
    const held = this.host.getState().held;
    const layout = held ? this.host.getLayout().tracks[held.from.track] : undefined;
    if (sprite && layout) {
      const { rect, pitch } = layout;
      const target =
        layout.orientation === 'horizontal'
          ? { x: Phaser.Math.Clamp(pointer.x, rect.x, rect.x + rect.width), y: rect.y - pitch * 0.45 }
          : {
              // Beside a vertical track, on the side facing the middle of the screen.
              x: layout.cross + (layout.cross < this.host.scene.scale.gameSize.width / 2 ? 1 : -1) * pitch * 0.95,
              y: Phaser.Math.Clamp(pointer.y, rect.y, rect.y + rect.height),
            };
      this.host.scene.tweens.add({ targets: sprite, ...target, duration: 120, ease: 'Back.easeOut' });
    }
    return true;
  }

  /** A tap elsewhere while an item is held from a tap: place it there or send it back. Returns true if handled. */
  onTapWhileHolding(x: number, y: number): boolean {
    if (this.tapHeldId === null || !this.holding) return false;
    this.placeOrReturn(x, y);
    return true;
  }

  /** Sends a held item back to its carrier (e.g. when the player starts doing something else). */
  sendBack(withFeedback: boolean): void {
    const state = this.host.getState();
    const held = state.held;
    if (!held) return;
    const result = returnHeld(state);
    if (!result.ok) return;
    this.host.setState(result.state);
    this.tapHeldId = null;
    // The item that had come forward goes back behind it.
    const below = stackOf(result.state.tracks[held.from.track]!.carriers[held.from.carrier]!)[1];
    if (below) this.promoting.delete(below.id);
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
    // Released over nothing useful: back to its track, without a buzz if it never left the track.
    const onATrack = this.host.getLayout().tracks.some((layout) => layout && isOnTrack(layout, x, y));
    this.sendBack(!onATrack);
  }
}
