import * as Phaser from 'phaser';
import { carrierOffset, carriesShelves, type GameState, stackOf } from '../core';
import { trackPose, type BeltPose, type TrackLayout } from '../ui/boardLayout';
import { theme } from '../ui/theme';

const DEPTH_RAIL = 3;
const DEPTH_PLATE = 4;
/** Items on tracks sit at this depth, between the plates and the end rollers. */
export const DEPTH_BELT_ITEM = 11;
const DEPTH_PIPS = 12;
const DEPTH_ROLLER = 13;
const PLATE_TEXTURE = 'belt-plate';
const PLATE_TEXTURE_SIZE = 64;
/** Most dots shown for the items hidden deeper in a stack. */
export const MAX_PIPS = 3;
const PIPS_TEXTURE = (n: number) => `stack-pips-${n}`;

/**
 * The conveyor tracks: a static rail per track, one plate per carrier moving with it (so motion shows even
 * where carriers are empty), rollers at both ends covering where carriers fade out and back in, and on each
 * carrier a few dots telling how many items are hidden below the two visible ones.
 * Items are positioned by the controller with the same trackPose.
 */
export class BeltView {
  private readonly rails: Phaser.GameObjects.Graphics;
  private readonly rollers: Phaser.GameObjects.Graphics;
  private plates: Phaser.GameObjects.Image[][] = [];
  private pips: Phaser.GameObjects.Image[][] = [];
  private layouts: readonly TrackLayout[] = [];
  private shelfTracks: readonly boolean[] = [];
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.rails = scene.add.graphics().setDepth(DEPTH_RAIL);
    this.rollers = scene.add.graphics().setDepth(DEPTH_ROLLER);
    if (!scene.textures.exists(PLATE_TEXTURE)) {
      const g = scene.add.graphics();
      const s = PLATE_TEXTURE_SIZE;
      g.fillStyle(theme.beltPlate, 1).fillRoundedRect(4, 4, s - 8, s - 8, 10);
      g.lineStyle(3, theme.beltRail, 1).strokeRoundedRect(4, 4, s - 8, s - 8, 10);
      g.generateTexture(PLATE_TEXTURE, s, s);
      g.destroy();
    }
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
      carriesShelves(track) ? [] : track.carriers.map(() => this.scene.add.image(0, 0, PLATE_TEXTURE).setDepth(DEPTH_PLATE)),
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
    this.rails.clear();
    this.rollers.clear();
    layouts.forEach((layout, t) => {
      if (this.shelfTracks[t]) {
        this.drawShelfTrack(layout);
        return;
      }
      const { rect, pitch, cross } = layout;
      const railThickness = pitch * 0.92;
      const rollerRadius = Math.max(railThickness / 2, pitch * 0.5);
      this.rails.fillStyle(theme.beltRail, 1);
      if (layout.orientation === 'horizontal') {
        this.rails.fillRect(rect.x, cross - railThickness / 2, rect.width, railThickness);
      } else {
        this.rails.fillRect(cross - railThickness / 2, rect.y, railThickness, rect.height);
      }
      // Rollers are centred on the loop's ends, covering the half carrier where items fade out and back in.
      const ends: [number, number][] =
        layout.orientation === 'horizontal'
          ? [
              [rect.x, cross],
              [rect.x + rect.width, cross],
            ]
          : [
              [cross, rect.y],
              [cross, rect.y + rect.height],
            ];
      for (const [x, y] of ends) {
        this.rollers.fillStyle(theme.beltRoller, 1).fillCircle(x, y, rollerRadius);
        this.rollers.fillStyle(theme.beltRail, 1).fillCircle(x, y, rollerRadius * 0.35);
      }
      const plateScale = (pitch * 0.9) / PLATE_TEXTURE_SIZE;
      for (const plate of this.plates[t] ?? []) plate.setScale(plateScale);
      for (const pip of this.pips[t] ?? []) pip.setScale((pitch * 0.42) / (MAX_PIPS * 16));
    });
  }

  /**
   * A track of shelves: two thin guides along the column and a cap at each end of the loop, where shelves
   * fade out and come back in.
   */
  private drawShelfTrack(layout: TrackLayout): void {
    const { rect } = layout;
    const s = layout.pitch / 1.95;
    const guide = Math.max(3, s * 0.08);
    this.rails.fillStyle(theme.beltRail, 1);
    this.rails.fillRect(rect.x - guide * 1.5, rect.y, guide, rect.height);
    this.rails.fillRect(rect.x + rect.width + guide * 0.5, rect.y, guide, rect.height);
    const capHeight = s * 0.32;
    for (const y of [rect.y, rect.y + rect.height]) {
      this.rollers.fillStyle(theme.beltRoller, 1).fillRoundedRect(rect.x - guide * 2, y - capHeight / 2, rect.width + guide * 4, capHeight, capHeight / 2);
    }
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
        // Dots for items hidden below the top two: the stack's depth at a glance.
        const hidden = Math.min(MAX_PIPS, stackOf(track.carriers[c]!).length - 2);
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
