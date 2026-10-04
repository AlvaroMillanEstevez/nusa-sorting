import { nextRandom } from './random';
import type {
  BlockerState,
  Carrier,
  CarrierRef,
  ComboState,
  GameEvent,
  GameState,
  InvalidMoveReason,
  Item,
  Layer,
  MoveResult,
  Position,
  Shelf,
  SlotRef,
  TrackState,
  TickResult,
} from './types';

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
  return total + countTrackItems(state);
}

/** Items on track stacks, including one the player is holding (shelves riding a track count as shelves). */
export function countTrackItems(state: GameState): number {
  let total = state.held ? 1 : 0;
  for (const track of state.tracks) for (const carrier of track.carriers) total += stackOf(carrier).length;
  return total;
}

/** A carrier's stack; shelves riding a track have none (their items are on the shelf). */
export function stackOf(carrier: Carrier): readonly Item[] {
  return carrier.kind === 'stack' ? carrier.stack : [];
}

/** The track and carrier a shelf rides on, or null for a fixed shelf. */
export function carrierOfShelf(state: GameState, shelf: number): CarrierRef | null {
  for (let track = 0; track < state.tracks.length; track++) {
    const carrier = state.tracks[track]!.carriers.findIndex((c) => c.kind === 'shelf' && c.shelf === shelf);
    if (carrier !== -1) return { track, carrier };
  }
  return null;
}

/**
 * Where a carrier is along its track, in carrier units in [0, K): carrier i starts at i and moves `speed`
 * carriers per second of game time, wrapping around. A pure function of the tracks' running time.
 */
export function carrierOffset(track: TrackState, carrier: number, trackTimeMs: number): number {
  const k = track.carriers.length;
  const raw = carrier + (track.speed * trackTimeMs) / 1000;
  return ((raw % k) + k) % k;
}

/** Where an item sits on a track (depth 0 is the top of its stack), or null if it is not on one. */
export function findTrackItem(state: GameState, itemId: number): (CarrierRef & { depth: number }) | null {
  for (let track = 0; track < state.tracks.length; track++) {
    const carriers = state.tracks[track]!.carriers;
    for (let carrier = 0; carrier < carriers.length; carrier++) {
      const depth = stackOf(carriers[carrier]!).findIndex((item) => item.id === itemId);
      if (depth !== -1) return { track, carrier, depth };
    }
  }
  return null;
}

/** The item a carrier offers (top of its stack), or null. */
export function carrierTop(state: GameState, ref: CarrierRef): Item | null {
  const carrier = state.tracks[ref.track]?.carriers[ref.carrier];
  return carrier ? (stackOf(carrier)[0] ?? null) : null;
}

/** True when the board has no items left. */
export function isWon(state: GameState): boolean {
  return countItems(state) === 0;
}

/** A locked shelf neither gives nor takes items, though it may hold some. */
export function isShelfLocked(state: GameState, shelf: number): boolean {
  const unlockAt = state.unlockAt[shelf];
  return unlockAt !== null && unlockAt !== undefined && state.triplesCleared < unlockAt;
}

/** Triples still needed to unlock a shelf; 0 if it is not locked. */
export function triplesToUnlock(state: GameState, shelf: number): number {
  return isShelfLocked(state, shelf) ? state.unlockAt[shelf]! - state.triplesCleared : 0;
}

export function isSlotBlocked(state: GameState, shelf: number, slot: number): boolean {
  const at = state.blocker?.at;
  return at !== undefined && at.shelf === shelf && at.slot === slot;
}

/**
 * Front slots of a shelf that can receive an item: empty, not blocked, on an unlocked shelf.
 * Without mechanics this is simply every empty front slot.
 */
export function freeFrontSlots(state: GameState, shelf: number): number[] {
  const front = state.shelves[shelf]?.layers[0];
  if (!front || isShelfLocked(state, shelf)) return [];
  return front.flatMap((slot, i) => (slot === null && !isSlotBlocked(state, shelf, i) ? [i] : []));
}

/**
 * True when items remain but none can move to another shelf: no free front slot (blocked slots and locked
 * shelves don't count), or the only free slots are on the shelf holding the last movable items.
 * Reordering inside a shelf does not count as a way out.
 */
export function isBlocked(state: GameState): boolean {
  if (isWon(state)) return false;
  const canGive = state.shelves.map(
    (shelf, s) => !isShelfLocked(state, s) && shelf.layers[0]!.some((slot) => slot !== null),
  );
  // Track items can go to any shelf, but tracks never count as free space.
  const beltGives = countTrackItems(state) > 0;
  const canMoveInto = (target: number) =>
    freeFrontSlots(state, target).length > 0 &&
    (beltGives || canGive.some((gives, source) => gives && source !== target));
  return !state.shelves.some((_, target) => canMoveInto(target));
}

