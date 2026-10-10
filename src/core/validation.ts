import { dropHeld, freeFrontSlots, isShelfLocked, moveItem, pickFromTrack } from './game';
import { createGame, LevelError, type LevelDefinition } from './level';
import type { CarrierRef, GameState, MoveResult, Position } from './types';

/** Where a first move takes its item from: a front slot or the top of a track carrier. */
export type MoveSource = Position | CarrierRef;

export const isCarrierSource = (source: MoveSource): source is CarrierRef => 'carrier' in source;

export interface FirstMove {
  readonly from: MoveSource;
  readonly to: Position;
}

/** Applies a move from a shelf, or a take-and-drop from the belt, as a single action. */
export function playMove(state: GameState, { from, to }: FirstMove): MoveResult {
  if (!isCarrierSource(from)) return moveItem(state, from, to);
  const picked = pickFromTrack(state, from);
  return picked.ok ? dropHeld(picked.state, to) : picked;
}

/**
 * Every move available at the start: front items on unlocked shelves (fixed or riding a track) and the tops of
 * track stacks, to any free front slot.
 */
export function firstMoves(state: GameState): FirstMove[] {
  const targets = state.shelves.flatMap((_, t) => freeFrontSlots(state, t).map((slot) => ({ shelf: t, layer: 0, slot })));
  const moves: FirstMove[] = [];
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    shelf.layers[0]!.forEach((item, slot) => {
      if (item) for (const to of targets) moves.push({ from: { shelf: s, layer: 0, slot }, to });
    });
  });
  state.tracks.forEach((trackState, track) => {
    trackState.carriers.forEach((carrier, index) => {
      if (carrier.kind === 'stack' && carrier.stack.length > 0) {
        for (const to of targets) moves.push({ from: { track, carrier: index }, to });
      }
    });
  });
  return moves;
}

/** First moves that lose the level on the spot: the board runs out of usable space, or gets stuck. */
export function oneMoveTraps(state: GameState): FirstMove[] {
  return firstMoves(state).filter((move) => {
    const result = playMove(state, move);
    return result.ok && (result.state.loseReason === 'blocked' || result.state.loseReason === 'stuck');
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
    const source = isCarrierSource(from)
      ? `track ${from.track} carrier ${from.carrier}`
      : `shelf ${from.shelf} slot ${from.slot}`;
    throw new LevelError(
      `${level.id}: ${traps.length} first move(s) lose at once, e.g. ${source} to shelf ${to.shelf} slot ${to.slot}`,
    );
  }
  return state;
}

/**
 * A sequence of at most `maxMoves` moves (between shelves, or from a track) that ends in a blocked or stuck defeat, or
 * null if there is none. Shipped levels must have none within two moves: running out of space should come
 * from poor choices later on (which shelf to free, what to reorder), not from the first touches.
 * Reordering within a shelf is skipped: it never changes how much space there is.
 */
export function trapWithin(state: GameState, maxMoves: number): FirstMove[] | null {
  if (maxMoves <= 0 || state.status !== 'playing') return null;
  for (const move of firstMoves(state)) {
    if (!isCarrierSource(move.from) && move.from.shelf === move.to.shelf) continue;
    const result = playMove(state, move);
    if (!result.ok) continue;
    if (result.state.loseReason === 'blocked' || result.state.loseReason === 'stuck') return [move];
    const rest = trapWithin(result.state, maxMoves - 1);
    if (rest) return [move, ...rest];
  }
  return null;
}

/**
 * How deep each item starts: its layer on a shelf (one more on a locked shelf, which must be opened first), or
 * its place in a track stack (0 = on top). Layers behind the roaming blocker's start also count one more: they
 * cannot come forward until a triple elsewhere makes it jump.
 */
export function itemDepths(state: GameState): Map<string, number[]> {
  const depths = new Map<string, number[]>();
  const add = (type: string, depth: number) => {
    const list = depths.get(type) ?? [];
    list.push(depth);
    depths.set(type, list);
  };
  state.shelves.forEach((shelf, s) => {
    const extra = isShelfLocked(state, s) ? 1 : 0;
    const blocked = state.blocker?.at.shelf === s ? 1 : 0;
    shelf.layers.forEach((layer, l) => layer.forEach((item) => item && add(item.type, l + extra + (l > 0 ? blocked : 0))));
  });
  for (const track of state.tracks) {
    for (const carrier of track.carriers) {
      if (carrier.kind === 'stack') carrier.stack.forEach((item, d) => add(item.type, d));
    }
  }
  for (const list of depths.values()) list.sort((a, b) => a - b);
  return depths;
}

export interface DepthIssue {
  readonly type: string;
  /** Which triple of the type, in depth order (0 = the shallowest three). */
  readonly triple: number;
  /** How many layers deeper the item completing it is than the first of the three. */
  readonly spread: number;
}

/**
 * Triples buried too deep: taking each type's items in depth order, three at a time, the item that completes a
 * triple may be at most `maxDepth` layers deeper than the first item of that triple.
 */
export function tripleDepthIssues(state: GameState, maxDepth: number): DepthIssue[] {
  const issues: DepthIssue[] = [];
  for (const [type, depths] of itemDepths(state)) {
    for (let k = 0; k * 3 + 2 < depths.length; k++) {
      const spread = depths[k * 3 + 2]! - depths[k * 3]!;
      if (spread > maxDepth) issues.push({ type, triple: k, spread });
    }
  }
  return issues;
}

/**
 * Triples that can be completed at the start with what is in view and the layer right behind it (on unlocked
 * shelves, except behind the roaming blocker, which holds that layer back; the top two items of track stacks).
 */
export function startTriples(state: GameState): number {
  const counts = new Map<string, number>();
  const add = (type: string) => counts.set(type, (counts.get(type) ?? 0) + 1);
  state.shelves.forEach((shelf, s) => {
    if (isShelfLocked(state, s)) return;
    const inReach = state.blocker?.at.shelf === s ? 1 : 2;
    for (const layer of shelf.layers.slice(0, inReach)) for (const item of layer) if (item) add(item.type);
  });
  for (const track of state.tracks) {
    for (const carrier of track.carriers) if (carrier.kind === 'stack') carrier.stack.slice(0, 2).forEach((item) => add(item.type));
  }
  let triples = 0;
  for (const count of counts.values()) triples += Math.floor(count / 3);
  return triples;
}

/**
 * The game's levels hold exactly one triple of each type (colour variants are types of their own): returns the
 * types that appear some other number of times, with their count. Empty when the level follows the rule.
 */
export function typesNotOneTriple(state: GameState): { readonly type: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  const add = (type: string) => counts.set(type, (counts.get(type) ?? 0) + 1);
  for (const shelf of state.shelves) for (const layer of shelf.layers) for (const item of layer) if (item) add(item.type);
  for (const track of state.tracks) {
    for (const carrier of track.carriers) if (carrier.kind === 'stack') carrier.stack.forEach((item) => add(item.type));
  }
  if (state.held) add(state.held.item.type);
  return [...counts].filter(([, count]) => count !== 3).map(([type, count]) => ({ type, count }));
}
