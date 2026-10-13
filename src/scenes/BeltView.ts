import * as Phaser from 'phaser';
import { carrierOffset, carriesShelves, type GameState, stackOf } from '../core';
import { boundsAround, trackPose, type BeltPose, type TrackLayout } from '../ui/boardLayout';
import { makeEmptyStack, makePlate, makeShelfTrack, makeStackTrack } from './art/ArtSet';
import { cubbyBoardY, cubbyFrame, cubbyInsideY, CUBBY_TEXTURE } from './art/shelfArt';
import { kitText } from './kit';
import { hexNumber, SKIN, TILE } from '../ui/design/tokens';
import { BakedLayer } from './art/BakedLayer';

const DEPTH_RAIL = 3;
const DEPTH_PLATE = 4;
/** Items on tracks sit at this depth, between the plates and the end rollers. */
export const DEPTH_BELT_ITEM = 11;
const DEPTH_PIPS = 12;
const DEPTH_ROLLER = 13;
/** Most dots shown for the items hidden deeper in a stack. */
export const MAX_PIPS = 3;
/**
 * A fixed stack shows how many items it has left on a tag outside the item, from this many: with only the top one
 * left there is nothing to count.
 */
export const COUNT_FROM = 2;
const PIPS_TEXTURE = (n: number) => `stack-pips-${n}`;

/**
 * The conveyor tracks: a static rail per track, one plate per carrier moving with it (so motion shows even
 * where carriers are empty), rollers at both ends covering where carriers fade out and back in, and on each
 * carrier a few dots telling how many items are hidden below the top one.
 * Fixed stacks (tracks of speed 0) are cubbies of the shelves' wood instead, with no plates or rollers: a tag on the cubby's
 * bottom board (under the item, so it reads as the size of the pile, not a number of that item) with a little pile
 * and the items left, from COUNT_FROM, and a boarded-up cubby once a stack has run out.
 * Items are positioned by the controller with the same trackPose.
 */
