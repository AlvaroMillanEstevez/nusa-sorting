import {
  carrierOfShelf,
  dropHeld,
  freeFrontSlots,
  isShelfLocked,
  isSlotBlocked,
  isWon,
  moveItem,
  isCarrierSource,
  pickFromTrack,
  type CarrierRef,
  tick,
  type GameState,
  type LoseReason,
  type MoveResult,
  type Position,
  stackOf,
} from '../src/core';

/**
 * Simulated players and a solver, for tests and the level generator (never part of the game build).
 * The simulator approximates a casual player; its numbers are a guide, not a substitute for real players.
 */

export const front = (shelf: number, slot: number): Position => ({ shelf, layer: 0, slot });

/** Where a move takes its item from: a front slot, or the top of a track carrier. */
export type Source = Position | CarrierRef;
/** A player action: move a shelf item, or take a carrier's top item and drop it, into a front slot. */
export type Move = readonly [Source, Position];

export const isBeltSource = isCarrierSource;

/** Applies a move; a track move is pickFromTrack followed by dropHeld, reported as one result. */
export function applyMove(state: GameState, [from, to]: Move): MoveResult {
  if (!isBeltSource(from)) return moveItem(state, from, to);
  const picked = pickFromTrack(state, from);
  if (!picked.ok) return picked;
  const dropped = dropHeld(picked.state, to);
  if (!dropped.ok) return dropped;
  return { ok: true, state: dropped.state, events: [...picked.events, ...dropped.events] };
}

/** Type of the item a move would carry. */
export function movedType(state: GameState, from: Source): string {
  return isBeltSource(from)
    ? stackOf(state.tracks[from.track]!.carriers[from.carrier]!)[0]!.type
    : state.shelves[from.shelf]!.layers[0]![from.slot]!.type;
}

/**
 * Every valid move from a state: a front item on an unlocked shelf, or any carrier's top item, to any free front
 * slot (blocked slots and locked shelves excluded), including reordering within a shelf.
 */
export function validMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const targets = state.shelves.flatMap((_, t) => freeFrontSlots(state, t).map((j) => front(t, j)));
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((slot, i) => {
      if (slot) for (const to of targets) moves.push([front(s, i), to]);
    });
  });
  state.tracks.forEach((track, t) =>
    track.carriers.forEach((carrier, c) => {
      if (stackOf(carrier).length > 0) for (const to of targets) moves.push([{ track: t, carrier: c }, to]);
    }),
  );
  return moves;
}

/**
 * Key identifying equivalent states for the solver. Without a blocker, slot order inside a layer does not
 * affect which triples can form, so layers are sorted. The blocker makes positions matter, so then they don't.
 */
function stateKey(state: GameState): string {
  const exact = state.blocker !== null;
  const board = state.shelves
    .map((shelf) =>
      shelf.layers
        .map((layer) => {
          const types = layer.map((slot) => slot?.type ?? '.');
          return (exact ? types : types.sort()).join(',');
        })
        .join('|'),
    )
    .join('/');
  const blocker = state.blocker ? `${state.blocker.at.shelf}:${state.blocker.at.slot}:${state.blocker.rngState}` : '-';
  // The solver ignores time, so only which stacks remain on the tracks matters, not where they are.
  const tracks = stackSignatures(state).sort().join(';');
  return `${board}#${state.triplesCleared}#${blocker}#${tracks}`;
}

/** Every non-empty carrier as the types of its stack, top first. */
function stackSignatures(state: GameState): string[] {
  return state.tracks.flatMap((track) =>
    track.carriers.flatMap((carrier) => (stackOf(carrier).length ? [stackOf(carrier).map((item) => item.type).join(',')] : [])),
  );
}

/**
 * Iterative depth-first search for a winning move sequence; undefined if none is found.
 * The clock is ignored. Combos are assumed to break between moves (worst case), so a blocker only
 * disappears if chained triples within a single move reach its threshold.
 * Carrier tops are available at any moment (track positions are ignored). Carriers whose whole stacks match
 * are interchangeable, so only one of them is tried; only the top of each stack can be taken.
 * Clearing moves are tried first; reordering is skipped since it never changes which triples can form.
 */
