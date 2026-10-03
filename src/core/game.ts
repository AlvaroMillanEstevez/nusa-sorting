import type { GameEvent, GameState, Item, Layer, MoveResult, Position, Shelf } from './types';

export function itemAt(state: GameState, pos: Position): Item | null {
  return state.shelves[pos.shelf]?.layers[pos.layer]?.[pos.slot] ?? null;
}

/** Current position of an item by id, or null if it is no longer on the board. */
export function findItem(state: GameState, itemId: number): Position | null {
  for (let shelf = 0; shelf < state.shelves.length; shelf++) {
    const layers = state.shelves[shelf]!.layers;
    for (let layer = 0; layer < layers.length; layer++) {
      const slot = layers[layer]!.findIndex((item) => item?.id === itemId);
      if (slot !== -1) return { shelf, layer, slot };
    }
  }
  return null;
}

export function countItems(state: GameState): number {
  let total = 0;
  for (const shelf of state.shelves) {
    for (const layer of shelf.layers) {
      for (const slot of layer) if (slot) total++;
    }
  }
  return total;
}

export function isWon(state: GameState): boolean {
  return countItems(state) === 0;
}

/** Indices of empty slots in a shelf's front layer. */
export function freeFrontSlots(state: GameState, shelf: number): number[] {
  const front = state.shelves[shelf]?.layers[0];
  if (!front) return [];
  return front.flatMap((slot, i) => (slot === null ? [i] : []));
}

function isValidPosition(state: GameState, pos: Position): boolean {
  const shelf = state.shelves[pos.shelf];
  const layer = shelf?.layers[pos.layer];
  return layer !== undefined && Number.isInteger(pos.slot) && pos.slot >= 0 && pos.slot < layer.length;
}

/**
 * Moves the item at `from` to the empty slot `to`. Both must be in a front layer; `to` may be on the same
 * shelf (reordering). Invalid moves return the reason and leave the state untouched.
 */
export function moveItem(state: GameState, from: Position, to: Position): MoveResult {
  if (isWon(state)) return { ok: false, reason: 'gameOver' };
  if (!isValidPosition(state, from) || !isValidPosition(state, to)) return { ok: false, reason: 'invalidPosition' };
  if (from.shelf === to.shelf && from.layer === to.layer && from.slot === to.slot) {
    return { ok: false, reason: 'samePosition' };
  }
  if (from.layer !== 0 || to.layer !== 0) return { ok: false, reason: 'notFrontLayer' };

  const item = itemAt(state, from);
  if (!item) return { ok: false, reason: 'sourceEmpty' };
  if (freeFrontSlots(state, to.shelf).length === 0) return { ok: false, reason: 'shelfFull' };
  if (itemAt(state, to)) return { ok: false, reason: 'targetOccupied' };

  const shelves = state.shelves.slice();
  shelves[from.shelf] = setFrontSlot(shelves[from.shelf]!, from.slot, null);
  shelves[to.shelf] = setFrontSlot(shelves[to.shelf]!, to.slot, item);

  const events: GameEvent[] = [{ kind: 'moved', itemId: item.id, from, to }];
  // Destination first: that is where a triple can form.
  shelves[to.shelf] = settleShelf(shelves[to.shelf]!, to.shelf, events);
  shelves[from.shelf] = settleShelf(shelves[from.shelf]!, from.shelf, events);

  const next: GameState = { shelves };
  if (isWon(next)) events.push({ kind: 'won' });
  return { ok: true, state: next, events };
}

function setFrontSlot(shelf: Shelf, slot: number, value: Item | null): Shelf {
  const front = shelf.layers[0]!.slice();
  front[slot] = value;
  return { layers: [front, ...shelf.layers.slice(1)] };
}

/** Clears front triples and advances back layers until the shelf is stable. */
function settleShelf(shelf: Shelf, index: number, events: GameEvent[]): Shelf {
  let layers: readonly Layer[] = shelf.layers;
  for (;;) {
    const front = layers[0]!;
    const first = front[0];
    if (first && front.every((slot) => slot?.type === first.type)) {
      events.push({
        kind: 'tripleCleared',
        shelf: index,
        itemType: first.type,
        itemIds: front.map((slot) => slot!.id),
      });
      layers = [front.map(() => null), ...layers.slice(1)];
      continue;
    }
    if (layers.length > 1 && front.every((slot) => slot === null)) {
      layers = layers.slice(1);
      events.push({ kind: 'layerAdvanced', shelf: index, remainingLayers: layers.length });
      continue;
    }
    return { layers };
  }
}
