import type * as Phaser from 'phaser';
import { createGame, stackOf, type ItemType, type LevelDefinition } from '../core';
import { parseItemType, type Variant } from '../data/itemCatalog';
import { ITEM_ART } from '../ui/art/itemArt';
import { recolour, silhouette, variantShifts, withHalo, type Pixels } from '../ui/art/itemPixels';
import { playList } from './playList';

/**
 * Item textures are made from the illustrated pictures (src/assets/art/items, smaller than this) drawn into
 * squares of this size and shown scaled down to fit their slot. A power of two, so the GPU keeps mipmaps that
 * make them smooth at every size.
 */
export const ITEM_TEXTURE_SIZE = 256;

const URLS = import.meta.glob('../assets/art/items/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const urlOf = (kind: string) => URLS[`../assets/art/items/${kind}.webp`];

/**
 * Texture of an item type; `marks` is colour-blind mode, which adds a badge to the colour variants (originals look
 * the same either way, so they share one texture).
 */
export const itemTextureKey = (type: ItemType, marks: boolean) => (marks && parseItemType(type)?.variant !== 'original' ? `item:${type}:marked` : `item:${type}`);

/** Texture of an item seen from behind the one in front of it (see silhouette): one per kind, variants share it. */
export const itemBackTextureKey = (type: ItemType) => `item:${parseItemType(type)?.kind.id ?? type}:back`;

const pictures = new Map<string, Promise<HTMLImageElement>>();

/** The picture of a kind, downloaded and decoded once. */
export function picture(kind: string): Promise<HTMLImageElement> {
  let loading = pictures.get(kind);
  if (!loading) {
    const url = urlOf(kind);
    if (!url) throw new Error(`no picture for ${kind}`);
    const image = new Image();
    image.src = url;
    loading = image.decode().then(() => image);
    pictures.set(kind, loading);
  }
  return loading;
}

/** A picture as raw pixels, at the texture size. */
export function pixelsOf(image: HTMLImageElement): Pixels {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ITEM_TEXTURE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE);
  return context.getImageData(0, 0, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE).data;
}

/** A canvas holding `pixels`, with the colour-blind badge of `badge` if given (see drawBadge). */
export function canvasOf(pixels: Pixels, badge: Variant | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ITEM_TEXTURE_SIZE;
  const context = canvas.getContext('2d')!;
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, ITEM_TEXTURE_SIZE, ITEM_TEXTURE_SIZE), 0, 0);
  if (badge) drawBadge(context, badge, ITEM_TEXTURE_SIZE);
  return canvas;
}

/**
 * Colour-free badge in the bottom-right corner, shown only in colour-blind mode: a dot for alt1, a triangle for
 * alt2 (none for the original). Dark with a white ring and a white mark, so it stands out on light and on dark
 * items alike. Without it, variants are told apart by colour and lightness alone.
 */
