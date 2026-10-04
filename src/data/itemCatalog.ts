/**
 * Catalogue of item kinds. Levels and the core refer to items by type id only; this is where a kind gets its
 * names, category and colour family. Ids are stable: never rename one once levels use it.
 *
 * Each kind comes in VARIANTS: the original colours and two alternatives. A variant is a different item type
 * for the rules (an original tempe and a blue tempe never make a triple together); see itemTypeId.
 */

export type ItemCategory = 'dish' | 'snack' | 'sweet' | 'drink' | 'fruit' | 'other';

/** Main colour of the kind as players see it; used to keep similar-looking kinds apart. */
export type ColorFamily = 'red' | 'orange' | 'yellow' | 'green' | 'brown' | 'cream' | 'purple' | 'pink' | 'white';

export interface ItemKind {
  readonly id: string;
  readonly name: { readonly en: string; readonly id: string };
  readonly category: ItemCategory;
  readonly colorFamily: ColorFamily;
}

export const ITEM_KINDS: readonly ItemKind[] = [
  { id: 'nasi-goreng', name: { en: 'Fried rice', id: 'Nasi goreng' }, category: 'dish', colorFamily: 'orange' },
  { id: 'sate', name: { en: 'Satay', id: 'Sate' }, category: 'dish', colorFamily: 'brown' },
  { id: 'bakso', name: { en: 'Meatball soup', id: 'Bakso' }, category: 'dish', colorFamily: 'brown' },
  { id: 'mie-goreng', name: { en: 'Fried noodles', id: 'Mie goreng' }, category: 'dish', colorFamily: 'yellow' },
  { id: 'rendang', name: { en: 'Rendang', id: 'Rendang' }, category: 'dish', colorFamily: 'brown' },
  { id: 'gado-gado', name: { en: 'Gado-gado salad', id: 'Gado-gado' }, category: 'dish', colorFamily: 'green' },
  { id: 'ayam-goreng', name: { en: 'Fried chicken', id: 'Ayam goreng' }, category: 'dish', colorFamily: 'orange' },
  { id: 'ikan-bakar', name: { en: 'Grilled fish', id: 'Ikan bakar' }, category: 'dish', colorFamily: 'brown' },
  { id: 'ketupat', name: { en: 'Rice cake in woven leaves', id: 'Ketupat' }, category: 'dish', colorFamily: 'green' },
  { id: 'martabak-manis', name: { en: 'Sweet thick pancake', id: 'Martabak manis' }, category: 'sweet', colorFamily: 'yellow' },
  { id: 'tempe', name: { en: 'Tempeh', id: 'Tempe' }, category: 'snack', colorFamily: 'cream' },
  { id: 'tahu-goreng', name: { en: 'Fried tofu', id: 'Tahu goreng' }, category: 'snack', colorFamily: 'yellow' },
  { id: 'pisang-goreng', name: { en: 'Banana fritter', id: 'Pisang goreng' }, category: 'snack', colorFamily: 'orange' },
  { id: 'kerupuk-udang', name: { en: 'Prawn crackers', id: 'Kerupuk udang' }, category: 'snack', colorFamily: 'pink' },
  { id: 'klepon', name: { en: 'Klepon', id: 'Klepon' }, category: 'sweet', colorFamily: 'green' },
  { id: 'onde-onde', name: { en: 'Sesame balls', id: 'Onde-onde' }, category: 'sweet', colorFamily: 'yellow' },
  { id: 'dadar-gulung', name: { en: 'Pandan crepe roll', id: 'Dadar gulung' }, category: 'sweet', colorFamily: 'green' },
  { id: 'es-teh-manis', name: { en: 'Sweet iced tea', id: 'Es teh manis' }, category: 'drink', colorFamily: 'orange' },
  { id: 'es-cendol', name: { en: 'Cendol drink', id: 'Es cendol' }, category: 'drink', colorFamily: 'green' },
  { id: 'es-kelapa-muda', name: { en: 'Young coconut drink', id: 'Es kelapa muda' }, category: 'drink', colorFamily: 'white' },
  { id: 'jamu', name: { en: 'Herbal tonic', id: 'Jamu' }, category: 'drink', colorFamily: 'yellow' },
  { id: 'durian', name: { en: 'Durian', id: 'Durian' }, category: 'fruit', colorFamily: 'green' },
  { id: 'rambutan', name: { en: 'Rambutan', id: 'Rambutan' }, category: 'fruit', colorFamily: 'red' },
  { id: 'manggis', name: { en: 'Mangosteen', id: 'Manggis' }, category: 'fruit', colorFamily: 'purple' },
  { id: 'salak', name: { en: 'Snake fruit', id: 'Salak' }, category: 'fruit', colorFamily: 'brown' },
  { id: 'cabai', name: { en: 'Red chili', id: 'Cabai' }, category: 'other', colorFamily: 'red' },
];

/** Ten clearly different kinds for the first levels. */
export const STARTER_KINDS: readonly string[] = [
  'sate',
  'bakso',
  'nasi-goreng',
  'ketupat',
  'kerupuk-udang',
  'onde-onde',
  'es-teh-manis',
  'rambutan',
  'manggis',
  'durian',
];

/**
 * Kinds easy to mix up at a glance. A level generator must not put two kinds of one group in early levels.
 * bakso/mie-goreng: both brown-and-yellow bowls in a small icon, kept apart until their art proves otherwise.
 */
export const CONFUSABLE_GROUPS: readonly (readonly string[])[] = [
  ['tempe', 'tahu-goreng'],
  ['klepon', 'dadar-gulung'],
  ['bakso', 'mie-goreng'],
];

/** The three colour variants of every kind; 'original' is the kind's own colours. */
export const VARIANTS = ['original', 'alt1', 'alt2'] as const;
export type Variant = (typeof VARIANTS)[number];

/**
 * Item type id of a kind in a variant, as levels and the core use it: the kind id for the original colours,
 * `kind:alt1` / `kind:alt2` for the alternatives. Different variants are different types for the rules.
 */
export function itemTypeId(kind: string, variant: Variant = 'original'): string {
  return variant === 'original' ? kind : `${kind}:${variant}`;
}

/** Kind and variant of an item type id, or null if it is not in the catalogue. */
export function parseItemType(type: string): { kind: ItemKind; variant: Variant } | null {
  const [kindId, variantName = 'original', extra] = type.split(':');
  if (extra !== undefined) return null;
  const kind = ITEM_KINDS.find((k) => k.id === kindId);
  const variant = VARIANTS.find((v) => v === variantName);
  if (!kind || !variant || (variant === 'original' && type.includes(':'))) return null;
  return { kind, variant };
}

/** Every item type id in the catalogue: 26 kinds × 3 variants. */
export const ALL_ITEM_TYPES: readonly string[] = ITEM_KINDS.flatMap((k) => VARIANTS.map((v) => itemTypeId(k.id, v)));

/** True if two kinds should not share an early level (same confusable group). */
export function areConfusable(a: string, b: string): boolean {
  return a !== b && CONFUSABLE_GROUPS.some((group) => group.includes(a) && group.includes(b));
}
