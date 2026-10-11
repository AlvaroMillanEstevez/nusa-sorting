/**
 * Catalogue of item kinds. Levels and the core refer to items by type id only; this is where a kind gets its
 * names, category and colour family. Ids are stable: never rename one once levels use it.
 *
 * Each kind comes in VARIANTS: the original colours and two alternatives. A variant is a different item type
 * for the rules (an original tempe and a blue tempe never make a triple together); see itemTypeId.
 */

import { themeById, type ThemeId } from './themes';

/** Food kinds, plus cultural objects (not food) that themed levels bring. */
export type ItemCategory = 'dish' | 'snack' | 'sweet' | 'drink' | 'fruit' | 'other' | 'cultural';

/** Main colour of the kind as players see it; used to keep similar-looking kinds apart. */
export type ColorFamily = 'red' | 'orange' | 'yellow' | 'green' | 'brown' | 'cream' | 'purple' | 'pink' | 'white';

export interface ItemKind {
  readonly id: string;
  readonly name: { readonly en: string; readonly id: string };
  readonly category: ItemCategory;
  readonly colorFamily: ColorFamily;
  /** Cultural objects belong to a theme, and first appear in its level (see unlockLevel). */
  readonly theme?: ThemeId;
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

  // Budaya Jawa (level 5).
  { id: 'blangkon', name: { en: 'Blangkon headcloth', id: 'Blangkon' }, category: 'cultural', colorFamily: 'brown', theme: 'budaya-jawa' },
  { id: 'batik', name: { en: 'Folded batik cloth', id: 'Kain batik' }, category: 'cultural', colorFamily: 'brown', theme: 'budaya-jawa' },
  { id: 'wayang-kulit', name: { en: 'Shadow puppet', id: 'Wayang kulit' }, category: 'cultural', colorFamily: 'yellow', theme: 'budaya-jawa' },
  { id: 'kendang', name: { en: 'Kendang drum', id: 'Kendang' }, category: 'cultural', colorFamily: 'brown', theme: 'budaya-jawa' },
  { id: 'gong', name: { en: 'Gong', id: 'Gong' }, category: 'cultural', colorFamily: 'yellow', theme: 'budaya-jawa' },
  { id: 'caping', name: { en: 'Conical straw hat', id: 'Caping' }, category: 'cultural', colorFamily: 'cream', theme: 'budaya-jawa' },
  { id: 'kipas', name: { en: 'Folding fan', id: 'Kipas' }, category: 'cultural', colorFamily: 'red', theme: 'budaya-jawa' },
  // 17 Agustus (level 10).
  { id: 'bendera', name: { en: 'Red and white flag', id: 'Bendera merah putih' }, category: 'cultural', colorFamily: 'red', theme: '17-agustus' },
  { id: 'karung', name: { en: 'Sack race sack', id: 'Karung balap' }, category: 'cultural', colorFamily: 'brown', theme: '17-agustus' },
  { id: 'kelereng', name: { en: 'Marble on a spoon', id: 'Lomba kelereng' }, category: 'cultural', colorFamily: 'white', theme: '17-agustus' },
  { id: 'panjat-pinang', name: { en: 'Greasy pole', id: 'Panjat pinang' }, category: 'cultural', colorFamily: 'brown', theme: '17-agustus' },
  { id: 'peci', name: { en: 'Peci cap', id: 'Peci' }, category: 'cultural', colorFamily: 'white', theme: '17-agustus' },
  { id: 'terompet', name: { en: 'Paper trumpet', id: 'Terompet kertas' }, category: 'cultural', colorFamily: 'red', theme: '17-agustus' },
  // Pasar malam (level 15).
  { id: 'lampion', name: { en: 'Paper lantern', id: 'Lampion' }, category: 'cultural', colorFamily: 'red', theme: 'pasar-malam' },
  { id: 'arum-manis', name: { en: 'Cotton candy', id: 'Arum manis' }, category: 'cultural', colorFamily: 'pink', theme: 'pasar-malam' },
  { id: 'balon', name: { en: 'Balloon', id: 'Balon' }, category: 'cultural', colorFamily: 'red', theme: 'pasar-malam' },
  { id: 'topeng', name: { en: 'Toy mask', id: 'Topeng mainan' }, category: 'cultural', colorFamily: 'yellow', theme: 'pasar-malam' },
  { id: 'kembang-api', name: { en: 'Fireworks', id: 'Kembang api' }, category: 'cultural', colorFamily: 'yellow', theme: 'pasar-malam' },
  { id: 'bianglala', name: { en: 'Ferris wheel', id: 'Bianglala' }, category: 'cultural', colorFamily: 'purple', theme: 'pasar-malam' },
  // Laut Nusantara (level 20).
  { id: 'pinisi', name: { en: 'Pinisi schooner', id: 'Kapal pinisi' }, category: 'cultural', colorFamily: 'brown', theme: 'laut-nusantara' },
  { id: 'kerang', name: { en: 'Seashell', id: 'Kerang' }, category: 'cultural', colorFamily: 'pink', theme: 'laut-nusantara' },
  { id: 'bintang-laut', name: { en: 'Starfish', id: 'Bintang laut' }, category: 'cultural', colorFamily: 'orange', theme: 'laut-nusantara' },
  { id: 'jaring', name: { en: 'Fishing net', id: 'Jaring ikan' }, category: 'cultural', colorFamily: 'cream', theme: 'laut-nusantara' },
  { id: 'layangan', name: { en: 'Beach kite', id: 'Layangan' }, category: 'cultural', colorFamily: 'red', theme: 'laut-nusantara' },
  { id: 'kelapa', name: { en: 'Coconut', id: 'Kelapa' }, category: 'cultural', colorFamily: 'brown', theme: 'laut-nusantara' },
  // Olahraga (level 25).
  { id: 'kok', name: { en: 'Shuttlecock', id: 'Kok bulu tangkis' }, category: 'cultural', colorFamily: 'white', theme: 'olahraga' },
  { id: 'raket', name: { en: 'Badminton racket', id: 'Raket bulu tangkis' }, category: 'cultural', colorFamily: 'red', theme: 'olahraga' },
  { id: 'sepak-takraw', name: { en: 'Sepak takraw ball', id: 'Bola sepak takraw' }, category: 'cultural', colorFamily: 'yellow', theme: 'olahraga' },
  { id: 'bola', name: { en: 'Football', id: 'Bola sepak' }, category: 'cultural', colorFamily: 'white', theme: 'olahraga' },
  { id: 'piala', name: { en: 'Trophy', id: 'Piala' }, category: 'cultural', colorFamily: 'yellow', theme: 'olahraga' },
  { id: 'peluit', name: { en: 'Whistle', id: 'Peluit' }, category: 'cultural', colorFamily: 'red', theme: 'olahraga' },
  // Permainan tradisional (level 30).
  { id: 'gasing', name: { en: 'Spinning top', id: 'Gasing' }, category: 'cultural', colorFamily: 'brown', theme: 'permainan-tradisional' },
  { id: 'congklak', name: { en: 'Congklak board', id: 'Congklak' }, category: 'cultural', colorFamily: 'brown', theme: 'permainan-tradisional' },
  { id: 'egrang', name: { en: 'Bamboo stilts', id: 'Egrang' }, category: 'cultural', colorFamily: 'yellow', theme: 'permainan-tradisional' },
  { id: 'yoyo', name: { en: 'Yo-yo', id: 'Yoyo' }, category: 'cultural', colorFamily: 'red', theme: 'permainan-tradisional' },
  { id: 'bekel', name: { en: 'Bekel ball and jacks', id: 'Bola bekel' }, category: 'cultural', colorFamily: 'pink', theme: 'permainan-tradisional' },
  { id: 'lompat-tali', name: { en: 'Rubber band rope', id: 'Lompat tali karet' }, category: 'cultural', colorFamily: 'green', theme: 'permainan-tradisional' },
  // Rempah Maluku (level 35).
  { id: 'cengkeh', name: { en: 'Cloves', id: 'Cengkeh' }, category: 'cultural', colorFamily: 'brown', theme: 'rempah-maluku' },
  { id: 'pala', name: { en: 'Nutmeg with mace', id: 'Pala' }, category: 'cultural', colorFamily: 'red', theme: 'rempah-maluku' },
  { id: 'kayu-manis', name: { en: 'Cinnamon sticks', id: 'Kayu manis' }, category: 'cultural', colorFamily: 'brown', theme: 'rempah-maluku' },
  { id: 'lada', name: { en: 'Peppercorns', id: 'Lada' }, category: 'cultural', colorFamily: 'green', theme: 'rempah-maluku' },
  { id: 'cobek', name: { en: 'Stone mortar and pestle', id: 'Cobek dan ulekan' }, category: 'cultural', colorFamily: 'white', theme: 'rempah-maluku' },
  { id: 'karung-rempah', name: { en: 'Spice sack', id: 'Karung rempah' }, category: 'cultural', colorFamily: 'orange', theme: 'rempah-maluku' },
  // Sawah (level 40).
  { id: 'padi', name: { en: 'Rice ear', id: 'Padi' }, category: 'cultural', colorFamily: 'yellow', theme: 'sawah' },
  { id: 'cangkul', name: { en: 'Hoe', id: 'Cangkul' }, category: 'cultural', colorFamily: 'brown', theme: 'sawah' },
  { id: 'orang-orangan', name: { en: 'Scarecrow', id: 'Orang-orangan sawah' }, category: 'cultural', colorFamily: 'red', theme: 'sawah' },
  { id: 'kerbau', name: { en: 'Water buffalo', id: 'Kerbau' }, category: 'cultural', colorFamily: 'white', theme: 'sawah' },
  { id: 'bakul', name: { en: 'Bamboo rice basket', id: 'Bakul' }, category: 'cultural', colorFamily: 'cream', theme: 'sawah' },
  { id: 'gubuk', name: { en: 'Rice field hut', id: 'Gubuk sawah' }, category: 'cultural', colorFamily: 'yellow', theme: 'sawah' },
  // Fauna Nusantara (level 45).
  { id: 'komodo', name: { en: 'Komodo dragon', id: 'Komodo' }, category: 'cultural', colorFamily: 'green', theme: 'fauna-nusantara' },
  { id: 'orangutan', name: { en: 'Orangutan', id: 'Orang utan' }, category: 'cultural', colorFamily: 'orange', theme: 'fauna-nusantara' },
  { id: 'rangkong', name: { en: 'Hornbill', id: 'Burung rangkong' }, category: 'cultural', colorFamily: 'orange', theme: 'fauna-nusantara' },
  { id: 'penyu', name: { en: 'Sea turtle', id: 'Penyu' }, category: 'cultural', colorFamily: 'brown', theme: 'fauna-nusantara' },
  { id: 'cendrawasih', name: { en: 'Bird of paradise', id: 'Burung cendrawasih' }, category: 'cultural', colorFamily: 'yellow', theme: 'fauna-nusantara' },
  { id: 'tarsius', name: { en: 'Tarsier', id: 'Tarsius' }, category: 'cultural', colorFamily: 'brown', theme: 'fauna-nusantara' },
];