export class BeltView {
  private readonly rollers: BakedLayer;
  /** The tracks' wooden pieces (beds, rails, beams), rebuilt on relayout. */
  private pieces: Phaser.GameObjects.GameObject[] = [];
  private plates: Phaser.GameObjects.Image[][] = [];
  private pips: Phaser.GameObjects.Image[][] = [];
  private layouts: readonly TrackLayout[] = [];
  private shelfTracks: readonly boolean[] = [];
  private fixedTracks: readonly boolean[] = [];
  /** Per fixed stack: its count of items left, and its boarded-up look once empty. */
  private counts: ({ tag: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Graphics } | null)[][] = [];
  private emptied: (Phaser.GameObjects.Container | null)[][] = [];
  /** The cubbies of fixed stacks, one picture each. */
  private cubbies: Phaser.GameObjects.Image[] = [];
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.rollers = new BakedLayer(scene, DEPTH_ROLLER);
    for (let n = 1; n <= MAX_PIPS; n++) {
      if (scene.textures.exists(PIPS_TEXTURE(n))) continue;
      // A short row of dots, 16 px per dot, drawn once and scaled with the slot.
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < n; i++) g.fillCircle(8 + i * 16, 8, 5);
      g.generateTexture(PIPS_TEXTURE(n), MAX_PIPS * 16, 16);
      g.destroy();
    }
  }

  /** Builds plates and depth dots for a level's tracks (none for levels without one). */
  reset(state: GameState): void {
    for (const plate of this.plates.flat()) plate.destroy();
    for (const pip of this.pips.flat()) pip.destroy();
    for (const count of this.counts.flat()) count?.tag.destroy();
    for (const mark of this.emptied.flat()) mark?.destroy();
    this.fixedTracks = state.tracks.map((track) => track.speed === 0);
    // Shelf tracks have no plates: the shelves themselves ride them (see MovingShelves); fixed stacks sit in cubbies.
    this.plates = state.tracks.map((track) =>
      carriesShelves(track) || track.speed === 0 ? [] : track.carriers.map(() => makePlate(this.scene, 1).setDepth(DEPTH_PLATE)),
    );
    this.counts = state.tracks.map((track) =>
      track.carriers.map(() => {
        if (track.speed !== 0) return null;
        const chip = this.scene.add.graphics();
        const label = kitText(this.scene, 'number', '', SKIN.text.primary).setOrigin(0, 0.5);
        const tag = this.scene.add.container(0, 0, [chip, label]).setDepth(DEPTH_PIPS).setVisible(false);
        return { tag, label, chip };
      }),
    );
    this.emptied = state.tracks.map((track) => track.carriers.map(() => (track.speed === 0 ? this.scene.add.container(0, 0).setDepth(DEPTH_PLATE).setVisible(false) : null)));
    this.pips = state.tracks.map((track) =>
      carriesShelves(track)
        ? []
        : track.carriers.map(() => this.scene.add.image(0, 0, PIPS_TEXTURE(1)).setDepth(DEPTH_PIPS).setVisible(false)),
    );
    this.shelfTracks = state.tracks.map(carriesShelves);
  }

  relayout(layouts: readonly TrackLayout[]): void {
    this.layouts = layouts;
    // Rollers and poles reach a little beyond each track's area.
    const bounds = boundsAround(
      layouts.map((layout) => layout.rect),
      Math.max(0, ...layouts.map((layout) => layout.slotSize * 0.6)),
    );
    // Wooden beds and rails sit under the carriers; beams and log ends over the loop's ends, above them.
    for (const piece of this.pieces) piece.destroy();
    this.pieces = [];
    this.rollers.draw(bounds, (rollers) =>
      layouts.forEach((layout, t) => {
        if (this.fixedTracks[t]) return;
        const made = this.shelfTracks[t] ? makeShelfTrack(this.scene, rollers, layout) : makeStackTrack(this.scene, rollers, layout);
        for (const piece of made.under) this.pieces.push((piece as Phaser.GameObjects.Image).setDepth(DEPTH_RAIL));
        for (const piece of made.over) this.pieces.push((piece as Phaser.GameObjects.Image).setDepth(DEPTH_ROLLER - 0.5));
      }),
    );
    for (const cubby of this.cubbies) cubby.destroy();
    this.cubbies = [];
    layouts.forEach((layout, t) => {
      if (!this.fixedTracks[t]) return;
      for (let c = 0; c < layout.slots; c++) {
        const along = layout.loopStart + (c + 0.5) * layout.pitch;
        const [cx, cy] = layout.orientation === 'horizontal' ? [along, layout.cross] : [layout.cross, along];
        const f = cubbyFrame(cx, cy, layout.slotSize);
        // In a column the lower cubby's top beam covers the board of the one above it.
        this.cubbies.push(this.scene.add.image(f.x, f.y, CUBBY_TEXTURE).setOrigin(0).setDisplaySize(f.width, f.height).setDepth(DEPTH_RAIL + c * 0.01));
      }
    });
    layouts.forEach((layout, t) => {
      for (const plate of this.plates[t] ?? []) plate.setDisplaySize(layout.slotSize * 0.9, layout.slotSize * 0.9);
      for (const pip of this.pips[t] ?? []) pip.setScale((layout.slotSize * 0.42) / (MAX_PIPS * 16));
      for (const count of this.counts[t] ?? []) if (count) drawStackTag(count.chip, count.label, layout.slotSize);
      (this.emptied[t] ?? []).forEach((mark) => {
        if (!mark) return;
        mark.removeAll(true).add(makeEmptyStack(this.scene, layout.slotSize));
      });
    });
  }

  /** Moves plates and depth dots to the tracks' current positions. Called every frame; allocates nothing. */
  update(state: GameState): void {
    for (let t = 0; t < state.tracks.length; t++) {
      const track = state.tracks[t]!;
      const layout = this.layouts[t];
      const plates = this.plates[t];
      const pips = this.pips[t];
      if (!layout || !plates || !pips) continue;
      const fixed = this.fixedTracks[t];
      for (let c = 0; c < pips.length; c++) {
        const pose = trackPose(layout, carrierOffset(track, c, state.trackTimeMs), this.pose);
        plates[c]?.setPosition(pose.x, pose.y).setAlpha(pose.alpha);
        const left = stackOf(track.carriers[c]!).length;
        // Fixed stacks: the number of items left when there are many, and a boarded-up cubby once run out (unless
        // its last item is in the player's hand, which may still go back).
        const count = this.counts[t]?.[c];
        const long = fixed === true && left >= COUNT_FROM;
        if (count) {
          if (long) {
            if (count.label.text !== String(left)) count.label.setText(String(left));
            // Centred on the cubby's bottom board, under the item rather than over it.
            count.tag.setPosition(pose.x, cubbyBoardY(pose.y, layout.slotSize));
          }
          count.tag.setVisible(long === true);
        }
        const heldHere = state.held?.from.track === t && state.held.from.carrier === c;
        this.emptied[t]?.[c]?.setPosition(pose.x, cubbyInsideY(pose.y, layout.slotSize)).setVisible(fixed === true && left === 0 && !heldHere);
        // Dots for items hidden below the top one: the stack's depth at a glance (fixed stacks have their tag).
        const hidden = fixed ? 0 : Math.min(MAX_PIPS, left - 1);
        const pip = pips[c]!;
        if (hidden > 0) {
          const key = PIPS_TEXTURE(hidden);
          if (pip.texture.key !== key) pip.setTexture(key);
          pip
            .setVisible(true)
            .setPosition(pose.x + layout.slotSize * 0.22, pose.y + layout.slotSize * 0.36)
            .setAlpha(pose.alpha);
        } else if (pip.visible) {
          pip.setVisible(false);
        }
      }
    }
  }
}

/**
 * The tag of a fixed stack, centred on (0, 0): a dark chip with a brass rim, a little pile of three planks and the
 * number of items left (the label, set by the caller).
 */
function drawStackTag(chip: Phaser.GameObjects.Graphics, label: Phaser.GameObjects.Text, slotSize: number): void {
  const h = slotSize * 0.27;
  const w = slotSize * 0.52;
  const edge = Math.max(1, slotSize * 0.025);
  chip.clear();
  chip.fillStyle(hexNumber(TILE.badge), 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  chip.lineStyle(edge, hexNumber(TILE.rim), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  // The pile: three short planks, offset like a stack seen from the side.
  const px = -w / 2 + h * 0.6;
  const plank = h * 0.16;
  for (let i = 0; i < 3; i++) {
    const y = h * 0.22 - i * plank * 1.45;
    chip.fillStyle(hexNumber(i === 2 ? TILE.rimLight : TILE.rim), 1).fillRoundedRect(px - h * 0.3 + (i % 2) * h * 0.06, y - plank / 2, h * 0.6, plank, plank / 2);
  }
  label.setFontSize(Math.round(h * 0.78)).setPosition(-w / 2 + h * 1.05, 0);
}