export function solve(start: GameState, maxStates = 200_000): Move[] | undefined {
  // Moves are stored as parent links so memory per state stays constant however deep the search goes.
  type Step = { parent: number; move: Move | null };
  const steps: Step[] = [{ parent: -1, move: null }];
  const untimed: GameState = { ...start, timeLeftMs: null };
  const seen = new Set<string>([stateKey(untimed)]);
  const stack: { state: GameState; step: number }[] = [{ state: untimed, step: 0 }];
  while (stack.length > 0) {
    const { state, step } = stack.pop()!;
    if (isWon(state)) {
      const path: Move[] = [];
      for (let i = step; steps[i]!.move; i = steps[i]!.parent) path.push(steps[i]!.move!);
      return path.reverse();
    }
    if (seen.size > maxStates) return undefined;

    const children: { state: GameState; step: number; clears: number }[] = [];
    const stacksTried = new Set<string>();
    for (const move of validMoves(state)) {
      const [from, to] = move;
      if (isBeltSource(from)) {
        const stack = stackOf(state.tracks[from.track]!.carriers[from.carrier]!).map((item) => item.type).join(',');
        const key = `${stack}>${to.shelf}:${to.slot}`;
        if (stacksTried.has(key)) continue;
        stacksTried.add(key);
      } else if (from.shelf === to.shelf) {
        continue;
      }
      // Without a blocker any free slot of a shelf is equivalent, so try only the first.
      if (!state.blocker && freeFrontSlots(state, to.shelf)[0] !== to.slot) continue;
      const result = applyMove(state, move);
      if (!result.ok) continue;
      const next = state.combo ? tick(result.state, state.combo.windowMs).state : result.state;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      steps.push({ parent: step, move });
      const clears = result.events.filter((e) => e.kind === 'tripleCleared').length;
      children.push({ state: next, step: steps.length - 1, clears });
    }
    // Stack is LIFO: push the most promising children last.
    children.sort((a, b) => a.clears - b.clears);
    for (const child of children) stack.push(child);
  }
  return undefined;
}

/** Small deterministic PRNG (mulberry32) so random tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How fast the simulated player acts, as a share of the first guess (2.5 s per move). Played on phones,
 * levels 1-10 left far too much time over: real players move about twice as fast, so every time cost below is
 * halved.
 */
export const PACE = 0.5;

/** Seconds a casual player needs per move on a level with five item types (the demo levels' usual count). */
export const SECONDS_PER_MOVE = 2.5 * PACE;

/**
 * Seconds per move on a level with `types` item types: telling more types apart takes longer, about 0.06 s per
 * type around the five-type baseline. A guess to be checked by playing.
 */
export function secondsPerMove(types: number): number {
  return SECONDS_PER_MOVE + 0.12 * PACE * (types - 5);
}

/** Distinct item types on the board and tracks. */
export function typeCount(state: GameState): number {
  const types = new Set<string>();
  for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) types.add(item.type);
  for (const track of state.tracks) for (const carrier of track.carriers) for (const item of stackOf(carrier)) types.add(item.type);
  return types.size;
}

/**
 * Estimated extra seconds to take an item from the belt: reaching for something moving, and sometimes
 * waiting for it to come out from the faded ends. Grows with belt speed. A guess to be checked by playing.
 */
export function beltPickSeconds(speed: number): number {
  return (0.5 + 0.75 * Math.abs(speed)) * PACE;
}

/** Slots a shelf track moves per carrier: a shelf and the gap to the next one are about two slots tall. */
export const SLOTS_PER_SHELF_CARRIER = 1.95;

/**
 * Estimated extra seconds to drop an item on (or take one from) a shelf riding a track: aiming at something
 * moving. Grows with how fast its slots move. A guess to be checked by playing.
 */
