import { areConfusable, ITEM_KINDS, itemTypeId, STARTER_KINDS, unlockLevel } from '../../src/data/itemCatalog';

/**
 * Tie-break order between kinds that are equally due: the starter set first, then the rest of the catalogue
 * in catalogue order (cultural objects last).
 */
export const KIND_ORDER: readonly string[] = [...STARTER_KINDS, ...ITEM_KINDS.map((k) => k.id).filter((id) => !STARTER_KINDS.includes(id))];

/**
 * How levels rotate their item types.
 * - `rest`: a kind used in a level scores lower for this many levels after it, so kinds take a break and come
 *   back; after that it is as due as a kind never used.
 * - `featureLevels` and `featureBonus`: for this many levels after a theme's level, its cultural objects score
 *   higher, so players notice them before they join the general rotation.
 */
export interface RotationParams {
  readonly rest: number;
  readonly featureLevels: number;
  readonly featureBonus: number;
}

export const ROTATION: RotationParams = { rest: 3, featureLevels: 4, featureBonus: 3 };

/**
 * The types of level `level`, one triple each: kinds unlocked by then, the most due first (see RotationParams;
 * a themed level takes all its own objects first), keeping look-alikes apart while it can, and colour variants
 * only when every unlocked kind is in. `history` holds the types of the levels before it, by level number.
 */
export function chooseTypes(
  level: number,
  count: number,
  history: ReadonlyMap<number, readonly string[]>,
  params: RotationParams = ROTATION,
): string[] {
  const lastUsed = new Map<string, number>();
  for (const [n, types] of [...history].sort(([a], [b]) => a - b)) {
    if (n >= level) continue;
    for (const type of types) lastUsed.set(type.split(':')[0]!, n);
  }
  const score = (id: string) => {
    const kind = ITEM_KINDS.find((k) => k.id === id)!;
    const unlock = unlockLevel(kind);
    const last = lastUsed.get(id);
    const rest = last === undefined ? params.rest + 1 : Math.min(level - last, params.rest + 1);
    const featured = kind.theme !== undefined && level > unlock && level - unlock <= params.featureLevels;
    return (unlock === level && kind.theme !== undefined ? 1000 : 0) + rest + (featured ? params.featureBonus : 0);
  };
  const eligible = KIND_ORDER.filter((id) => unlockLevel(ITEM_KINDS.find((k) => k.id === id)!) <= level);
  // Stable sort: equal scores keep KIND_ORDER.
  const ranked = [...eligible].sort((a, b) => score(b) - score(a));
  const picked: string[] = [];
  const deferred: string[] = [];
  for (const id of ranked) {
    if (picked.length === count) break;
    if (picked.some((p) => areConfusable(p, id))) deferred.push(id);
    else picked.push(id);
  }
  for (const id of deferred) if (picked.length < count) picked.push(id);
  const kinds = [...picked];
  for (const variant of ['alt1', 'alt2'] as const) {
    for (const id of kinds) if (picked.length < count) picked.push(itemTypeId(id, variant));
  }
  if (picked.length < count) throw new Error(`level ${level} cannot have ${count} types: only ${picked.length} are unlocked`);
  return picked;
}

/** What chooseTypes needs to know about a level: its number, how many types, and any types it pins. */
export interface TypePlanEntry {
  readonly number: number;
  readonly types: number;
  readonly fixedTypes?: readonly string[];
}

/** Every level's types, worked out in level order so each one sees the levels before it. */
export function planTypes(levels: readonly TypePlanEntry[], params: RotationParams = ROTATION): Map<number, string[]> {
  const plan = new Map<number, string[]>();
  for (const entry of [...levels].sort((a, b) => a.number - b.number)) {
    plan.set(entry.number, entry.fixedTypes ? [...entry.fixedTypes] : chooseTypes(entry.number, entry.types, plan, params));
  }
  return plan;
}