/** Advances the level timer and the combo window. Running out of time while playing loses the level. */
export function tick(state: GameState, elapsedMs: number): TickResult {
  if (state.status !== 'playing' || !(elapsedMs > 0)) return { state, events: [] };
  const events: GameEvent[] = [];
  let next = state;

  if (state.tracks.length > 0) next = { ...next, trackTimeMs: state.trackTimeMs + elapsedMs };

  const combo = state.combo;
  if (combo && combo.windowLeftMs > 0) {
    const windowLeftMs = Math.max(0, combo.windowLeftMs - elapsedMs);
    const broken = windowLeftMs === 0;
    next = { ...next, combo: { ...combo, windowLeftMs, combo: broken ? 0 : combo.combo } };
    if (broken) events.push({ kind: 'comboChanged', combo: 0, windowMs: 0 });
  }

  if (state.timeLeftMs !== null) {
    const timeLeftMs = Math.max(0, state.timeLeftMs - elapsedMs);
    next = { ...next, timeLeftMs };
    if (timeLeftMs === 0) {
      next = { ...next, status: 'lost', loseReason: 'timeUp' };
      events.push({ kind: 'lost', reason: 'timeUp' });
    }
  }
  return { state: next, events };
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
  if (state.status !== 'playing') return { ok: false, reason: 'gameOver' };
  if (!isValidPosition(state, from) || !isValidPosition(state, to)) return { ok: false, reason: 'invalidPosition' };
  if (from.shelf === to.shelf && from.layer === to.layer && from.slot === to.slot) {
    return { ok: false, reason: 'samePosition' };
  }
  if (from.layer !== 0 || to.layer !== 0) return { ok: false, reason: 'notFrontLayer' };
  if (isShelfLocked(state, from.shelf) || isShelfLocked(state, to.shelf)) return { ok: false, reason: 'shelfLocked' };

  const item = itemAt(state, from);
  if (!item) return { ok: false, reason: 'sourceEmpty' };
  const invalid = checkTargetSlot(state, to);
  if (invalid) return { ok: false, reason: invalid };

  const shelves = state.shelves.slice();
  shelves[from.shelf] = setFrontSlot(shelves[from.shelf]!, from.slot, null);
  shelves[to.shelf] = setFrontSlot(shelves[to.shelf]!, to.slot, item);

  const events: GameEvent[] = [{ kind: 'moved', itemId: item.id, from, to }];
  // Destination first: that is where a triple can form.
  shelves[to.shelf] = settleShelf(shelves[to.shelf]!, to.shelf, events);
  shelves[from.shelf] = settleShelf(shelves[from.shelf]!, from.shelf, events);
  return { ok: true, ...finishMove({ ...state, shelves }, events) };
}

/** Why an item cannot be placed in the (valid, front, unlocked) slot `to`, or null if it can. */
function checkTargetSlot(state: GameState, to: Position): InvalidMoveReason | null {
  if (isSlotBlocked(state, to.shelf, to.slot)) return 'slotBlocked';
  if (freeFrontSlots(state, to.shelf).length === 0) return 'shelfFull';
  if (itemAt(state, to)) return 'targetOccupied';
  return null;
}

/** Triples' consequences, then the win or blocked check, shared by every action that places an item. */
function finishMove(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let next = applyTriples(state, events);
  if (isWon(next)) {
    next = { ...next, status: 'won' };
    events.push({ kind: 'won' });
  } else if (isBlocked(next)) {
    next = { ...next, status: 'lost', loseReason: 'blocked' };
    events.push({ kind: 'lost', reason: 'blocked' });
  }
  return { state: next, events };
}

/**
 * Takes the top item of a carrier into the player's hand; the next item of its stack becomes the top, and the
 * carrier keeps moving. Only one track item can be held at a time.
 */
export function pickFromTrack(state: GameState, from: CarrierRef): MoveResult {
  if (state.status !== 'playing') return { ok: false, reason: 'gameOver' };
  if (state.tracks.length === 0) return { ok: false, reason: 'noTrack' };
  const track = state.tracks[from.track];
  const carrier = track?.carriers[from.carrier];
  // Shelves riding a track are taken from with moveItem, like any shelf.
  if (!track || !carrier || carrier.kind !== 'stack') return { ok: false, reason: 'invalidPosition' };
  if (state.held) return { ok: false, reason: 'alreadyHolding' };
  const item = carrier.stack[0];
  if (!item) return { ok: false, reason: 'carrierEmpty' };

  const ref = { track: from.track, carrier: from.carrier };
  return {
    ok: true,
    state: { ...setStack(state, ref, carrier.stack.slice(1)), held: { item, from: ref } },
    events: [{ kind: 'beltItemTaken', itemId: item.id, from: ref }],
  };
}

