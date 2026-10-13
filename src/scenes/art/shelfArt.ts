import type * as Phaser from 'phaser';
import shelfUrl from '../../assets/art/shelf.webp?url';
import cubbyUrl from '../../assets/art/cubby.webp?url';
import { SIDE_PAD, slotAspect, type ShelfLayout } from '../../ui/boardLayout';
import { CUBBY_ART, SHELF_ART, type ShelfArt } from '../../ui/art/itemArt';

/**
 * The illustrated shelf (three compartments) and fixed-stack cubby (one), from tools/art/build_game_art.py. Both
 * are drawn in slot units and scale uniformly with the slot size: the compartments fall on the slots, the top
 * beam sticks out a little above the shelf's box and the front board fills its bottom.
 */
export const SHELF_TEXTURE = 'art:shelf';
export const CUBBY_TEXTURE = 'art:cubby';

async function load(textures: Phaser.Textures.TextureManager, key: string, url: string): Promise<void> {
  if (textures.exists(key)) return;
  const image = new Image();
  image.src = url;
  await image.decode();
  if (!textures.exists(key)) textures.addImage(key, image);
}

/** Downloads both pictures (small; the board needs them before it can be drawn; see also ArtSet's loadArtPieces). */
export function loadShelfArt(textures: Phaser.Textures.TextureManager): Promise<void> {
  return Promise.all([load(textures, SHELF_TEXTURE, shelfUrl), load(textures, CUBBY_TEXTURE, cubbyUrl)]).then(() => undefined);
}

/** Where a picture of `art` goes for a box whose top is `top` and whose first slot's centre is at `firstSlotX`. */
function frame(art: ShelfArt, firstSlotX: number, top: number, s: number): { x: number; y: number; width: number; height: number } {
  const firstCentre = art.firstCentre ?? art.width / 2;
  return {
    x: firstSlotX - firstCentre * s,
    y: top - art.overhangTop * s,
    width: art.width * s,
    // The back wall follows the slot's height (1.2 in the game, where the picture is not stretched at all).
    height: (art.beam + slotAspect() + art.plank) * s,
  };
}

/** The picture of a shelf laid out at `shelf`, with slots `s` px wide, its top-left corner at (x, y) of `shelf.rect`. */
export function shelfFrame(shelf: ShelfLayout, s: number): { x: number; y: number; width: number; height: number } {
  return frame(SHELF_ART, shelf.rect.x + (SIDE_PAD + 0.5) * s, shelf.rect.y, s);
}

/** Places (or moves) an image of the shelf at `shelf`. */
export function placeShelf(image: Phaser.GameObjects.Image, shelf: ShelfLayout, s: number, dx = 0, dy = 0): Phaser.GameObjects.Image {
  const f = shelfFrame(shelf, s);
  return image.setTexture(SHELF_TEXTURE).setOrigin(0).setPosition(f.x + dx, f.y + dy).setDisplaySize(f.width, f.height);
}

/**
 * The cubby of a fixed stack whose item is placed at (cx, cy) (the centre of a square item standing on the slot's
 * base, as on shelves), for slots `s` px wide: the same wood and scale as a shelf, its floor under the item.
 */
export function cubbyFrame(cx: number, cy: number, s: number): { x: number; y: number; width: number; height: number } {
  const base = cy + s / 2;
  return {
    x: cx - (CUBBY_ART.width * s) / 2,
    y: base - (CUBBY_ART.beam + slotAspect()) * s,
    width: CUBBY_ART.width * s,
    height: (CUBBY_ART.beam + slotAspect() + CUBBY_ART.plank) * s,
  };
}

/** Where the front board of a cubby placed with cubbyFrame is: its centre's y. */
export const cubbyBoardY = (cy: number, s: number) => cy + s / 2 + (CUBBY_ART.plank * s) / 2;

/** The middle of the inside of a cubby placed with cubbyFrame, between its top beam and its floor. */
export const cubbyInsideY = (cy: number, s: number) => cy + s / 2 - (slotAspect() * s) / 2;
