import { parseItemType } from '../data/itemCatalog';
import { ITEM_ART } from './art/itemArt';

/**
 * How items sit in taller-than-wide slots (a test, see setSlotAspect): every item rests on the shelf's base, and
 * items that are tall by nature (glasses, kites, lanterns) grow into the extra height. Items are only ever
 * scaled uniformly, never stretched.
 */

/**
 * Where each item's drawing is inside its 100 x 100 box, without its soft shadow: [left, top, right, bottom].
 * Measured on the pictures by tools/art/build_game_art.py.
 */
export const ITEM_BOUNDS: Readonly<Record<string, readonly [number, number, number, number]>> = Object.fromEntries(
  Object.entries(ITEM_ART).map(([kind, art]) => [kind, art.bounds]),
);

/** Line (in picture units, of 100) every item's foot is moved to when items rest on the shelf's base. */
export const BASELINE = 95;
/** An item at most this wide for its height (width / height) is tall by nature and may use extra height. */
export const TALL_RATIO = 0.85;
/** A tall item may fill at most this share of the slot's width when it grows. */
const MAX_WIDTH_SHARE = 0.98;

export interface ItemFit {
  /** Uniform scale over the normal item size. */
  readonly scale: number;
  /** Downward shift in item sizes (of the scaled item), so its foot rests on the base. */
  readonly drop: number;
}

const NONE: ItemFit = { scale: 1, drop: 0 };

/**
 * How an item of `kind` fits a slot `aspect` times as tall as wide. Square slots (aspect 1) keep today's look
 * exactly. Taller ones rest every item on the base and let tall items grow, uniformly, into the extra height.
 */
export function itemFit(kind: string, aspect: number): ItemFit {
  const bounds = ITEM_BOUNDS[kind];
  if (aspect <= 1 || !bounds) return NONE;
  const [left, top, right, bottom] = bounds;
  const width = right - left;
  const height = bottom - top;
  const scale = width / height <= TALL_RATIO ? Math.max(1, Math.min(aspect, (100 * MAX_WIDTH_SHARE) / width)) : 1;
  return { scale, drop: (BASELINE - bottom) / 100 };
}

/**
 * Where an item goes in a slot whose square-item centre is `slotY` (ShelfLayout.slots): its centre and its size
 * in px, for a slot `slotSize` wide, items filling `fill` of it, the item's fit and an extra scale (selected, back
 * layer). With aspect 1 this is the slot centre and the plain size.
 */
export function placeItem(slotY: number, slotSize: number, fill: number, fit: ItemFit, scale = 1): { y: number; size: number } {
  const size = slotSize * fill * fit.scale * scale;
  return { y: slotY + (slotSize * fill * scale) / 2 - size / 2 + fit.drop * size, size };
}

/** The fit of an item type id (variants fit like their kind) in slots of the current aspect. */
export function typeFit(type: string, aspect: number): ItemFit {
  return itemFit(parseItemType(type)?.kind.id ?? type, aspect);
}
