import { freeFrontSlots, isWon, moveItem, type GameState, type Position } from '../src/core';

export const front = (shelf: number, slot: number): Position => ({ shelf, layer: 0, slot });

/** All item ids currently on the board, in board order. */
export function itemIds(state: GameState): number[] {
  return state.shelves.flatMap((shelf) => shelf.layers.flatMap((layer) => layer.flatMap((slot) => (slot ? [slot.id] : []))));
}

/** Every valid move from a state (front item to a free front slot on another shelf). */
export function validMoves(state: GameState): [Position, Position][] {
  const moves: [Position, Position][] = [];
  state.shelves.forEach((shelf, s) => {
    shelf.layers[0]!.forEach((slot, i) => {
      if (!slot) return;
      state.shelves.forEach((_, t) => {
        if (t === s) return;
        for (const j of freeFrontSlots(state, t)) moves.push([front(s, i), front(t, j)]);
      });
    });
  });
  return moves;
}

function stateKey(state: GameState): string {
  return state.shelves
    .map((shelf) => shelf.layers.map((layer) => layer.map((slot) => slot?.type ?? '.').join(',')).join('|'))
    .join('/');
}

/** Depth-first search for a winning move sequence; undefined if the level is unsolvable. */
export function solve(start: GameState): [Position, Position][] | undefined {
  const seen = new Set<string>();
  const path: [Position, Position][] = [];
  const dfs = (state: GameState): boolean => {
    if (isWon(state)) return true;
    const key = stateKey(state);
    if (seen.has(key)) return false;
    seen.add(key);
    for (const [from, to] of validMoves(state)) {
      const result = moveItem(state, from, to);
      if (!result.ok) continue;
      path.push([from, to]);
      if (dfs(result.state)) return true;
      path.pop();
    }
    return false;
  };
  return dfs(start) ? path : undefined;
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
