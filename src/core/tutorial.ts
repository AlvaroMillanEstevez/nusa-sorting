import { firstMoves, isCarrierSource, playMove, type FirstMove } from './validation';
import type { GameEvent, GameState, Position } from './types';

/** Tutorials the game shows once, saved by id once completed. */
export const FIRST_TRIPLE_TUTORIAL = 'first-triple';

/** A shelf-to-shelf move: the kind the first-triple tutorial shows. */
export interface ShelfMove {
  readonly from: Position;
  readonly to: Position;
}

/**
 * Moves from one shelf to another that clear a triple on the spot. Moves from a track and reorders within a
 * shelf are left out (a reorder never completes a triple).
 */
export function tripleMoves(state: GameState): ShelfMove[] {
  return firstMoves(state).flatMap((move: FirstMove) => {
    if (isCarrierSource(move.from) || move.from.shelf === move.to.shelf) return [];
    const result = playMove(state, move);
    return result.ok && result.events.some((e) => e.kind === 'tripleCleared') ? [{ from: move.from, to: move.to }] : [];
  });
}

/**
 * The move the first-triple tutorial points at: one that completes a triple, of a food that is not fresh if it can
 * (the fresh one is the tutorial's second step), preferring the shortest hop between shelves (fewest shelves apart,
 * then board order). Null if the board has none.
 */
export function tutorialMove(state: GameState): ShelfMove | null {
  const fresh = (move: ShelfMove) => state.fresh.some((f) => f.type === state.shelves[move.from.shelf]!.layers[0]![move.from.slot]?.type);
  const cost = (move: ShelfMove) => (fresh(move) ? 100 : 0) + Math.abs(move.to.shelf - move.from.shelf);
  let best: ShelfMove | null = null;
  for (const move of tripleMoves(state)) if (!best || cost(move) < cost(best)) best = move;
  return best;
}

/** Whether a move's events complete the first-triple tutorial: any triple counts, by drag or by tap. */
export function completesFirstTriple(events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === 'tripleCleared');
}
