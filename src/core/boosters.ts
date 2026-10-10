import { blockedSlotOf, canProgress, finishMove, isBlocked, isShelfLocked, settleShelf, stackOf } from './game';
import type { CarrierRef, GameEvent, GameState, Item, Layer, MoveResult, Position, Shelf, TrackState } from './types';

/**
 * Boosters and continues: helps that never break the rules. Every booster keeps one triple per type (a triple
 * is removed whole, or items only move), never copies an item, and leaves the board in a state the normal rules
 * could reach (back layers come forward as usual, nothing starts as a triple, the board is not left blocked).
 */

/** What a booster acts on: a front slot of a shelf, or the top of a track carrier. */
export type BoosterTarget = Position | CarrierRef;

const isCarrier = (target: BoosterTarget): target is CarrierRef => 'carrier' in target;

const fail = (reason: Extract<MoveResult, { ok: false }>['reason']): MoveResult => ({ ok: false, reason });

/** Stops the clock for `ms` of game time (it adds up if used again). Timed levels only. */
export function freezeClock(state: GameState, ms: number): MoveResult {
  if (state.status !== 'playing') return fail('gameOver');
  if (state.timeLeftMs === null) return fail('untimed');
  return { ok: true, state: { ...state, frozenMs: state.frozenMs + ms }, events: [{ kind: 'clockFrozen', ms }] };
}

/** Where an item is: on a shelf, in a track stack, or in the player's hand. */
type Spot =
  | { readonly kind: 'shelf'; readonly shelf: number; readonly layer: number; readonly slot: number; readonly item: Item }
  | { readonly kind: 'stack'; readonly track: number; readonly carrier: number; readonly depth: number; readonly item: Item }
  | { readonly kind: 'held'; readonly item: Item };

function spotsOf(state: GameState, type: string): Spot[] {
  const spots: Spot[] = [];
  state.shelves.forEach((shelf, s) =>
    shelf.layers.forEach((layer, l) =>
      layer.forEach((item, i) => {
        if (item?.type === type) spots.push({ kind: 'shelf', shelf: s, layer: l, slot: i, item });
      }),
    ),
  );
  state.tracks.forEach((track, t) =>
    track.carriers.forEach((carrier, c) =>
      stackOf(carrier).forEach((item, d) => {
        if (item.type === type) spots.push({ kind: 'stack', track: t, carrier: c, depth: d, item });
      }),
    ),
  );
  if (state.held?.item.type === type) spots.push({ kind: 'held', item: state.held.item });
  return spots;
}

const depthOf = (spot: Spot) => (spot.kind === 'shelf' ? spot.layer : spot.kind === 'stack' ? spot.depth : 0);

/** The item a target points at, if the player may use a booster on it (visible, on an unlocked shelf). */
function targetItem(state: GameState, target: BoosterTarget): Item | null {
  if (isCarrier(target)) {
    const carrier = state.tracks[target.track]?.carriers[target.carrier];
    return carrier ? (stackOf(carrier)[0] ?? null) : null;
  }
  if (target.layer !== 0 || isShelfLocked(state, target.shelf)) return null;
  return state.shelves[target.shelf]?.layers[0]?.[target.slot] ?? null;
}

/**
 * Removes the whole triple of the item at `target` (a visible item: on the front of an unlocked shelf or on top
 * of a track carrier), its hidden members included, wherever they are. Back layers then come forward by the
 * normal rules. The triple counts as cleared (locks and the roaming blocker react as usual) but scores nothing.
 */
export function removeTriple(state: GameState, target: BoosterTarget): MoveResult {
  if (state.status !== 'playing') return fail('gameOver');
  const item = targetItem(state, target);
  if (!item) return fail('noTarget');
  return removeTripleOf(state, item, isCarrier(target) ? -1 : target.shelf);
}