/** The level where a kind first appears: its theme's level for cultural objects, the first level for food. */
export function unlockLevel(kind: ItemKind): number {
  return kind.theme ? themeById(kind.theme)!.level : 1;
}

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
  // A whole coconut and a young coconut drink are both round coconuts.
  ['kelapa', 'es-kelapa-muda'],
  // Both diamonds; the closest pair in greyscale after the gallery check.
  ['layangan', 'ketupat'],
  // Levels 25-45, after the gallery check: two balls patterned with pentagons; two woven containers heaped
  // high; stems radiating with round heads; brown sticks lying aslant; a pointed roof and a conical hat.
  ['sepak-takraw', 'bola'],
  ['karung-rempah', 'bakul'],
  ['cengkeh', 'kembang-api'],
  ['kayu-manis', 'sate'],
  ['gubuk', 'caping'],
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

/** Every item type id in the catalogue: every kind × 3 variants. */
export const ALL_ITEM_TYPES: readonly string[] = ITEM_KINDS.flatMap((k) => VARIANTS.map((v) => itemTypeId(k.id, v)));

/** True if two kinds should not share an early level (same confusable group). */
export function areConfusable(a: string, b: string): boolean {
  return a !== b && CONFUSABLE_GROUPS.some((group) => group.includes(a) && group.includes(b));
}
