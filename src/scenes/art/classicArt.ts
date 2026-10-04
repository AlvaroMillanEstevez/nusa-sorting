import * as Phaser from 'phaser';
import type { ShelfLayout, TrackLayout } from '../../ui/boardLayout';
import { theme } from '../../ui/theme';
import type { ArtSet } from './ArtSet';

const PLATE_TEXTURE = 'belt-plate';
const PLATE_TEXTURE_SIZE = 64;

/** Back board, slot guides and plank. */
function drawShelf(g: Phaser.GameObjects.Graphics, shelf: ShelfLayout, s: number, dx = 0, dy = 0): void {
  const { rect } = shelf;
  g.fillStyle(theme.shelfBack, 1);
  g.fillRoundedRect(rect.x + dx, rect.y + dy, rect.width, rect.height, s * 0.12);

  const guide = s * 0.9;
  g.fillStyle(theme.slotGuide, 1);
  for (const slot of shelf.slots) {
    g.fillRoundedRect(slot.x + dx - guide / 2, slot.y + dy - guide / 2, guide, guide, s * 0.1);
  }

  const plankTop = shelf.slots[0]!.y + s / 2;
  g.fillStyle(theme.shelfPlank, 1);
  g.fillRoundedRect(rect.x + dx, plankTop + dy, rect.width, rect.y + rect.height - plankTop, s * 0.05);
}

function drawPadlock(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const color = Phaser.Display.Color.HexStringToColor(theme.textColor).color;
  g.lineStyle(Math.max(2, size * 0.12), color, 1);
  g.beginPath();
  g.arc(x, y - size * 0.1, size * 0.26, Math.PI, 0);
  g.strokePath();
  g.fillStyle(color, 1).fillRoundedRect(x - size * 0.4, y - size * 0.1, size * 0.8, size * 0.62, size * 0.1);
  g.fillStyle(theme.lockVeil, 1).fillCircle(x, y + size * 0.16, size * 0.09);
}

/** The look the game has had so far: flat blue-grey shelves and simple shapes for items. */
export const classicArt: ArtSet = {
  name: 'classic',
  bakes: false,
  // Placeholder shapes are drawn on demand by itemTextures.
  prepareItems: () => Promise.resolve(),
  drawShelf,

  plateTexture(scene) {
    if (!scene.textures.exists(PLATE_TEXTURE)) {
      const g = scene.add.graphics();
      const s = PLATE_TEXTURE_SIZE;
      g.fillStyle(theme.beltPlate, 1).fillRoundedRect(4, 4, s - 8, s - 8, 10);
      g.lineStyle(3, theme.beltRail, 1).strokeRoundedRect(4, 4, s - 8, s - 8, 10);
      g.generateTexture(PLATE_TEXTURE, s, s);
      g.destroy();
    }
    return { key: PLATE_TEXTURE, size: PLATE_TEXTURE_SIZE };
  },

  drawStackTrack(rails, rollers, layout: TrackLayout) {
    const { rect, pitch, cross } = layout;
    const railThickness = pitch * 0.92;
    const rollerRadius = Math.max(railThickness / 2, pitch * 0.5);
    rails.fillStyle(theme.beltRail, 1);
    if (layout.orientation === 'horizontal') {
      rails.fillRect(rect.x, cross - railThickness / 2, rect.width, railThickness);
    } else {
      rails.fillRect(cross - railThickness / 2, rect.y, railThickness, rect.height);
    }
    // Rollers are centred on the loop's ends, covering the half carrier where items fade out and back in.
    for (const [x, y] of trackEnds(layout)) {
      rollers.fillStyle(theme.beltRoller, 1).fillCircle(x, y, rollerRadius);
      rollers.fillStyle(theme.beltRail, 1).fillCircle(x, y, rollerRadius * 0.35);
    }
  },

  drawShelfTrack(rails, rollers, layout) {
    const { rect } = layout;
    const s = layout.pitch / 1.95;
    const guide = Math.max(3, s * 0.08);
    rails.fillStyle(theme.beltRail, 1);
    rails.fillRect(rect.x - guide * 1.5, rect.y, guide, rect.height);
    rails.fillRect(rect.x + rect.width + guide * 0.5, rect.y, guide, rect.height);
    const capHeight = s * 0.32;
    for (const y of [rect.y, rect.y + rect.height]) {
      rollers
        .fillStyle(theme.beltRoller, 1)
        .fillRoundedRect(rect.x - guide * 2, y - capHeight / 2, rect.width + guide * 4, capHeight, capHeight / 2);
    }
  },

  drawLockVeil(g, width, height, s) {
    g.fillStyle(theme.lockVeil, 0.62).fillRoundedRect(-width / 2, -height / 2, width, height, s * 0.12);
    drawPadlock(g, -s * 0.45, 0, s * 0.42);
  },

  drawBlocker(g, slotSize) {
    const half = slotSize * 0.42;
    g.fillStyle(theme.blockerColor, 1).fillRoundedRect(-half, -half, half * 2, half * 2, slotSize * 0.1);
    g.lineStyle(Math.max(3, slotSize * 0.08), theme.blockerStripe, 1);
    g.lineBetween(-half * 0.6, -half * 0.6, half * 0.6, half * 0.6);
    g.lineBetween(-half * 0.6, half * 0.6, half * 0.6, -half * 0.6);
    g.lineStyle(Math.max(2, slotSize * 0.04), theme.blockerStripe, 1).strokeRoundedRect(-half, -half, half * 2, half * 2, slotSize * 0.1);
  },
};

/** Both ends of a conveyor loop, where rollers sit. */
export function trackEnds(layout: TrackLayout): [number, number][] {
  const { rect, cross } = layout;
  return layout.orientation === 'horizontal'
    ? [
        [rect.x, cross],
        [rect.x + rect.width, cross],
      ]
    : [
        [cross, rect.y],
        [cross, rect.y + rect.height],
      ];
}