function removeTripleOf(state: GameState, item: Item, shelfHint: number): MoveResult {
  const others = spotsOf(state, item.type)
    .filter((spot) => spot.item.id !== item.id)
    .sort((a, b) => depthOf(a) - depthOf(b));
  const chosen = [...spotsOf(state, item.type).filter((spot) => spot.item.id === item.id), ...others.slice(0, 2)];
  if (chosen.length < 3) return fail('noTarget');
  const ids = new Set(chosen.map((spot) => spot.item.id));

  // Take the three away.
  const touched = new Set<number>();
  const shelves = state.shelves.map((shelf, s): Shelf => {
    if (!chosen.some((spot) => spot.kind === 'shelf' && spot.shelf === s)) return shelf;
    touched.add(s);
    const layers = shelf.layers.map((layer): Layer => layer.map((slot) => (slot && ids.has(slot.id) ? null : slot)));
    // A back layer left empty is dropped, as levels never hold one.
    return { layers: layers.filter((layer, l) => l === 0 || layer.some((slot) => slot !== null)) };
  });
  const tracks = state.tracks.map(
    (track): TrackState => ({
      ...track,
      carriers: track.carriers.map((carrier) => (carrier.kind === 'stack' ? { kind: 'stack', stack: carrier.stack.filter((it) => !ids.has(it.id)) } : carrier)),
    }),
  );
  const held = state.held && ids.has(state.held.item.id) ? null : state.held;
  let next: GameState = { ...state, shelves, tracks, held };

  const events: GameEvent[] = [{ kind: 'tripleCleared', shelf: shelfHint, itemType: item.type, itemIds: [...ids], byBooster: true }];
  // Fronts emptied by the removal let their back layers come forward (which may clear more triples).
  const settled = next.shelves.slice();
  for (const s of touched) settled[s] = settleShelf(settled[s]!, s, blockedSlotOf(next, s), events);
  next = { ...next, shelves: settled };
  return { ok: true, ...finishMove(next, events) };
}

/**
 * The triple to remove when the player continues after running out of space: the kind with the most items in
 * view on unlocked shelves (it frees the most front slots), as a target on one of its items. Null if no item is
 * in view.
 */
export function bestTripleTarget(state: GameState): BoosterTarget | null {
  const inView = new Map<string, Position[]>();
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, slot) => {
      if (item) inView.set(item.type, [...(inView.get(item.type) ?? []), { shelf: s, layer: 0, slot }]);
    });
  });
  let best: Position[] | null = null;
  for (const positions of inView.values()) if (!best || positions.length > best.length) best = positions;
  if (best) return best[0]!;
  for (let track = 0; track < state.tracks.length; track++) {
    const carrier = state.tracks[track]!.carriers.findIndex((c) => stackOf(c).length > 0);
    if (carrier !== -1) return { track, carrier };
  }
  return null;
}

/** Every item in view a booster may target: fronts of unlocked shelves (one per kind), then track tops. */
function visibleTargets(state: GameState): BoosterTarget[] {
  const targets: BoosterTarget[] = [];
  const kinds = new Set<string>();
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, slot) => {
      if (!item || kinds.has(item.type)) return;
      kinds.add(item.type);
      targets.push({ shelf: s, layer: 0, slot });
    });
  });
  state.tracks.forEach((track, t) =>
    track.carriers.forEach((carrier, c) => {
      const top = stackOf(carrier)[0];
      if (top && !kinds.has(top.type)) {
        kinds.add(top.type);
        targets.push({ track: t, carrier: c });
      }
    }),
  );
  return targets;
}

/**
 * Continues after running out of space, or after getting stuck, by removing one triple: the one bestTripleTarget
 * picks, unless that leaves the board blocked or stuck again and another kind would not (then the first such).
 */
export function continueAfterBlocked(state: GameState): MoveResult {
  if (state.status !== 'lost' || (state.loseReason !== 'blocked' && state.loseReason !== 'stuck')) return fail('gameOver');
  const reopened: GameState = { ...state, status: 'playing', loseReason: null };
  const best = bestTripleTarget(reopened);
  if (!best) return fail('noTarget');
  const first = removeTriple(reopened, best);
  if (first.ok && first.state.status !== 'lost') return first;
  for (const target of visibleTargets(reopened)) {
    const result = removeTriple(reopened, target);
    if (result.ok && result.state.status !== 'lost') return result;
  }
  return first;
}

