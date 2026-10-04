import {
  carrierOfShelf,
  dropHeld,
  freeFrontSlots,
  isShelfLocked,
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

/** Seconds a casual player needs per move on a level with five item types (the demo levels' usual count). */
export const SECONDS_PER_MOVE = 2.5;

/**
 * Seconds per move on a level with `types` item types: telling more types apart takes longer, about 0.12 s per
 * type around the five-type baseline. A guess to be checked by playing.
 */
export function secondsPerMove(types: number): number {
  return SECONDS_PER_MOVE + 0.12 * (types - 5);
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
  return 0.5 + 0.75 * Math.abs(speed);
}

/** Slots a shelf track moves per carrier: a shelf and the gap to the next one are about two slots tall. */
export const SLOTS_PER_SHELF_CARRIER = 1.95;

/**
 * Estimated extra seconds to drop an item on (or take one from) a shelf riding a track: aiming at something
 * moving. Grows with how fast its slots move. A guess to be checked by playing.
 */
export function movingShelfSeconds(carriersPerSecond: number): number {
  return 0.5 + 0.75 * Math.abs(carriersPerSecond) * SLOTS_PER_SHELF_CARRIER;
}

/** Extra seconds a move costs because its source or target shelf rides a track (the larger of the two). */
export function movingShelfCost(state: GameState, from: Source, to: Position): number {
  const costOf = (shelf: number) => {
    const ref = carrierOfShelf(state, shelf);
    return ref ? movingShelfSeconds(state.tracks[ref.track]!.speed) : 0;
  };
  return Math.max(isBeltSource(from) ? 0 : costOf(from.shelf), costOf(to.shelf));
}

export interface GameOutcome {
  readonly won: boolean;
  readonly loseReason: LoseReason | null;
  readonly moves: number;
  readonly maxCombo: number;
  readonly score: number;
  /** Game time the game took, in seconds. */
  readonly seconds: number;
}

/**
 * Simulated casual player: completes a triple when it can, otherwise prefers moves that pair an item with a
 * matching one, otherwise moves at random, but does not split a pair it already has unless nothing else is
 * left. A quarter of the time it misses the best move and takes any move that splits no pair. Never reorders
 * and does not plan combos. Each move takes
 * secondsPerMove of game time for the level's number of types (plus beltPickSeconds when taken from a track stack, and movingShelfSeconds when
 * a moving shelf is involved), so the clock and combo
 * windows behave as in a real game.
 */
export function playGreedy(start: GameState, random: () => number, maxMoves = 400): GameOutcome {
  let state = start;
  let moves = 0;
  let seconds = 0;
  const basePerMove = secondsPerMove(typeCount(start));
  for (; moves < maxMoves && state.status === 'playing'; moves++) {
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
        return { result, seconds, score: clears ? 3 : pairs ? 2 : splits ? 0 : 1 };
      })
      .filter((option) => option !== null);
    if (options.length === 0) break;
    const best = Math.max(...options.map((o) => o.score));
    // Casual players miss things: a quarter of the time they take any move (that splits no pair, if they can).
    const sensible = options.filter((o) => o.score > 0);
    const pool = random() < 0.25 ? (sensible.length > 0 ? sensible : options) : options.filter((o) => o.score === best);
    const choice = pool[Math.floor(random() * pool.length)]!;
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
  };
}

export interface SimulationStats {
  readonly winRate: number;
  /** Share of games lost because the board ran out of usable space. */
  readonly blockedRate: number;
  readonly timeUpRate: number;
  readonly avgMaxCombo: number;
  readonly avgScore: number;
}

/** Plays `runs` simulated games with a fixed seed so the outcomes are reproducible. */
export function playMany(start: GameState, runs = 200, seed = 1): GameOutcome[] {
  const random = rng(seed);
  return Array.from({ length: runs }, () => playGreedy(start, random));
}

/** Plays `runs` simulated games with a fixed seed so the numbers are reproducible. */
export function simulate(start: GameState, runs = 200, seed = 1): SimulationStats {
  const outcomes = playMany(start, runs, seed);
  const share = (test: (o: GameOutcome) => boolean) => outcomes.filter(test).length / runs;
  const mean = (value: (o: GameOutcome) => number) => outcomes.reduce((sum, o) => sum + value(o), 0) / runs;
  return {
    winRate: share((o) => o.won),
    blockedRate: share((o) => o.loseReason === 'blocked'),
    timeUpRate: share((o) => o.loseReason === 'timeUp'),
    avgMaxCombo: mean((o) => o.maxCombo),
    avgScore: mean((o) => o.score),
  };
}

export function greedyWinRate(start: GameState, runs = 200, seed = 1): number {
  return simulate(start, runs, seed).winRate;
}