export function movingShelfSeconds(carriersPerSecond: number): number {
  return (0.5 + 0.75 * Math.abs(carriersPerSecond) * SLOTS_PER_SHELF_CARRIER) * PACE;
}

/** Extra seconds a move costs because its source or target shelf rides a track (the larger of the two). */
export function movingShelfCost(state: GameState, from: Source, to: Position): number {
  const costOf = (shelf: number) => {
    const ref = carrierOfShelf(state, shelf);
    return ref ? movingShelfSeconds(state.tracks[ref.track]!.speed) : 0;
  };
  return Math.max(isBeltSource(from) ? 0 : costOf(from.shelf), costOf(to.shelf));
}

/** Free front slots the player can drop into: on unlocked shelves, not under the roaming blocker. */
export function freeSlots(state: GameState): number {
  return state.shelves.reduce((sum, _, s) => sum + freeFrontSlots(state, s).length, 0);
}

/** At or below this many free slots, where to put the next item is a real decision: space pressure. */
export const TIGHT_FREE_SLOTS = 2;

export interface GameOutcome {
  readonly won: boolean;
  readonly loseReason: LoseReason | null;
  readonly moves: number;
  readonly maxCombo: number;
  readonly score: number;
  /** Game time the game took, in seconds. */
  readonly seconds: number;
  /** Free slots before each move, averaged over the game's moves. */
  readonly meanFree: number;
  /** Share of the game's moves made with TIGHT_FREE_SLOTS free slots or fewer. */
  readonly tightShare: number;
  /** Ended by STUCK_MOVES moves without a triple (or by the move limit), not won and not lost by the rules. */
  readonly stuck: boolean;
}

/**
 * How a simulated player plays. Both gather the triples they can see (see plannedMove) and never reorder or
 * plan combos; they differ in the mistakes they make and in what they look at.
 */
export interface PlayerProfile {
  readonly name: string;
  /** Share of moves where the player misses its planned move and takes any other one. */
  readonly missRate: number;
  /** When missing, the share of times the move taken may split a pair it already has. */
  readonly splitRate: number;
  /**
   * Looks at the layers behind before acting: digs out a hidden layer where there is room to finish first, keeps
   * the items it moves aside off shelves still hiding layers, and keeps the last free slot.
   */
  readonly looksBehind: boolean;
}

/**
 * A casual player, the one the difficulty bands make sure can win without help: gathers the triples it can
 * see and, when it sees none, empties some shelf to see what is behind; but misses three moves in ten (then
 * sometimes splitting a pair), places without looking at the layers behind and does not check it has room.
 */
export const CASUAL: PlayerProfile = { name: 'casual', missRate: 0.3, splitRate: 0.3, looksBehind: false };

/** A careful player, the one the bands make sure is still challenged: rarely misses, and looks behind. */
export const EXPERT: PlayerProfile = { name: 'expert', missRate: 0.08, splitRate: 0, looksBehind: true };

/** The planning player avoids moving an item out of the way again within this many moves. */
const RECENT_MOVES = 6;

/** Moves a simulated game may take, for a level with `items` items. */
export const maxMovesFor = (items: number) => Math.max(400, items * 8);

/**
 * Moves without clearing a triple after which a game counts as stuck: free slots are left, but too few to
 * bring the missing items forward. A real player would shuffle until the clock runs out; it is a loss to space.
 */
export const STUCK_MOVES = 60;

/** Items on the board and tracks. */
function itemsLeft(state: GameState): number {
  let count = 0;
  for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) count++;
  for (const track of state.tracks) for (const carrier of track.carriers) count += stackOf(carrier).length;
  return count;
}

/**
 * One simulated game. The player completes a triple when it can, otherwise prefers moves that pair an item
 * with a matching one, otherwise moves at random, and does not split a pair it already has unless nothing else
 * is left; it misses the best move as often as its profile says (see PlayerProfile). Each move takes
 * secondsPerMove of game time for the level's number of types (plus beltPickSeconds when taken from a track
 * stack, and movingShelfSeconds when a moving shelf is involved), so the clock and combo windows behave as in a
 * real game.
 */
