import * as Phaser from 'phaser';
import { carrierOffset, type TrackState } from '../core';
import { beltPose, type BeltLayout, type BeltPose } from '../ui/boardLayout';
import { theme } from '../ui/theme';

const DEPTH_RAIL = 3;
const DEPTH_PLATE = 4;
/** Belt items sit at this depth, between the plates and the end rollers. */
export const DEPTH_BELT_ITEM = 11;
const DEPTH_ROLLER = 12;
const PLATE_TEXTURE = 'belt-plate';
const PLATE_TEXTURE_SIZE = 64;

/**
 * The conveyor strip: a static rail, one plate per belt slot moving with the belt (so motion shows even
 * where slots are empty) and rollers at both ends covering where slots fade out and back in.
 * Items on the belt are positioned by the scene with the same beltPose.
 */
export class BeltView {
  private readonly rail: Phaser.GameObjects.Graphics;
  private readonly rollers: Phaser.GameObjects.Graphics;
  private plates: Phaser.GameObjects.Image[] = [];
  private layout: BeltLayout | null = null;
  private readonly pose: BeltPose = { x: 0, y: 0, alpha: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.rail = scene.add.graphics().setDepth(DEPTH_RAIL);
    this.rollers = scene.add.graphics().setDepth(DEPTH_ROLLER);
    if (!scene.textures.exists(PLATE_TEXTURE)) {
      const g = scene.add.graphics();
      const s = PLATE_TEXTURE_SIZE;
      g.fillStyle(theme.beltPlate, 1).fillRoundedRect(4, 4, s - 8, s - 8, 10);
      g.lineStyle(3, theme.beltRail, 1).strokeRoundedRect(4, 4, s - 8, s - 8, 10);
      g.generateTexture(PLATE_TEXTURE, s, s);
      g.destroy();
    }
  }

  /** Builds the strip for a level's belt, or hides it with null. */
  reset(track: TrackState | null): void {
    for (const plate of this.plates) plate.destroy();
    this.plates = (track?.carriers ?? []).map(() => this.scene.add.image(0, 0, PLATE_TEXTURE).setDepth(DEPTH_PLATE));
  }

  relayout(layout: BeltLayout | null): void {
    this.layout = layout;
    this.rail.clear();
    this.rollers.clear();
    if (!layout) return;
    const { rect, pitch } = layout;
    const railHeight = pitch * 0.92;
    const railY = layout.y - railHeight / 2;
    this.rail.fillStyle(theme.beltRail, 1).fillRect(rect.x, railY, rect.width, railHeight);
    // Rollers are centred on the loop's ends, covering the half slot where items fade out and back in.
    const rollerRadius = Math.max(railHeight / 2, pitch * 0.5);
    for (const x of [rect.x, rect.x + rect.width]) {
      this.rollers.fillStyle(theme.beltRoller, 1).fillCircle(x, layout.y, rollerRadius);
      this.rollers.fillStyle(theme.beltRail, 1).fillCircle(x, layout.y, rollerRadius * 0.35);
    }
    const plateScale = (pitch * 0.9) / PLATE_TEXTURE_SIZE;
    for (const plate of this.plates) plate.setScale(plateScale);
  }

  /** Moves the plates to the belt's current position. Called every frame; allocates nothing. */
  update(track: TrackState | null, trackTimeMs: number): void {
    const layout = this.layout;
    if (!track || !layout) return;
    for (let i = 0; i < this.plates.length; i++) {
      const pose = beltPose(layout, carrierOffset(track, i, trackTimeMs), this.pose);
      this.plates[i]!.setPosition(pose.x, pose.y).setAlpha(pose.alpha);
    }
  }
}
