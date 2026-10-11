import * as Phaser from 'phaser';
import { carrierOffset, carriesShelves, type GameState, stackOf } from '../core';
import { boundsAround, trackPose, type BeltPose, type TrackLayout } from '../ui/boardLayout';
import { art } from './art/ArtSet';
import { kitText } from './kit';
import { SKIN } from '../ui/design/tokens';
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
 * A fixed stack shows how many items it has left as a number, rather than dots, from this many (the top one and
 * four or more behind it): dots stay quick to read up to three, a number is clearer beyond.
 */
export const COUNT_FROM = MAX_PIPS + 2;
const PIPS_TEXTURE = (n: number) => `stack-pips-${n}`;

/**
 * The conveyor tracks: a static rail per track, one plate per carrier moving with it (so motion shows even
 * where carriers are empty), rollers at both ends covering where carriers fade out and back in, and on each
 * carrier a few dots telling how many items are hidden below the top one.
 * Fixed stacks (tracks of speed 0) are wooden cubbies instead, with no plates or rollers: dots for up to three
 * items hidden, the number of items left from COUNT_FROM, and a boarded-up cubby once a stack has run out.
 * Items are positioned by the controller with the same trackPose.
 */
export class BeltView {
  private readonly rails: BakedLayer;
  private readonly rollers: BakedLayer;
  private plates: Phaser.GameObjects.Image[][] = [];
  private pips: Phaser.GameObjects.Image[][] = [];
  private layouts: readonly TrackLayout[] = [];
  private shelfTracks: readonly boolean[] = [];
  private fixedTracks: readonly boolean[] = [];
  /** Per fixed stack: its count of items left, and its boarded-up look once empty. */
  private counts: (Phaser.GameObjects.Text | null)[][] = [];
  private emptied: (Phaser.GameObjects.Graphics | null)[][] = [];
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };
  private readonly plate: { key: string; size: number };

  constructor(private readonly scene: Phaser.Scene) {
    this.rails = new BakedLayer(scene, DEPTH_RAIL);
    this.rollers = new BakedLayer(scene, DEPTH_ROLLER);
    this.plate = art().plateTexture(scene);
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
    for (const count of this.counts.flat()) count?.destroy();
    for (const mark of this.emptied.flat()) mark?.destroy();
    this.fixedTracks = state.tracks.map((track) => track.speed === 0);
    // Shelf tracks have no plates: the shelves themselves ride them (see MovingShelves); fixed stacks sit in cubbies.
    this.plates = state.tracks.map((track) =>
      carriesShelves(track) || track.speed === 0 ? [] : track.carriers.map(() => this.scene.add.image(0, 0, this.plate.key).setDepth(DEPTH_PLATE)),
    );
    this.counts = state.tracks.map((track) =>
      track.carriers.map(() =>
        track.speed === 0
          ? kitText(this.scene, 'number', '', SKIN.text.primary).setStroke(SKIN.surface.border, 4).setDepth(DEPTH_PIPS).setVisible(false)
          : null,
      ),
    );
    this.emptied = state.tracks.map((track) => track.carriers.map(() => (track.speed === 0 ? this.scene.add.graphics().setDepth(DEPTH_PLATE).setVisible(false) : null)));
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
    // Rails sit under the carriers and rollers over them, so they are two layers drawn together.
    this.rails.draw(bounds, (rails) =>
      this.rollers.draw(bounds, (rollers) =>
        layouts.forEach((layout, t) => {
          if (this.shelfTracks[t]) art().drawShelfTrack(rails, rollers, layout);
          else if (this.fixedTracks[t]) art().drawFixedStacks(rails, layout);
          else art().drawStackTrack(rails, rollers, layout);
        }),
      ),
    );
    layouts.forEach((layout, t) => {
      const plateScale = (layout.slotSize * 0.9) / this.plate.size;
      for (const plate of this.plates[t] ?? []) plate.setScale(plateScale);
      for (const pip of this.pips[t] ?? []) pip.setScale((layout.slotSize * 0.42) / (MAX_PIPS * 16));
      for (const count of this.counts[t] ?? []) count?.setFontSize(Math.round(layout.slotSize * 0.26));
      (this.emptied[t] ?? []).forEach((mark) => {
        if (!mark) return;
        mark.clear();
        art().drawEmptyStack(mark, layout.slotSize);
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
          if (long) count.setText(String(left)).setPosition(pose.x + layout.slotSize * 0.3, pose.y + layout.slotSize * 0.32);
          count.setVisible(long === true);
        }
        const heldHere = state.held?.from.track === t && state.held.from.carrier === c;
        this.emptied[t]?.[c]?.setPosition(pose.x, pose.y).setVisible(fixed === true && left === 0 && !heldHere);
        // Dots for items hidden below the top one: the stack's depth at a glance.
        const hidden = long ? 0 : Math.min(MAX_PIPS, left - 1);
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
