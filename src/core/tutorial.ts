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
 * The move the first-triple tutorial points at: one that completes a triple, preferring the shortest hop between
 * shelves (fewest shelves apart, then board order). Null if the board has none.
 */
export function tutorialMove(state: GameState): ShelfMove | null {
  let best: ShelfMove | null = null;
  for (const move of tripleMoves(state)) {
    if (!best || Math.abs(move.to.shelf - move.from.shelf) < Math.abs(best.to.shelf - best.from.shelf)) best = move;
  }
  return best;
}

/** Whether a move's events complete the first-triple tutorial: any triple counts, by drag or by tap. */
export function completesFirstTriple(events: readonly GameEvent[]): boolean {
  return events.some((e) => e.kind === 'tripleCleared');
}
