import { dropHeld, freeFrontSlots, isShelfLocked, moveItem, pickFromBelt } from './game';
import { createGame, LevelError, type LevelDefinition } from './level';
import type { GameState, MoveResult, Position } from './types';

/** Where a first move takes its item from: a front slot or a belt slot. */
export type MoveSource = Position | { readonly belt: number };

export interface FirstMove {
  readonly from: MoveSource;
  readonly to: Position;
}

/** Applies a move from a shelf, or a take-and-drop from the belt, as a single action. */
export function playMove(state: GameState, { from, to }: FirstMove): MoveResult {
  if (!('belt' in from)) return moveItem(state, from, to);
  const picked = pickFromBelt(state, from.belt);
  return picked.ok ? dropHeld(picked.state, to) : picked;
}

/** Every move available at the start: front items on unlocked shelves and belt items, to any free front slot. */
export function firstMoves(state: GameState): FirstMove[] {
  const targets = state.shelves.flatMap((_, t) => freeFrontSlots(state, t).map((slot) => ({ shelf: t, layer: 0, slot })));
  const moves: FirstMove[] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, slot) => {
      if (item) for (const to of targets) moves.push({ from: { shelf: s, layer: 0, slot }, to });
    });
  });
  state.conveyor?.slots.forEach((item, belt) => {
    if (item) for (const to of targets) moves.push({ from: { belt }, to });
  });
  return moves;
}

/** First moves that lose the level on the spot because the board runs out of usable space. */
export function oneMoveTraps(state: GameState): FirstMove[] {
  return firstMoves(state).filter((move) => {
    const result = playMove(state, move);
    return result.ok && result.state.loseReason === 'blocked';
  });
}

/**
 * Design checks for shipped levels, on top of createGame's structural validation. Rejects levels where some
 * first move leads straight to a blocked defeat. Kept separate from createGame so unit tests can still build
 * such boards on purpose, and so dev-only tweaks never crash a running game.
 */
export function validateLevel(level: LevelDefinition): GameState {
  const state = createGame(level);
  const traps = oneMoveTraps(state);
  if (traps.length > 0) {
    const { from, to } = traps[0]!;
    const source = 'belt' in from ? `belt slot ${from.belt}` : `shelf ${from.shelf} slot ${from.slot}`;
    throw new LevelError(
      `${level.id}: ${traps.length} first move(s) lose at once, e.g. ${source} to shelf ${to.shelf} slot ${to.slot}`,
    );
  }
  return state;
}
