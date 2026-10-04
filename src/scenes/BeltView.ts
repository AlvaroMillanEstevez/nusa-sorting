import * as Phaser from 'phaser';
import { carrierOffset, carriesShelves, type GameState, stackOf } from '../core';
import { boundsAround, trackPose, type BeltPose, type TrackLayout } from '../ui/boardLayout';
import { art } from './art/ArtSet';
import { BakedLayer } from './art/BakedLayer';

const DEPTH_RAIL = 3;
const DEPTH_PLATE = 4;
/** Items on tracks sit at this depth, between the plates and the end rollers. */
export const DEPTH_BELT_ITEM = 11;
const DEPTH_PIPS = 12;
const DEPTH_ROLLER = 13;
/** Most dots shown for the items hidden deeper in a stack. */
export const MAX_PIPS = 3;
const PIPS_TEXTURE = (n: number) => `stack-pips-${n}`;

/**
 * The conveyor tracks: a static rail per track, one plate per carrier moving with it (so motion shows even
 * where carriers are empty), rollers at both ends covering where carriers fade out and back in, and on each
 * carrier a few dots telling how many items are hidden below the top one.
 * Items are positioned by the controller with the same trackPose.
 */
export class BeltView {
  private readonly rails: BakedLayer;
  private readonly rollers: BakedLayer;
  private plates: Phaser.GameObjects.Image[][] = [];
  private pips: Phaser.GameObjects.Image[][] = [];
  private layouts: readonly TrackLayout[] = [];
  private shelfTracks: readonly boolean[] = [];
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
    // Shelf tracks have no plates: the shelves themselves ride them (see MovingShelves).
    this.plates = state.tracks.map((track) =>
      carriesShelves(track) ? [] : track.carriers.map(() => this.scene.add.image(0, 0, this.plate.key).setDepth(DEPTH_PLATE)),
    );
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
      Math.max(0, ...layouts.map((layout) => layout.pitch * 0.6)),
    );
    // Rails sit under the carriers and rollers over them, so they are two layers drawn together.
    this.rails.draw(bounds, (rails) =>
      this.rollers.draw(bounds, (rollers) =>
        layouts.forEach((layout, t) => {
          if (this.shelfTracks[t]) art().drawShelfTrack(rails, rollers, layout);
          else art().drawStackTrack(rails, rollers, layout);
        }),
      ),
    );
    layouts.forEach((layout, t) => {
      const plateScale = (layout.pitch * 0.9) / this.plate.size;
      for (const plate of this.plates[t] ?? []) plate.setScale(plateScale);
      for (const pip of this.pips[t] ?? []) pip.setScale((layout.pitch * 0.42) / (MAX_PIPS * 16));
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
      for (let c = 0; c < plates.length; c++) {
        const pose = trackPose(layout, carrierOffset(track, c, state.trackTimeMs), this.pose);
        plates[c]!.setPosition(pose.x, pose.y).setAlpha(pose.alpha);
        // Dots for items hidden below the top one: the stack's depth at a glance.
        const hidden = Math.min(MAX_PIPS, stackOf(track.carriers[c]!).length - 1);
        const pip = pips[c]!;
        if (hidden > 0) {
          const key = PIPS_TEXTURE(hidden);
          if (pip.texture.key !== key) pip.setTexture(key);
          pip
            .setVisible(true)
            .setPosition(pose.x + layout.pitch * 0.22, pose.y + layout.pitch * 0.36)
            .setAlpha(pose.alpha);
        } else if (pip.visible) {
          pip.setVisible(false);
        }
      }
    }
  }
}
