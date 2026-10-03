import { freeFrontSlots, isShelfLocked, isWon, moveItem, tick, type GameState, type LoseReason, type Position } from '../src/core';

export const front = (shelf: number, slot: number): Position => ({ shelf, layer: 0, slot });

/** All item ids currently on the board, in board order. */
export function itemIds(state: GameState): number[] {
  return state.shelves.flatMap((shelf) => shelf.layers.flatMap((layer) => layer.flatMap((slot) => (slot ? [slot.id] : []))));
}

/**
 * Every valid move from a state: a front item on an unlocked shelf to any free front slot (blocked slots
 * and locked shelves excluded), including reordering in its own shelf.
 */
export function validMoves(state: GameState): [Position, Position][] {
  const moves: [Position, Position][] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((slot, i) => {
      if (!slot) return;
      state.shelves.forEach((_, t) => {
        for (const j of freeFrontSlots(state, t)) moves.push([front(s, i), front(t, j)]);
      });
    });
  });
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
  return `${board}#${state.triplesCleared}#${blocker}`;
}

/**
 * Iterative depth-first search for a winning move sequence; undefined if none is found.
 * The clock is ignored. Combos are assumed to break between moves (worst case), so a blocker only
 * disappears if chained triples within a single move reach its threshold.
 * Clearing moves are tried first; reordering is skipped since it never changes which triples can form.
 */
export function solve(start: GameState, maxStates = 200_000): [Position, Position][] | undefined {
  // Moves are stored as parent links so memory per state stays constant however deep the search goes.
  type Step = { parent: number; move: [Position, Position] | null };
  const steps: Step[] = [{ parent: -1, move: null }];
  const untimed: GameState = { ...start, timeLeftMs: null };
  const seen = new Set<string>([stateKey(untimed)]);
  const stack: { state: GameState; step: number }[] = [{ state: untimed, step: 0 }];
  while (stack.length > 0) {
    const { state, step } = stack.pop()!;
    if (isWon(state)) {
      const path: [Position, Position][] = [];
      for (let i = step; steps[i]!.move; i = steps[i]!.parent) path.push(steps[i]!.move!);
      return path.reverse();
    }
    if (seen.size > maxStates) return undefined;

    const children: { state: GameState; step: number; clears: number }[] = [];
    for (const [from, to] of validMoves(state)) {
      if (from.shelf === to.shelf) continue;
      // Without a blocker any free slot of a shelf is equivalent, so try only the first.
      if (!state.blocker && freeFrontSlots(state, to.shelf)[0] !== to.slot) continue;
      const result = moveItem(state, from, to);
      if (!result.ok) continue;
      const next = state.combo ? tick(result.state, state.combo.windowMs).state : result.state;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      steps.push({ parent: step, move: [from, to] });
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

/** Seconds a casual player needs per move; the level clock and combo window advance by this much per move. */
export const SECONDS_PER_MOVE = 2.5;

export interface GameOutcome {
  readonly won: boolean;
  readonly loseReason: LoseReason | null;
  readonly moves: number;
  readonly maxCombo: number;
  readonly score: number;
}

/**
 * Simulated casual player: completes a triple when it can, otherwise prefers moves that pair an item with a
 * matching one, otherwise moves at random. Never reorders and does not plan combos. Each move takes
 * SECONDS_PER_MOVE of game time, so the clock and combo windows behave as in a real game.
 */
export function playGreedy(start: GameState, random: () => number, maxMoves = 400): GameOutcome {
  let state = start;
  let moves = 0;
  for (; moves < maxMoves && state.status === 'playing'; moves++) {
    const options = validMoves(state)
      .filter(([from, to]) => from.shelf !== to.shelf)
      .map(([from, to]) => {
        const result = moveItem(state, from, to);
        if (!result.ok) return null;
        const type = state.shelves[from.shelf]!.layers[0]![from.slot]!.type;
        const clears = result.events.some((e) => e.kind === 'tripleCleared');
        const pairs = state.shelves[to.shelf]!.layers[0]!.some((slot) => slot?.type === type);
        return { result, score: clears ? 2 : pairs ? 1 : 0 };
      })
      .filter((option) => option !== null);
    if (options.length === 0) break;
    const best = Math.max(...options.map((o) => o.score));
    // Casual players miss things: a quarter of the time they take any move instead of the best one.
    const pool = random() < 0.25 ? options : options.filter((o) => o.score === best);
    state = pool[Math.floor(random() * pool.length)]!.result.state;
    state = tick(state, SECONDS_PER_MOVE * 1000).state;
  }
  return {
    won: state.status === 'won',
    loseReason: state.loseReason,
    moves,
    maxCombo: state.combo?.maxCombo ?? 0,
    score: state.combo?.score ?? 0,
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

/** Plays `runs` simulated games with a fixed seed so the numbers are reproducible. */
export function simulate(start: GameState, runs = 200, seed = 1): SimulationStats {
  const random = rng(seed);
  const outcomes = Array.from({ length: runs }, () => playGreedy(start, random));
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
