import { stackOf, type GameEvent, type GameState, type LevelDefinition } from '../src/core';

/** All item ids currently in play (shelves, then tracks and the held item), in board order. */
export function itemIds(state: GameState): number[] {
  const shelves = state.shelves.flatMap((shelf) =>
    shelf.layers.flatMap((layer) => layer.flatMap((slot) => (slot ? [slot.id] : []))),
  );
  const tracks = state.tracks.flatMap((track) => track.carriers.flatMap((carrier) => stackOf(carrier).map((item) => item.id)));
  const held = state.held ? [state.held.item.id] : [];
  return [...shelves, ...tracks, ...held];
}
export * from '../tools/simulator';

/**
 * Combo and score became a base rule of every level after these recordings were made. Levels that did not
 * have the combo mechanic then now also emit comboChanged and scoreChanged; those are left out of the
 * comparison so the recordings keep proving the board itself (moves, triples, layers, unlocks, blocker, wins,
 * defeats and timers) behaves exactly as before. Levels that already had combos compare every event.
 */
export function hadCombo(level: LevelDefinition): boolean {
  return (level.mechanics ?? []).some((m) => m.kind === 'combo');
}

export function boardEvents(events: readonly GameEvent[], level: LevelDefinition): GameEvent[] {
  if (hadCombo(level)) return [...events];
  return events.filter((e) => e.kind !== 'comboChanged' && e.kind !== 'scoreChanged');
}

/** Event kinds without the score and combo ones, for tests about how the board itself behaves. */
export function boardKinds(events: readonly GameEvent[]): string[] {
  return events.filter((e) => e.kind !== 'comboChanged' && e.kind !== 'scoreChanged').map((e) => e.kind);
}

/**
 * The golden recordings were made when levels used placeholder type ids. Levels 1-14 now use catalogue ids;
 * this maps them back so recorded events (tripleCleared.itemType) still compare one to one.
 */
export const LEGACY_ITEM_TYPES: Readonly<Record<string, string>> = {
  rambutan: 'apple',
  'nasi-goreng': 'banana',
  manggis: 'grape',
  ketupat: 'lime',
  sate: 'blueberry',
};

/** Events as the golden recordings name them: board events only (see boardEvents) and legacy type ids. */
export function asRecorded(events: readonly GameEvent[], level: LevelDefinition): GameEvent[] {
  return boardEvents(events, level).map((e) =>
    e.kind === 'tripleCleared' ? { ...e, itemType: LEGACY_ITEM_TYPES[e.itemType] ?? e.itemType } : e,
  );
}
