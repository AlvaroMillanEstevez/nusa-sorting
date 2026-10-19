import { canProgress, isShelfClosed, isShelfLocked, stackOf } from './game';
import type { GameState, Item } from './types';

/**
 * Why a board is stuck (see canProgress), in the terms a player sees, so the defeat can say so and point at it:
 *
 * - 'blocker': the roaming blocker holds the way on. Its shelf has layers behind waiting for its front to empty
 *   (`behind`), or it takes the shelf a triple needs. Without it there would be a way.
 * - 'locked': the copies needed are on locked shelves, which only open after more triples.
 * - 'buried': the copies needed are on track stacks, deeper than the free slots allow to dig.
 * - 'space': items wait in layers behind, and there are not the 3 free slots needed to bring a layer forward.
 * - 'none': nothing in particular (kept for safety; every stuck board has one of the causes above).
 *
 * Causes are tried in that order: the first that, taken away, would leave a way on. `shelves` and `tracks` are
 * what to point at.
 */
export type StuckCause =
  | { readonly kind: 'blocker'; readonly shelf: number; readonly behind: boolean }
  | { readonly kind: 'locked'; readonly shelves: readonly number[] }
  | { readonly kind: 'buried'; readonly tracks: readonly number[] }
  | { readonly kind: 'space'; readonly shelves: readonly number[] }
  | { readonly kind: 'none' };

export function stuckCause(state: GameState): StuckCause {
  const playing: GameState = { ...state, status: 'playing', loseReason: null };
  const open = (s: number) => !isShelfLocked(playing, s) && !isShelfClosed(playing, s);

  // The blocker: the same board with an item that matches nothing in its place (so free room stays the same).
  const blocker = playing.blocker;
  if (blocker) {
    const shelf = blocker.at.shelf;
    const placeholder: Item = { id: -1, type: '\u0000blocker' };
    const shelves = playing.shelves.map((s, i) =>
      i !== shelf ? s : { layers: [s.layers[0]!.map((item, slot) => (slot === blocker.at.slot ? placeholder : item)), ...s.layers.slice(1)] },
    );
    if (canProgress({ ...playing, blocker: null, shelves })) return { kind: 'blocker', shelf, behind: playing.shelves[shelf]!.layers.length > 1 };
  }

  // Locked shelves, as if they were open.
  const locked = playing.shelves.flatMap((_, s) => (isShelfLocked(playing, s) ? [s] : []));
  if (locked.length > 0 && canProgress({ ...playing, unlockAt: playing.unlockAt.map(() => null) })) return { kind: 'locked', shelves: locked };

  // Track stacks, as if every item in them were within reach: some kind has three copies counting them.
  const counts = new Map<string, number>();
  const add = (item: Item) => counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  playing.shelves.forEach((shelf, s) => {
    if (!open(s)) return;
    shelf.layers[0]!.forEach((item, slot) => {
      if (item && !(blocker?.at.shelf === s && blocker.at.slot === slot)) add(item);
    });
  });
  if (playing.held) add(playing.held.item);
  const tracks = playing.tracks.flatMap((track, t) => (track.carriers.some((c) => stackOf(c).length > 0) ? [t] : []));
  for (const track of playing.tracks) for (const carrier of track.carriers) stackOf(carrier).forEach(add);
  if (tracks.length > 0 && [...counts.values()].some((n) => n >= 3)) return { kind: 'buried', tracks };

  // Layers behind waiting for room.
  const waiting = playing.shelves.flatMap((shelf, s) => (open(s) && shelf.layers.length > 1 ? [s] : []));
  if (waiting.length > 0) return { kind: 'space', shelves: waiting };
  return { kind: 'none' };
}
