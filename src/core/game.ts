import { TIME_BONUS_PER_SECOND } from './mechanics';
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
 * carriers per second of game time, wrapping around (fixed stacks, with speed 0, stay at i + 0.5, the middle of
 * their slot). A pure function of the tracks' running time.
 */
export function carrierOffset(track: TrackState, carrier: number, trackTimeMs: number): number {
  // Fixed stacks sit in the middle of their own slot, whatever the time.
  if (track.speed === 0) return carrier + 0.5;
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

/** A shelf that closed once it emptied (see the 'closingShelves' mechanic): it takes nothing any more. */
export function isShelfClosed(state: GameState, shelf: number): boolean {
  return state.closed[shelf] === true;
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
  if (!front || isShelfLocked(state, shelf) || isShelfClosed(state, shelf)) return [];
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

/**
 * Whether any sequence of moves from this state can still make progress: clear a triple or bring a back layer
 * forward (everything else, from unlocking shelves to moving the roaming blocker, comes from triples). It decides
 * exactly, without searching, because once a usable slot is free the player can arrange the front items in any
 * way at all (any item can go to the free slot, so free slots wander and every arrangement can be reached):
 *
 * - A layer can come forward iff some unlocked shelf with layers behind and no blocker on it could have its front
 *   emptied: its items need that many free slots elsewhere, which comes to 3 free slots in all.
 * - A triple of a kind can be cleared iff 3 of it can be gathered on an unlocked shelf without the blocker (where
 *   the blocker stands a triple never fits): enough of it in the fronts and on track stacks, taking an item from
 *   a stack costing a free slot for good for every item above it and for itself. The cheapest way to reach the
 *   copies needed must fit in the free slots; when it takes the very last one, the last item taken is a copy that
 *   completes the triple directly.
 *
 * Tracks loop, so every carrier comes round sooner or later (where they are now does not matter); fixed stacks
 * are always in view; time and combos do not matter either. An item held from a track counts as still on top of
 * its carrier (it can always go back). Closed shelves count for nothing.
 *
 * With shelves that close when emptied it is safe but no longer exact: emptying one while arranging would lose its
 * slots, which this ignores, so it may still see a way on where a careful search would not; it never declares a
 * board stuck that has one. Not meaningful once the level is over, or with no usable slot free (see isBlocked).
 */
export function canProgress(state: GameState): boolean {
  let free = 0;
  let canEmpty = false;
  let canHoldTriple = false;
  const inFronts = new Map<string, number>();
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s) || isShelfClosed(state, s)) return;
    const blocked = blockedSlotOf(state, s);
    shelf.layers[0]!.forEach((item, i) => {
      if (i === blocked) return;
      if (item) inFronts.set(item.type, (inFronts.get(item.type) ?? 0) + 1);
      else free++;
    });
    if (blocked === null) {
      canHoldTriple = true;
      if (shelf.layers.length > 1) canEmpty = true;
    }
  });
  if (free === 0) return false;
  if (canEmpty && free >= 3) return true;
  if (!canHoldTriple) return false;

  // Track stacks, top first (a held item back on top of its own carrier).
  const stacks = state.tracks.flatMap((track, t) =>
    track.carriers.map((carrier, c) => {
      const stack = stackOf(carrier);
      return state.held && state.held.from.track === t && state.held.from.carrier === c ? [state.held.item, ...stack] : stack;
    }),
  );
  const kinds = new Set(inFronts.keys());
  for (const stack of stacks) for (const item of stack) kinds.add(item.type);
  for (const kind of kinds) {
    const need = 3 - (inFronts.get(kind) ?? 0);
    if (need <= 0 || cheapestCopies(stacks, kind, need) <= free) return true;
  }
  return false;
}

/**
 * Fewest items to take from track stacks to get `need` copies of a kind (each copy costs its depth plus one, as
 * everything above it comes off first), or Infinity if the stacks hold too few. A small knapsack: need ≤ 3.
 */
