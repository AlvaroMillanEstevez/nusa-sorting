import { LevelError, type LevelDefinition } from './level';
import type { ItemType } from './types';

/**
 * Where a level's items start in one arrangement of it. The level keeps everything else (layout, shelves,
 * layers, mechanics, time, types); only which item sits where changes, so a level cannot be solved from memory.
 */
export interface Arrangement {
  /** Same shape as LevelDefinition.shelves: every shelf keeps its number of layers. */
  readonly shelves: LevelDefinition['shelves'];
  /**
   * One entry per track of the 'tracks' mechanic: its stacks, top first, as many as the track has carriers;
   * null for a track of shelves (their items are in `shelves`). Omitted in levels without tracks.
   */
  readonly stacks?: readonly (readonly (readonly ItemType[])[] | null)[];
}

/** How many arrangements a level has: its own (arrangement 0) and its `arrangements`. */
export function arrangementCount(level: LevelDefinition): number {
  return 1 + (level.arrangements?.length ?? 0);
}

/**
 * The arrangement to play: 0 the first time, and after that a different one each attempt, going round all of
 * them in turn. `last` is the one played last time, if any.
 */
export function nextArrangement(count: number, last: number | undefined): number {
  if (last === undefined || !Number.isInteger(last) || last < 0 || last >= count) return 0;
  return (last + 1) % count;
}

/**
 * The level with arrangement `index` in place (0 is the level as written), without its list of arrangements.
 * Throws a LevelError if the arrangement does not exist or changes more than where the items are.
 */
export function withArrangement(level: LevelDefinition, index: number): LevelDefinition {
  const { arrangements, ...base } = level;
  if (index === 0) return base;
  const arrangement = arrangements?.[index - 1];
  if (!Number.isInteger(index) || !arrangement) throw new LevelError(`${level.id}: no arrangement ${index}`);
  const fail = (message: string): never => {
    throw new LevelError(`${level.id}: arrangement ${index} ${message}`);
  };

  if (arrangement.shelves.length !== level.shelves.length) fail('has a different number of shelves');
  arrangement.shelves.forEach((layers, s) => {
    if (layers.length !== level.shelves[s]!.length) fail(`gives shelf ${s} a different number of layers`);
  });

  let mechanics = level.mechanics;
  const tracksMechanic = level.mechanics?.find((m) => m.kind === 'tracks');
  if (tracksMechanic?.kind === 'tracks') {
    const stacks = arrangement.stacks;
    if (!stacks || stacks.length !== tracksMechanic.tracks.length) fail('needs one entry per track');
    const tracks = tracksMechanic.tracks.map((track, t) => {
      const ofShelves = track.carriers.some((c) => 'shelf' in c);
      const these = stacks![t];
      if (ofShelves) {
        if (these !== null) fail(`gives stacks to track ${t}, which carries shelves`);
        return track;
      }
      if (!these || these.length !== track.carriers.length) fail(`needs one stack per carrier of track ${t}`);
      return { ...track, carriers: these! };
    });
    mechanics = level.mechanics!.map((m) => (m === tracksMechanic ? { ...tracksMechanic, tracks } : m));
  } else if (arrangement.stacks !== undefined) {
    fail('has stacks but the level has no tracks');
  }

  const result: LevelDefinition = { ...base, shelves: arrangement.shelves, ...(mechanics ? { mechanics } : {}) };
  if (itemList(result) !== itemList(base)) fail('holds different items');
  return result;
}

/** Every item of the level, sorted, as one string: equal for two arrangements of the same items. */
function itemList(level: LevelDefinition): string {
  const items: ItemType[] = level.shelves.flat(2).filter((t): t is ItemType => t !== null);
  for (const m of level.mechanics ?? []) {
    if (m.kind === 'tracks') for (const track of m.tracks) for (const c of track.carriers) if (!('shelf' in c)) items.push(...c);
    if (m.kind === 'conveyor') items.push(...m.slots.filter((t): t is ItemType => t !== null));
  }
  return items.sort().join('\n');
}