export function playGreedy(start: GameState, random: () => number, profile: PlayerProfile = CASUAL, maxMoves = maxMovesFor(itemsLeft(start))): GameOutcome {
  let state = start;
  let moves = 0;
  let seconds = 0;
  let freeTotal = 0;
  let tight = 0;
  // Items moved lately, oldest first, for the planning player.
  const recentIds: number[] = [];
  let lastClear = 0;
  let stuck = false;
  const basePerMove = secondsPerMove(typeCount(start));
  for (; moves < maxMoves && state.status === 'playing'; moves++) {
    if (moves - lastClear >= STUCK_MOVES) {
      stuck = true;
      break;
    }
    const free = freeSlots(state);
    freeTotal += free;
    if (free <= TIGHT_FREE_SLOTS) tight++;
    const options = validMoves(state)
      .filter(([from, to]) => isBeltSource(from) || from.shelf !== to.shelf)
      .map((move) => {
        const [from, to] = move;
        const result = applyMove(state, move);
        if (!result.ok) return null;
        const type = movedType(state, from);
        const clears = result.events.some((e) => e.kind === 'tripleCleared');
        const pairs = state.shelves[to.shelf]!.layers[0]!.some((slot) => slot?.type === type);
        // Taking an item away from one of its kind it sits beside, to no new pair.
        const splits =
          !pairs &&
          !isBeltSource(from) &&
          state.shelves[from.shelf]!.layers[0]!.some((slot, i) => i !== from.slot && slot?.type === type);
        const seconds =
          basePerMove +
          (isBeltSource(from) ? beltPickSeconds(state.tracks[from.track]!.speed) : 0) +
          movingShelfCost(state, from, to);
        const score = clears ? 3 : pairs ? 2 : splits ? 0 : 1;
        return { move, result, seconds, score, splits };
      })
      .filter((option) => option !== null);
    if (options.length === 0) break;
    const best = Math.max(...options.map((o) => o.score));
    const missed = random() < profile.missRate;
    const planned = missed ? null : plannedMove(state, new Set(recentIds), profile.looksBehind);
    const plannedOption = planned && options.find((o) => sameMove(o.move, planned));
    let pool: typeof options;
    if (plannedOption) {
      pool = [plannedOption];
    } else if (missed) {
      // A miss: any move, keeping its pairs unless it slips (or has nothing else).
      const keepsPairs = options.filter((o) => !o.splits);
      pool = random() < profile.splitRate || keepsPairs.length === 0 ? options : keepsPairs;
    } else {
      pool = options.filter((o) => o.score === best);
    }
    const choice = pool[Math.floor(random() * pool.length)]!;
    const [from] = choice.move;
    if (!isBeltSource(from)) {
      recentIds.push(state.shelves[from.shelf]!.layers[0]![from.slot]!.id);
      if (recentIds.length > RECENT_MOVES) recentIds.shift();
    }
    if (choice.result.events.some((e) => e.kind === 'tripleCleared')) lastClear = moves + 1;
    state = tick(choice.result.state, choice.seconds * 1000).state;
    seconds += choice.seconds;
  }
  return {
    won: state.status === 'won',
    loseReason: state.loseReason,
    moves,
    maxCombo: state.combo?.maxCombo ?? 0,
    score: state.combo?.score ?? 0,
    seconds,
    meanFree: moves > 0 ? freeTotal / moves : freeSlots(start),
    tightShare: moves > 0 ? tight / moves : 0,
    stuck: stuck || (state.status === 'playing' && moves >= maxMoves),
  };
}

const sameSource = (a: Source, b: Source) =>
  isBeltSource(a) ? isBeltSource(b) && a.track === b.track && a.carrier === b.carrier : !isBeltSource(b) && a.shelf === b.shelf && a.slot === b.slot;