function cheapestCopies(stacks: readonly (readonly Item[])[], kind: string, need: number): number {
  let best = Array.from({ length: need + 1 }, (_, k) => (k === 0 ? 0 : Infinity));
  for (const stack of stacks) {
    const depths: number[] = [];
    stack.forEach((item, depth) => {
      if (item.type === kind && depths.length < need) depths.push(depth);
    });
    if (depths.length === 0) continue;
    const next = best.slice();
    for (let have = 0; have <= need; have++) {
      if (best[have] === Infinity) continue;
      depths.forEach((depth, i) => {
        const total = Math.min(need, have + i + 1);
        next[total] = Math.min(next[total]!, best[have]! + depth + 1);
      });
    }
    best = next;
  }
  return best[need]!;
}

/**
 * True when the level can no longer be won though usable space is left: no move sequence can ever clear a triple
 * or bring a layer forward (see canProgress). The player would only move items around until the clock ran out.
 */
export function isStuck(state: GameState): boolean {
  return state.status === 'playing' && !isWon(state) && !isBlocked(state) && !canProgress(state);
}

/**
 * Starts game time: called on the player's first interaction with the board (touching or dragging an item).
 * Every move or pick starts it too. Does nothing once started.
 */
export function startClock(state: GameState): GameState {
  return state.clockStarted ? state : { ...state, clockStarted: true };
}

/**
 * Advances game time: the level timer, the tracks and the combo window. Running out of time while playing
 * loses the level. Nothing moves before the clock has started.
 */
export function tick(state: GameState, elapsedMs: number): TickResult {
  if (state.status !== 'playing' || !state.clockStarted || !(elapsedMs > 0)) return { state, events: [] };
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
    // A frozen clock takes the time first; only what is left over runs the clock down.
    const frozen = Math.min(state.frozenMs, elapsedMs);
    const timeLeftMs = Math.max(0, state.timeLeftMs - (elapsedMs - frozen));
    next = { ...next, timeLeftMs, frozenMs: state.frozenMs - frozen };
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
  state = startClock(state);
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
  shelves[to.shelf] = settleShelf(shelves[to.shelf]!, to.shelf, blockedSlotOf(state, to.shelf), events);
  shelves[from.shelf] = settleShelf(shelves[from.shelf]!, from.shelf, blockedSlotOf(state, from.shelf), events);
  return { ok: true, ...finishMove({ ...state, shelves }, events) };
}

/** Why an item cannot be placed in the (valid, front, unlocked) slot `to`, or null if it can. */
function checkTargetSlot(state: GameState, to: Position): InvalidMoveReason | null {
  if (isShelfClosed(state, to.shelf)) return 'shelfClosed';
  if (isSlotBlocked(state, to.shelf, to.slot)) return 'slotBlocked';
  if (freeFrontSlots(state, to.shelf).length === 0) return 'shelfFull';
  if (itemAt(state, to)) return 'targetOccupied';
  return null;
}

/**
 * Triples' consequences, then shelves that close once emptied, then the win, blocked or stuck check, shared by
 * every action that places or removes items.
 */
export function finishMove(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let next = closeEmptied(applyTriples(state, events), events);
  if (isWon(next)) {
    next = addTimeBonus({ ...next, status: 'won' }, events);
    events.push({ kind: 'won' });
  } else if (isBlocked(next)) {
    next = { ...next, status: 'lost', loseReason: 'blocked' };
    events.push({ kind: 'lost', reason: 'blocked' });
  } else if (!canProgress(next)) {
    next = { ...next, status: 'lost', loseReason: 'stuck' };
    events.push({ kind: 'lost', reason: 'stuck' });
  }
  return { state: next, events };
}

/**
 * Closes, for good, every shelf that closes when empty and has just emptied: nothing left in its front and no
 * layers behind. A shelf under the roaming blocker waits: the blocker holds its slot until it jumps away.
 */