/**
 * Continues after getting stuck by shuffling the board (see shuffleBoard): it always leaves some way to make
 * progress. Fails if no such shuffle is found.
 */
export function continueByShuffling(state: GameState, random: () => number): MoveResult {
  if (state.status !== 'lost' || state.loseReason !== 'stuck') return fail('gameOver');
  return shuffleBoard({ ...state, status: 'playing', loseReason: null }, random);
}

/** Continues after running out of time with `ms` more on the clock. */
export function addTime(state: GameState, ms: number): MoveResult {
  if (state.status !== 'lost' || state.loseReason !== 'timeUp') return fail('gameOver');
  return { ok: true, state: { ...state, status: 'playing', loseReason: null, timeLeftMs: ms }, events: [{ kind: 'timeAdded', ms }] };
}

/** Where an item may be shuffled to: an occupied slot of an unlocked shelf, or a place in a track stack. */
type Place = { readonly kind: 'shelf'; readonly shelf: number; readonly layer: number; readonly slot: number } | { readonly kind: 'stack'; readonly track: number; readonly carrier: number; readonly depth: number };

/** True when every slot of a layer holds the same type: a triple that would clear by itself. */
function isFullTriple(layer: Layer): boolean {
  const first = layer[0];
  return Boolean(first) && layer.every((slot) => slot?.type === first!.type);
}

/**
 * Shuffles the items on the board while keeping its structure: every occupied slot stays occupied (shelves,
 * layers and track stacks keep their shape), locked shelves keep their items, and the roaming blocker stays put.
 * The result never starts with a triple already formed (in any layer) and always leaves the player a way to
 * make progress (see canProgress). Not while holding a track item. `random` returns numbers in [0, 1).
 */
export function shuffleBoard(state: GameState, random: () => number, attempts = 80): MoveResult {
  if (state.status !== 'playing') return fail('gameOver');
  if (state.held) return fail('alreadyHolding');
  const places: Place[] = [];
  const items: Item[] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers.forEach((layer, l) =>
      layer.forEach((item, i) => {
        if (!item) return;
        places.push({ kind: 'shelf', shelf: s, layer: l, slot: i });
        items.push(item);
      }),
    );
  });
  state.tracks.forEach((track, t) =>
    track.carriers.forEach((carrier, c) =>
      stackOf(carrier).forEach((item, d) => {
        places.push({ kind: 'stack', track: t, carrier: c, depth: d });
        items.push(item);
      }),
    ),
  );
  if (items.length < 2) return fail('noShuffle');

  for (let attempt = 0; attempt < attempts; attempt++) {
    const order = items.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const shelves = state.shelves.map((shelf) => ({ layers: shelf.layers.map((layer) => layer.slice()) }));
    const stacks = state.tracks.map((track) => track.carriers.map((carrier) => stackOf(carrier).slice()));
    places.forEach((place, k) => {
      if (place.kind === 'shelf') shelves[place.shelf]!.layers[place.layer]![place.slot] = order[k]!;
      else stacks[place.track]![place.carrier]![place.depth] = order[k]!;
    });
    if (shelves.some((shelf, s) => !isShelfLocked(state, s) && shelf.layers.some(isFullTriple))) continue;
    const next: GameState = {
      ...state,
      shelves,
      tracks: state.tracks.map((track, t) => ({
        ...track,
        carriers: track.carriers.map((carrier, c) => (carrier.kind === 'stack' ? { kind: 'stack', stack: stacks[t]![c]! } : carrier)),
      })),
    };
    if (isBlocked(next) || !canProgress(next)) continue;
    return { ok: true, state: next, events: [{ kind: 'shuffled' }] };
  }
  return fail('noShuffle');
}