const sameMove = (a: Move, b: Move) => sameSource(a[0], b[0]) && a[1].shelf === b[1].shelf && a[1].slot === b[1].slot;

/** An item the player can take now: a front item of an unlocked shelf, or the top of a track stack. */
interface Reachable {
  readonly from: Source;
  readonly type: string;
  /** The shelf it sits on, or null on a track. */
  readonly shelf: number | null;
}

function reachableItems(state: GameState): Reachable[] {
  const items: Reachable[] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, i) => item && items.push({ from: front(s, i), type: item.type, shelf: s }));
  });
  state.tracks.forEach((track, t) =>
    track.carriers.forEach((carrier, c) => {
      const top = stackOf(carrier)[0];
      if (top) items.push({ from: { track: t, carrier: c }, type: top.type, shelf: null });
    }),
  );
  return items;
}

/**
 * Where the planner puts an item it moves out of the way: a free slot on another shelf than `avoid`, beside one
 * of its kind if it can, else on the shelf with the most free slots (keeping tight spots open).
 */
function parkingSlot(state: GameState, type: string, avoid: number | null, looksBehind: boolean): Position | null {
  let best: { at: Position; score: number } | null = null;
  state.shelves.forEach((shelf, s) => {
    if (s === avoid) return;
    const slots = freeFrontSlots(state, s);
    if (slots.length === 0) return;
    const pairs = shelf.layers[0]!.some((item) => item?.type === type);
    const score = (pairs ? 10 : 0) + slots.length - (looksBehind && shelf.layers.length > 1 ? 0.5 : 0);
    if (!best || score > best.score) best = { at: front(s, slots[0]!), score };
  });
  return best === null ? null : (best as { at: Position }).at;
}

/**
 * A player's planned move: of every triple it could gather on one shelf, the one needing the fewest moves
 * (items of other kinds to move off that shelf, plus its own kind to bring in), and the first step of it; with
 * no triple in sight, it digs: empties the front of the shelf with hidden layers that has fewest items left. It
 * avoids moving out of the way again an item it has just moved (`recent`, item ids), which would only shuffle
 * it back and forth. A player that looks behind also digs first where it has room to finish, keeps the items
 * it moves aside off shelves still hiding layers, and never fills the last free slot unless that completes a
 * triple. Null when it sees nothing to do (the player then moves as it would on a miss).
 */