function closeEmptied(state: GameState, events: GameEvent[]): GameState {
  let closed: boolean[] | null = null;
  state.shelves.forEach((shelf, s) => {
    if (!state.closesWhenEmpty[s] || state.closed[s] || shelf.layers.length > 1 || state.blocker?.at.shelf === s) return;
    if (shelf.layers[0]!.some((slot) => slot !== null)) return;
    closed ??= state.closed.slice();
    closed[s] = true;
    events.push({ kind: 'shelfClosed', shelf: s });
  });
  return closed ? { ...state, closed } : state;
}

/** On a win with time left: TIME_BONUS_PER_SECOND points for each whole second, added to the score. */
function addTimeBonus(state: GameState, events: GameEvent[]): GameState {
  if (state.timeLeftMs === null) return state;
  const seconds = Math.floor(state.timeLeftMs / 1000);
  if (seconds <= 0) return state;
  const points = seconds * TIME_BONUS_PER_SECOND;
  const score = state.combo.score + points;
  events.push({ kind: 'timeBonus', seconds, points, score });
  return { ...state, combo: { ...state.combo, score } };
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
    state: { ...setStack(startClock(state), ref, carrier.stack.slice(1)), held: { item, from: ref } },
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
  shelves[to.shelf] = settleShelf(shelves[to.shelf]!, to.shelf, blockedSlotOf(state, to.shelf), events);
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

/** The front slot of a shelf under the roaming blocker, or null. */
export function blockedSlotOf(state: GameState, shelf: number): number | null {
  return state.blocker?.at.shelf === shelf ? state.blocker.at.slot : null;
}

/**
 * Clears front triples and advances back layers until the shelf is stable. The roaming blocker fills its slot:
 * a front with the blocker (`blockedSlot`) is not empty, so the layer behind waits until the blocker leaves.
 */
export function settleShelf(shelf: Shelf, index: number, blockedSlot: number | null, events: GameEvent[]): Shelf {
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
    if (layers.length > 1 && blockedSlot === null && front.every((slot) => slot === null)) {
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
 * When the blocker leaves a shelf (jumping or removed), that shelf settles: an empty front lets the layer behind
 * come forward, which may clear more triples, handled in the same way.
 */
function applyTriples(state: GameState, events: GameEvent[]): GameState {
  let next = state;
  for (let seen = 0; ; ) {
    const triples = events.slice(seen).filter((e) => e.kind === 'tripleCleared');
    if (triples.length === 0) return next;

    let { triplesCleared, combo, blocker } = next;
    const removedFrom = blocker?.at.shelf ?? null;
    for (const triple of triples) {
      triplesCleared++;
      // A triple a booster took away counts (for locks and the blocker) but scores nothing.
      if (combo && !(triple.kind === 'tripleCleared' && triple.byBooster)) {
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
      next.unlockAt.forEach((unlockAt, shelf) => {
        if (unlockAt === triplesCleared) events.push({ kind: 'shelfUnlocked', shelf });
      });
    }
    // Events up to here are handled; settling below may append new triples for the next round.
    seen = events.length;

    next = { ...next, triplesCleared, combo, blocker };
    if (!blocker && removedFrom !== null) next = settleAt(next, removedFrom, events);
    // The blocker jumps once per triple, after the board has settled (cleared slots and advanced layers).
    for (let i = 0; i < triples.length && next.blocker; i++) {
      const from = next.blocker.at;
      const moved = jumpBlocker(next, next.blocker);
      if (!moved) break;
      next = { ...next, blocker: moved };
      events.push({ kind: 'blockerMoved', from, to: moved.at });
      if (moved.at.shelf !== from.shelf) next = settleAt(next, from.shelf, events);
    }
  }
}

/** Settles one shelf of a state (see settleShelf). */
function settleAt(state: GameState, shelf: number, events: GameEvent[]): GameState {
  const settled = settleShelf(state.shelves[shelf]!, shelf, blockedSlotOf(state, shelf), events);
  if (settled.layers === state.shelves[shelf]!.layers) return state;
  const shelves = state.shelves.slice();
  shelves[shelf] = settled;
  return { ...state, shelves };
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
    if (isShelfLocked(state, s) || isShelfClosed(state, s)) return;
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
