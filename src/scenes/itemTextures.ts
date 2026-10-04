import type * as Phaser from 'phaser';
import { createGame, stackOf, type ItemType } from '../core';
import { levels } from '../data/levels';
import { renderItemSvg } from '../ui/icons/icons';
import { addSvgTexture } from './svgTexture';

/**
 * Item textures are rasterized from the SVG icons at this size and drawn scaled down to fit their slot
 * (mipmaps keep them smooth). A power of two, and enough for large slots on dense screens.
 */
export const ITEM_TEXTURE_SIZE = 256;

export const itemTextureKey = (type: ItemType) => `item:${type}`;

/** Every item type the levels use. */
function levelItemTypes(): Set<ItemType> {
  const types = new Set<ItemType>();
  for (const level of levels) {
    const state = createGame(level);
    for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) types.add(item.type);
    for (const track of state.tracks) for (const carrier of track.carriers) for (const item of stackOf(carrier)) types.add(item.type);
  }
  return types;
}

/** Rasterizes the icon of every item type the levels use, once, before the game starts. */
export async function prepareItemTextures(scene: Phaser.Scene): Promise<void> {
  await Promise.all(
    [...levelItemTypes()].map((type) => addSvgTexture(scene.textures, itemTextureKey(type), renderItemSvg(type), ITEM_TEXTURE_SIZE)),
  );
}