export function drawBadge(context: CanvasRenderingContext2D, variant: Variant, size: number): void {
  if (variant === 'original') return;
  const u = size / 100;
  context.save();
  context.fillStyle = '#1d2630';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3 * u;
  context.beginPath();
  context.arc(81 * u, 81 * u, 15.5 * u, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffffff';
  context.beginPath();
  if (variant === 'alt1') context.arc(81 * u, 81 * u, 6.5 * u, 0, Math.PI * 2);
  else {
    context.moveTo(81 * u, 71.5 * u);
    context.lineTo(89.5 * u, 86.5 * u);
    context.lineTo(72.5 * u, 86.5 * u);
    context.closePath();
  }
  context.fill();
  context.restore();
}

/** An item type's picture as the game shows it in front: its variant's colours, and the halo if it is dark. */
export function frontPixels(type: ItemType, image: HTMLImageElement): Pixels {
  const parsed = parseItemType(type);
  if (!parsed) throw new Error(`unknown item type ${type}`);
  const art = ITEM_ART[parsed.kind.id]!;
  let pixels = pixelsOf(image);
  if (parsed.variant !== 'original') pixels = recolour(pixels, art.hue, art.share, variantShifts(art.hue)[parsed.variant]);
  return art.halo ? withHalo(pixels, ITEM_TEXTURE_SIZE) : pixels;
}

/** Adds what an item type needs that is not there yet: its picture, its colour-blind version and its silhouette. */
async function prepareType(textures: Phaser.Textures.TextureManager, type: ItemType, marks: readonly boolean[], beforeDrawing?: () => Promise<void>): Promise<void> {
  const parsed = parseItemType(type);
  if (!parsed) throw new Error(`unknown item type ${type}`);
  const keys = [...new Set(marks.map((m) => itemTextureKey(type, m)))];
  const back = itemBackTextureKey(type);
  if (keys.every((key) => textures.exists(key)) && textures.exists(back)) return;
  const image = await picture(parsed.kind.id);
  if (beforeDrawing) await beforeDrawing();
  let front: Pixels | null = null;
  for (const key of keys) {
    if (textures.exists(key)) continue;
    front ??= frontPixels(type, image);
    textures.addImage(key, canvasOf(front, key.endsWith(':marked') ? parsed.variant : null) as unknown as HTMLImageElement);
  }
  if (!textures.exists(back)) textures.addImage(back, canvasOf(silhouette(pixelsOf(image), ITEM_TEXTURE_SIZE), null) as unknown as HTMLImageElement);
}

/** The item types one level uses. */
function typesOf(level: LevelDefinition): Set<ItemType> {
  const types = new Set<ItemType>();
  const state = createGame(level);
  for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) types.add(item.type);
  for (const track of state.tracks) for (const carrier of track.carriers) for (const item of stackOf(carrier)) types.add(item.type);
  return types;
}

/** Prepares `types` with and without the colour-blind badges, so switching the mode needs no waiting. */
export function prepareTypes(scene: Phaser.Scene, types: Iterable<ItemType>): Promise<void> {
  return Promise.all([...types].map((type) => prepareType(scene.textures, type, [false, true]))).then(() => undefined);
}

/** Prepares every item type the levels use, at once (development pages). */
export function prepareItemTextures(scene: Phaser.Scene): Promise<void> {
  const types = new Set<ItemType>();
  for (const { level } of playList) for (const type of typesOf(level)) types.add(type);
  return prepareTypes(scene, types);
}

/**
 * Prepares the items one level needs (ready ones are skipped). The game waits for this before opening a level,
 * so the first one can be played without waiting for all the others (see prepareAheadInBackground).
 */
export function prepareLevelTextures(scene: Phaser.Scene, levelIndex: number): Promise<void> {
  const entry = playList[levelIndex];
  return entry ? prepareTypes(scene, typesOf(entry.level)) : Promise.resolve();
}

/**
 * Resolves when the browser has time to spare, and never sooner than BACKGROUND_GAP after the last time: each
 * item also costs the GPU an upload, which should never pile up behind the game's frames.
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

/** How many levels after the one being opened get their items ready in the background. */
const AHEAD = 2;
let queue: Promise<void> = Promise.resolve();

/**
 * Prepares the items of the next AHEAD levels from `fromLevel` in the background, one at a time and only in the
 * browser's spare time, so the game keeps its frame rate meanwhile and only downloads what is about to be played.
 * Called whenever a level or the map opens; what is ready is skipped. Colour variants' badged versions come too
 * in colour-blind mode.
 */
export function prepareAheadInBackground(scene: Phaser.Scene, fromLevel: number, colorBlind: boolean): Promise<void> {
  const types = new Set<ItemType>();
  for (const { level } of playList.slice(fromLevel, fromLevel + AHEAD)) for (const type of typesOf(level)) types.add(type);
  const textures = scene.textures;
  queue = queue.then(async () => {
    for (const type of types) await prepareType(textures, type, [colorBlind], spareTime);
  });
  return queue;
}
