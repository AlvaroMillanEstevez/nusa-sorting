import type * as Phaser from 'phaser';
import { BOOSTER_IDS, type BoosterId } from '../data/economy';
import { renderBoosterSvg } from '../ui/icons/icons';
import { ITEM_TEXTURE_SIZE } from './itemTextures';
import { addSvgTexture } from './svgTexture';

/** Texture of a booster's colour icon (the same everywhere: the game's bar, the shop, offers and gifts). */
export const boosterTextureKey = (booster: BoosterId) => `booster:${booster}`;

/** Rasterizes the boosters' icons once, before the game starts, at the item icons' size. */
export async function prepareBoosterTextures(scene: Phaser.Scene): Promise<void> {
  await Promise.all(BOOSTER_IDS.map((id) => addSvgTexture(scene.textures, boosterTextureKey(id), renderBoosterSvg(id), ITEM_TEXTURE_SIZE)));
}
