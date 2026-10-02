import * as Phaser from 'phaser';
import type { ItemType } from '../core';
import { ITEM_STYLES, itemStyle, itemTextureKey, type ItemShape } from '../ui/itemStyles';

/** Item textures are drawn at this size and scaled down to fit the slots. */
export const ITEM_TEXTURE_SIZE = 128;

const C = ITEM_TEXTURE_SIZE / 2;
const OUTLINE = 6;

function darken(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function regularPolygon(sides: number, radius: number, rotation: number): Phaser.Math.Vector2[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * Math.PI * 2) / sides;
    return new Phaser.Math.Vector2(C + Math.cos(angle) * radius, C + Math.sin(angle) * radius);
  });
}

function starPoints(points: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    return new Phaser.Math.Vector2(C + Math.cos(angle) * radius, C + Math.sin(angle) * radius);
  });
}

function drawShape(g: Phaser.GameObjects.Graphics, shape: ItemShape): void {
  const r = C - OUTLINE - 2;
  switch (shape) {
    case 'circle':
      g.fillCircle(C, C, r);
      g.strokeCircle(C, C, r);
      return;
    case 'square': {
      const half = r * 0.82;
      g.fillRoundedRect(C - half, C - half, half * 2, half * 2, 14);
      g.strokeRoundedRect(C - half, C - half, half * 2, half * 2, 14);
      return;
    }
    case 'triangle': {
      const points = regularPolygon(3, r, -Math.PI / 2).map((p) => p.add(new Phaser.Math.Vector2(0, r * 0.15)));
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      return;
    }
    case 'diamond': {
      const points = regularPolygon(4, r, -Math.PI / 2);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      return;
    }
    case 'star': {
      const points = starPoints(5, r, r * 0.45);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      return;
    }
    case 'hexagon': {
      const points = regularPolygon(6, r, 0);
      g.fillPoints(points, true);
      g.strokePoints(points, true);
      return;
    }
  }
}

/** Generates the placeholder texture for an item type if it does not exist yet. */
export function ensureItemTexture(scene: Phaser.Scene, type: ItemType): string {
  const key = itemTextureKey(type);
  if (scene.textures.exists(key)) return key;

  const { color, shape } = itemStyle(type);
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.lineStyle(OUTLINE, darken(color, 0.55), 1);
  drawShape(g, shape);
  // Small highlight so shapes read as objects rather than flat icons.
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(C - 16, C - 18, 9);
  g.generateTexture(key, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE);
  g.destroy();
  return key;
}

export function generateItemTextures(scene: Phaser.Scene): void {
  for (const type of Object.keys(ITEM_STYLES)) ensureItemTexture(scene, type);
}
