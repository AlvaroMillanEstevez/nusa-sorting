import { areConfusable, ITEM_KINDS, itemTypeId, STARTER_KINDS } from '../../src/data/itemCatalog';

function kindOrder(): { order: string[]; withoutLookAlikes: number } {
  const order = [...STARTER_KINDS];
  const deferred: string[] = [];
  // Cultural objects are left to themed levels for now.
  for (const kind of ITEM_KINDS.filter((k) => k.category !== 'cultural').map((k) => k.id)) {
    if (order.includes(kind)) continue;
    if (order.some((taken) => areConfusable(taken, kind))) deferred.push(kind);
    else order.push(kind);
  }
  return { order: [...order, ...deferred], withoutLookAlikes: order.length };
}

const { order, withoutLookAlikes } = kindOrder();

/**
 * The order in which levels take their item types, one triple each: the starter kinds first, then the rest of
 * the catalogue (a kind that could be mixed up with one already taken waits until every other kind is in).
 */
export const KIND_ORDER: readonly string[] = order;

/** How many types a level can have before two of a confusable group must share it. */
export const TYPES_WITHOUT_LOOK_ALIKES = withoutLookAlikes;

/** How many types a level can have before it needs colour variants. */
export const TYPES_WITHOUT_VARIANTS = KIND_ORDER.length;

/** The first `count` item types: every kind in KIND_ORDER, then alt1 of each, then alt2 of each. */
export function levelTypes(count: number): string[] {
  const all = [...KIND_ORDER, ...KIND_ORDER.map((k) => itemTypeId(k, 'alt1')), ...KIND_ORDER.map((k) => itemTypeId(k, 'alt2'))];
  if (count > all.length) throw new Error(`a level cannot have ${count} types: the catalogue has ${all.length}`);
  return all.slice(0, count);
}
