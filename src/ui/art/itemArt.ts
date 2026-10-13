import art from '../../assets/art/art.json';

/**
 * Measures of the illustrated art, written by tools/art/build_game_art.py next to the pictures (art.json): pure
 * data, so layouts and tests use it without loading any picture.
 */

export interface ItemArt {
  /** Where the drawing is in its 100 × 100 box, without its soft shadow: [left, top, right, bottom]. */
  readonly bounds: readonly [number, number, number, number];
  /** Dark outline: shown with a warm halo behind it, so it stands out from the shelves' dark back wall. */
  readonly halo: boolean;
  /** Main hue (degrees) and the share of the item it covers: what the colour variants recolour. */
  readonly hue: number;
  readonly share: number;
}

export const ITEM_ART: Readonly<Record<string, ItemArt>> = art.items as unknown as Record<string, ItemArt>;

/** Size of the item pictures, in px. */
export const ITEM_PICTURE_SIZE: number = art.itemSize;

/**
 * The illustrated shelf (shelf.webp) and fixed-stack cubby (cubby.webp), in slot units: the picture's width, where
 * its first compartment's centre is, and its rows' heights (top beam, back wall, front board). The beam sticks out
 * `overhangTop` above the shelf's box.
 */
export interface ShelfArt {
  readonly image: readonly [number, number];
  readonly width: number;
  readonly firstCentre?: number;
  readonly beam: number;
  readonly slot: number;
  readonly plank: number;
  readonly overhangTop: number;
}

export const SHELF_ART: ShelfArt = art.shelf as unknown as ShelfArt;
export const CUBBY_ART: ShelfArt = art.cubby as unknown as ShelfArt;