/** Puts the held item back on top of its own carrier's stack, wherever the track has moved it. */
export function returnHeld(state: GameState): MoveResult {
  const held = state.held;
  if (!held) return { ok: false, reason: 'nothingHeld' };
  const stack = stackOf(state.tracks[held.from.track]!.carriers[held.from.carrier]!);
  return {
    ok: true,
    state: { ...setStack(state, held.from, [held.item, ...stack]), held: null },
    events: [{ kind: 'beltItemReturned', itemId: held.item.id, to: held.from }],
  };
}

/**
 * Places the held track item into a free front slot, with the same rules as a shelf-to-shelf move.
 * Invalid targets leave the state untouched (still holding); the caller then returns it with returnHeld.
 */
export function dropHeld(state: GameState, to: Position): MoveResult {
  if (state.status !== 'playing') return { ok: false, reason: 'gameOver' };
  const held = state.held;
  if (!held) return { ok: false, reason: 'nothingHeld' };
  if (!isValidPosition(state, to)) return { ok: false, reason: 'invalidPosition' };
  if (to.layer !== 0) return { ok: false, reason: 'notFrontLayer' };
  if (isShelfLocked(state, to.shelf)) return { ok: false, reason: 'shelfLocked' };
  const invalid = checkTargetSlot(state, to);
  if (invalid) return { ok: false, reason: invalid };

  const shelves = state.shelves.slice();
  shelves[to.shelf] = setFrontSlot(shelves[to.shelf]!, to.slot, held.item);
  const events: GameEvent[] = [{ kind: 'beltItemPlaced', itemId: held.item.id, from: held.from, to }];
  shelves[to.shelf] = settleShelf(shelves[to.shelf]!, to.shelf, events);
  return { ok: true, ...finishMove({ ...state, shelves, held: null }, events) };
}

function setStack(state: GameState, ref: CarrierRef, stack: readonly Item[]): GameState {
  const tracks = state.tracks.slice();
  const track = tracks[ref.track]!;
  const carriers = track.carriers.slice();
  carriers[ref.carrier] = { kind: 'stack', stack };
  tracks[ref.track] = { ...track, carriers };
  return { ...state, tracks };
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

/**
 * Applies the consequences of the triples cleared by a move, including chained ones from advancing layers:
 * triple count, combo and score, shelf unlocks, blocker removal and blocker jumps. Appends their events.
 */
function applyTriples(state: GameState, events: GameEvent[]): GameState {
  const triples = events.filter((e) => e.kind === 'tripleCleared');
  if (triples.length === 0) return state;

  let { triplesCleared, combo, blocker } = state;
  for (const triple of triples) {
    triplesCleared++;
    if (combo) {
      combo = extendCombo(combo);
      const delta = Math.round(combo.pointsPerTriple * multiplierFor(combo));
      combo = { ...combo, score: combo.score + delta };
      events.push({ kind: 'comboChanged', combo: combo.combo, windowMs: combo.windowMs });
      events.push({ kind: 'scoreChanged', score: combo.score, delta, shelf: triple.shelf });
      if (blocker && combo.combo >= blocker.removeAtCombo) {
        events.push({ kind: 'blockerRemoved', at: blocker.at });
        blocker = null;
      }
    }
    state.unlockAt.forEach((unlockAt, shelf) => {
      if (unlockAt === triplesCleared) events.push({ kind: 'shelfUnlocked', shelf });
    });
  }

  let next: GameState = { ...state, triplesCleared, combo, blocker };
  // The blocker jumps once per triple, after the board has settled (cleared slots and advanced layers).
  for (let i = 0; i < triples.length && next.blocker; i++) {
    const from = next.blocker.at;
    const moved = jumpBlocker(next, next.blocker);
    if (!moved) break;
    next = { ...next, blocker: moved };
    events.push({ kind: 'blockerMoved', from, to: moved.at });
  }
  return next;
}

function extendCombo(combo: ComboState): ComboState {
  const chain = (combo.windowLeftMs > 0 ? combo.combo : 0) + 1;
  return { ...combo, combo: chain, maxCombo: Math.max(combo.maxCombo, chain), windowLeftMs: combo.windowMs };
}

export function multiplierFor(combo: ComboState): number {
  if (combo.combo <= 0) return 0;
  const table = combo.multipliers;
  return table[Math.min(combo.combo, table.length) - 1]!;
}

/** Empty front slots on unlocked shelves, in board order. */
function emptyUnlockedSlots(state: GameState): SlotRef[] {
  const slots: SlotRef[] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, i) => {
      if (item === null) slots.push({ shelf: s, slot: i });
    });
  });
  return slots;
}

/** Picks another empty slot for the blocker with its seeded generator; null if there is none. */
function jumpBlocker(state: GameState, blocker: BlockerState): BlockerState | null {
  const candidates = emptyUnlockedSlots(state).filter(
    (ref) => ref.shelf !== blocker.at.shelf || ref.slot !== blocker.at.slot,
  );
  if (candidates.length === 0) return null;
  const { value, state: rngState } = nextRandom(blocker.rngState);
  return { ...blocker, at: candidates[Math.floor(value * candidates.length)]!, rngState };
}
