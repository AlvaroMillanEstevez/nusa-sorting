import { parseItemType } from '../data/itemCatalog';

/**
 * How items sit in taller-than-wide slots (a test, see setSlotAspect): every item rests on the shelf's base, and
 * items that are tall by nature (glasses, kites, lanterns) grow into the extra height. Icons are only ever
 * scaled uniformly, never stretched.
 */

/**
 * Where each icon's drawing is inside its 100 x 100 box, without its soft shadow: [left, top, right, bottom].
 * Measured by rasterizing every icon at 200 px (2026-10-07); measure again when an icon changes.
 */
export const ITEM_BOUNDS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  'arum-manis': [14.5, 7.5, 88, 100],
  'ayam-goreng': [7, 1, 100, 89.5],
  'bakso': [8, 29.5, 92, 92.5],
  'balon': [16, 3.5, 84, 100],
  'batik': [8, 22.5, 92, 90],
  'bendera': [1.5, 1, 94, 98.5],
  'bianglala': [10.5, 7, 89.5, 98],
  'bintang-laut': [6, 8, 94, 92],
  'blangkon': [10, 20.5, 94, 80],
  'cabai': [12.5, 0, 90, 89],
  'caping': [1.5, 7, 98.5, 86.5],
  'dadar-gulung': [12.5, 18.5, 86, 88],
  'durian': [7.5, 6, 92.5, 95],
  'es-cendol': [12, 1.5, 88, 92],
  'es-kelapa-muda': [14.5, 0, 85.5, 94],
  'es-teh-manis': [20.5, 0, 79.5, 94],
  'gado-gado': [0.5, 37, 99.5, 93],
  'gong': [4, 10, 96, 94],
  'ikan-bakar': [6, 21, 94, 89.5],
  'jamu': [18.5, 3.5, 94, 94],
  'jaring': [2.5, 21.5, 97.5, 95],
  'karung': [15, 10, 85, 94],
  'kelapa': [7, 19.5, 100, 96.5],
  'kok': [18.5, 7.5, 81.5, 92],
  'raket': [24, 4.5, 94.5, 100],
  'sepak-takraw': [10, 12, 90, 92],
  'sepatu': [1, 15.5, 100, 92],
  'piala': [10, 10, 89.5, 94],
  'peluit': [5, 2, 98.5, 91],
  'gasing': [10, 1.5, 90, 98],
  'congklak': [0, 31.5, 100, 85.5],
  'egrang': [9.5, 1.5, 90.5, 96.5],
  'yoyo': [12, 0.5, 88, 94],
  'bekel': [8.5, 13, 95.5, 96],
  'lompat-tali': [5, 29, 95, 75],
  'cengkeh': [0, 1.5, 100, 86],
  'pala': [14.5, 20.5, 94, 92],
  'kayu-manis': [4, 15, 98, 88.5],
  'lada': [25, 0, 92, 91],
  'cobek': [5.5, 9, 94.5, 92],
  'karung-rempah': [12, 8.5, 89.5, 94],
  'padi': [9.5, 6, 86.5, 97.5],
  'cangkul': [6.5, 8, 96.5, 100],
  'orang-orangan': [3, 1.5, 97, 100],
  'kerbau': [1.5, 10, 98.5, 90],
  'bakul': [6, 19.5, 94, 93],
  'gubuk': [1.5, 0, 98.5, 98],
  'komodo': [0, 33.5, 100, 86.5],
  'orangutan': [1, 3.5, 99, 96.5],
  'rangkong': [0, 19.5, 98.5, 96.5],
  'penyu': [1.5, 2.5, 98.5, 94],
  'cendrawasih': [14.5, 11, 96.5, 100],
  'tarsius': [0, 4, 100, 94.5],
  'kelereng': [9.5, 25, 87, 99],
  'kembang-api': [14.5, 1, 85.5, 100],
  'kendang': [5, 31.5, 96, 81.5],
  'kerang': [5.5, 37, 94.5, 96],
  'kerupuk-udang': [5.5, 12, 92, 92],
  'ketupat': [14, 0, 86, 90],
  'kipas': [1, 33.5, 99, 89],
  'klepon': [3.5, 26, 96.5, 93],
  'lampion': [14.5, 0.5, 85.5, 100],
  'layangan': [16.5, 1.5, 83.5, 100],
  'manggis': [2, 4, 93, 97.5],
  'martabak-manis': [10, 24.5, 87.5, 85.5],
  'mie-goreng': [1.5, 4, 98.5, 93],
  'nasi-goreng': [1.5, 21, 98.5, 91],
  'onde-onde': [12, 17.5, 88, 93],
  'panjat-pinang': [7, 0.5, 94, 98],
  'peci': [10, 25, 90, 77],
  'pinisi': [1.5, 9, 98.5, 90.5],
  'pisang-goreng': [7.5, 25, 97.5, 95],
  'rambutan': [4, 12, 96, 100],
  'rendang': [1.5, 37.5, 100, 88],
  'salak': [4, 0, 85.5, 94],
  'sate': [7.5, 15.5, 97, 83.5],
  'tahu-goreng': [8, 24, 94, 92],
  'tempe': [1.5, 33, 98.5, 94],
  'terompet': [5, 13.5, 90, 87],
  'topeng': [0, 11, 100, 93],
  'wayang-kulit': [7, 0, 93, 100],
};

/** Line (in icon units, of 100) every item's foot is moved to when items rest on the shelf's base. */
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