function plannedMove(state: GameState, recent: ReadonlySet<number>, looksBehind: boolean): Move | null {
  const reach = reachableItems(state);
  const free = freeSlots(state);
  const byType = new Map<string, Reachable[]>();
  for (const r of reach) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  let plan: { cost: number; move: Move } | null = null;
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s) || shelf.layers[0]!.some((_, i) => isSlotBlocked(state, s, i))) return;
    const frontItems = shelf.layers[0]!;
    const room = freeFrontSlots(state, s);
    for (const [type, copies] of byType) {
      const here = frontItems.filter((item) => item?.type === type).length;
      const incoming = copies.filter((c) => c.shelf !== s);
      if (here + incoming.length < 3) continue;
      const others = frontItems
        .flatMap((item, i) => (item && item.type !== type ? [i] : []))
        .sort((a, b) => Number(recent.has(frontItems[a]!.id)) - Number(recent.has(frontItems[b]!.id)));
      const needed = 3 - here;
      // Moving the others off needs that many free slots elsewhere.
      if (others.length > free - room.length) continue;
      const shuffles = others.filter((i) => recent.has(frontItems[i]!.id)).length;
      const cost = others.length + needed + 3 * shuffles + (looksBehind && shelf.layers.length > 1 ? -0.3 : 0);
      if (plan && cost >= plan.cost) continue;
      let move: Move | null = null;
      if (others.length > 0) {
        const slot = others[0]!;
        const at = parkingSlot(state, frontItems[slot]!.type, s, looksBehind);
        if (at) move = [front(s, slot), at];
      } else if (room.length > 0) {
        // Bring the closest copy: from a shelf it would leave empty with hidden layers behind, if any (not under
        // the blocker, which holds its slot and keeps the layer behind).
        const source =
          incoming.find((c) => c.shelf !== null && !holdsBlocker(state, c.shelf) && state.shelves[c.shelf]!.layers[0]!.filter(Boolean).length === 1) ??
          incoming[0]!;
        move = [source.from, front(s, room[0]!)];
      }
      if (move) plan = { cost, move };
    }
  });
  if (plan) {
    const chosen = (plan as { move: Move }).move;
    const completes = applyMove(state, chosen);
    const clears = completes.ok && completes.events.some((e) => e.kind === 'tripleCleared');
    if (clears || free > 1 || !looksBehind) return chosen;
  }
  // Dig: bring a hidden layer forward by emptying the front with the fewest items. A player that looks behind
  // prefers a front it has room to empty (fewer items than free slots); it only risks another when stuck. A front
  // under the blocker never empties while it stays, so digging there is pointless.
  let dig: { left: number; move: Move } | null = null;
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s) || shelf.layers.length < 2 || holdsBlocker(state, s)) return;
    const items = shelf.layers[0]!.flatMap((item, i) => (item && !recent.has(item.id) ? [i] : []));
    if (items.length === 0) return;
    const left = items.length + (looksBehind && items.length >= free ? 10 : 0);
    if (dig && left >= dig.left) return;
    const at = parkingSlot(state, shelf.layers[0]![items[0]!]!.type, s, looksBehind);
    if (at) dig = { left, move: [front(s, items[0]!), at] };
  });
  return dig === null ? null : (dig as { move: Move }).move;
}

/** True when the roaming blocker is on a shelf's front. */
const holdsBlocker = (state: GameState, shelf: number) => state.blocker?.at.shelf === shelf;

export interface SimulationStats {
  readonly winRate: number;
  /** Share of games lost because the board ran out of usable space. */
  readonly blockedRate: number;
  /** Share of games that got stuck (see STUCK_MOVES): also lost to space, as the clock would end them. */
  readonly stuckRate: number;
  readonly timeUpRate: number;
  readonly avgMaxCombo: number;
  readonly avgScore: number;
  /** Free slots during a game, averaged over moves and games. */
  readonly avgFree: number;
  /** Space pressure: share of moves made with TIGHT_FREE_SLOTS free slots or fewer, averaged over games. */
  readonly pressure: number;
}

/** Plays `runs` simulated games with a fixed seed so the outcomes are reproducible. */
export function playMany(start: GameState, runs = 200, seed = 1, profile: PlayerProfile = CASUAL): GameOutcome[] {
  const random = rng(seed);
  return Array.from({ length: runs }, () => playGreedy(start, random, profile));
}

/** Plays `runs` simulated games with a fixed seed so the numbers are reproducible. */
export function simulate(start: GameState, runs = 200, seed = 1, profile: PlayerProfile = CASUAL): SimulationStats {
  const outcomes = playMany(start, runs, seed, profile);
  const share = (test: (o: GameOutcome) => boolean) => outcomes.filter(test).length / runs;
  const mean = (value: (o: GameOutcome) => number) => outcomes.reduce((sum, o) => sum + value(o), 0) / runs;
  return {
    winRate: share((o) => o.won),
    blockedRate: share((o) => o.loseReason === 'blocked'),
    stuckRate: share((o) => o.stuck),
    timeUpRate: share((o) => o.loseReason === 'timeUp'),
    avgMaxCombo: mean((o) => o.maxCombo),
    avgScore: mean((o) => o.score),
    avgFree: mean((o) => o.meanFree),
    pressure: mean((o) => o.tightShare),
  };
}

export function greedyWinRate(start: GameState, runs = 200, seed = 1): number {
  return simulate(start, runs, seed).winRate;
}
