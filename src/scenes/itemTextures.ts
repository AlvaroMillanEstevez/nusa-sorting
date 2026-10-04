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

/** Texture of an item type; `marks` is the colour-blind version, with the variant badge. */
export const itemTextureKey = (type: ItemType, marks: boolean) => `item:${type}${marks ? ':marked' : ''}`;

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

/**
 * Rasterizes the icon of every item type the levels use, once, before the game starts: with and without the
 * colour-blind badge, so switching the mode needs no waiting.
 */
export async function prepareItemTextures(scene: Phaser.Scene): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const type of levelItemTypes())
    for (const marks of [false, true])
      jobs.push(addSvgTexture(scene.textures, itemTextureKey(type, marks), renderItemSvg(type, marks), ITEM_TEXTURE_SIZE));
  await Promise.all(jobs);
}
