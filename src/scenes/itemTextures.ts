import type * as Phaser from 'phaser';
import { createGame, stackOf, type ItemType, type LevelDefinition } from '../core';
import { playList } from './playList';
import { renderItemSvg, renderSilhouette } from '../ui/icons/icons';
import { addSvgTexture } from './svgTexture';

/**
 * Item textures are rasterized from the SVG icons at this size and drawn scaled down to fit their slot
 * (mipmaps keep them smooth). A power of two, and enough for large slots on dense screens.
 */
export const ITEM_TEXTURE_SIZE = 256;

/** Texture of an item type; `marks` is the colour-blind version, with the variant badge. */
export const itemTextureKey = (type: ItemType, marks: boolean) => `item:${type}${marks ? ':marked' : ''}`;

/** Texture of an item seen from behind the one in front of it (see renderSilhouette). */
export const itemBackTextureKey = (type: ItemType) => `item:${type}:back`;

/** The item types one level uses. */
function typesOf(level: LevelDefinition): Set<ItemType> {
  const types = new Set<ItemType>();
  const state = createGame(level);
  for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) types.add(item.type);
  for (const track of state.tracks) for (const carrier of track.carriers) for (const item of stackOf(carrier)) types.add(item.type);
  return types;
}

/** Every item type the playable levels use. */
function levelItemTypes(): Set<ItemType> {
  const types = new Set<ItemType>();
  for (const { level } of playList) for (const type of typesOf(level)) types.add(type);
  return types;
}

/** Rasterizes the icons of `types`: with and without the colour-blind badge, so switching needs no waiting. */
function prepareTypes(scene: Phaser.Scene, types: Iterable<ItemType>): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const type of types) {
    for (const marks of [false, true])
      jobs.push(addSvgTexture(scene.textures, itemTextureKey(type, marks), renderItemSvg(type, marks), ITEM_TEXTURE_SIZE));
    // Same size as the icon, so a sprite keeps its scale when it switches between the two.
    jobs.push(addSvgTexture(scene.textures, itemBackTextureKey(type), renderSilhouette(type), ITEM_TEXTURE_SIZE));
  }
  return Promise.all(jobs).then(() => undefined);
}

/** Rasterizes the icon of every item type the levels use, at once (development pages). */
export function prepareItemTextures(scene: Phaser.Scene): Promise<void> {
  return prepareTypes(scene, levelItemTypes());
}

/**
 * Rasterizes the icons one level needs (already ready ones are skipped). The game waits for this before opening
 * a level, so the first one can be played without waiting for all the others (see prepareAllInBackground).
 */
export function prepareLevelTextures(scene: Phaser.Scene, levelIndex: number): Promise<void> {
  const entry = playList[levelIndex];
  return entry ? prepareTypes(scene, typesOf(entry.level)) : Promise.resolve();
}

let background: Promise<void> | null = null;

/**
 * Resolves when the browser has time to spare, and never sooner than BACKGROUND_GAP after the last time: each
 * icon also costs the GPU an upload, which should never pile up behind the game's frames.
 */
const BACKGROUND_GAP = 80;
function spareTime(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 300 });
      else resolve();
    }, BACKGROUND_GAP);
  });
}

/** Two frames: time for the GPU to take in what was just uploaded before a screen starts drawing. */
export function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Rasterizes every level's icons in the background, one at a time and only in the browser's spare time, so the
 * game keeps its frame rate meanwhile. Started once, after the first screen opens, from the level the player is
 * heading for (`fromLevel`) onwards, then the levels before it; the colour-blind versions come last, unless the
 * mode is on. Levels opened before it gets to them draw their own icons first (prepareLevelTextures).
 */
export function prepareAllInBackground(scene: Phaser.Scene, fromLevel: number, colorBlind: boolean): Promise<void> {
  background ??= (async () => {
    const levels = [...playList.slice(fromLevel), ...playList.slice(0, fromLevel)];
    const types = new Set<ItemType>();
    for (const { level } of levels) for (const type of typesOf(level)) types.add(type);
    const textures = scene.textures;
    const jobs: (readonly [string, () => string])[] = [];
    for (const type of types) {
      jobs.push([itemTextureKey(type, colorBlind), () => renderItemSvg(type, colorBlind)]);
      jobs.push([itemBackTextureKey(type), () => renderSilhouette(type)]);
    }
    for (const type of types) jobs.push([itemTextureKey(type, !colorBlind), () => renderItemSvg(type, !colorBlind)]);
    for (const [key, svg] of jobs) {
      if (!textures.exists(key)) await addSvgTexture(textures, key, svg(), ITEM_TEXTURE_SIZE, spareTime);
    }
  })();
  return background;
}
