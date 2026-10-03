import { freeFrontSlots, isWon, moveItem, type GameState, type Position } from '../src/core';

export const front = (shelf: number, slot: number): Position => ({ shelf, layer: 0, slot });

/** All item ids currently on the board, in board order. */
export function itemIds(state: GameState): number[] {
  return state.shelves.flatMap((shelf) => shelf.layers.flatMap((layer) => layer.flatMap((slot) => (slot ? [slot.id] : []))));
}

/** Every valid move from a state (front item to any free front slot, including reordering in its shelf). */
export function validMoves(state: GameState): [Position, Position][] {
  const moves: [Position, Position][] = [];
  state.shelves.forEach((shelf, s) => {
    shelf.layers[0]!.forEach((slot, i) => {
      if (!slot) return;
      state.shelves.forEach((_, t) => {
        for (const j of freeFrontSlots(state, t)) moves.push([front(s, i), front(t, j)]);
      });
    });
  });
  return moves;
}

/** Canonical key: slot order inside a layer does not affect which triples can form. */
function stateKey(state: GameState): string {
  return state.shelves
    .map((shelf) =>
      shelf.layers
        .map((layer) =>
          layer
            .map((slot) => slot?.type ?? '.')
            .sort()
            .join(','),
        )
        .join('|'),
    )
    .join('/');
}

/**
 * Iterative depth-first search for a winning move sequence; undefined if the level is unsolvable.
 * Only the first free slot of each target shelf is tried, and clearing moves are tried first.
 */
export function solve(start: GameState, maxStates = 200_000): [Position, Position][] | undefined {
  type Node = { state: GameState; path: [Position, Position][] };
  const seen = new Set<string>([stateKey(start)]);
  const stack: Node[] = [{ state: start, path: [] }];
  while (stack.length > 0) {
    const { state, path } = stack.pop()!;
    if (isWon(state)) return path;
    if (seen.size > maxStates) return undefined;

    const children: { node: Node; clears: number }[] = [];
    for (const [from, to] of validMoves(state)) {
      // Reordering never changes which triples can form, so the solver skips it.
      if (from.shelf === to.shelf) continue;
      if (freeFrontSlots(state, to.shelf)[0] !== to.slot) continue;
      const result = moveItem(state, from, to);
      if (!result.ok) continue;
      const key = stateKey(result.state);
      if (seen.has(key)) continue;
      seen.add(key);
      const clears = result.events.filter((e) => e.kind === 'tripleCleared').length;
      children.push({ node: { state: result.state, path: [...path, [from, to]] }, clears });
    }
    // Stack is LIFO: push the most promising children last.
    children.sort((a, b) => a.clears - b.clears);
    for (const child of children) stack.push(child.node);
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
