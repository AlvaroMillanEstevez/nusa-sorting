import type { GameState } from './types';

/** Mechanics that get a one-line explanation the first time a level has them, in this order. */
export const INTROS = ['backLayers', 'lockedShelves', 'roamingBlocker', 'stackTracks', 'shelfTracks'] as const;
export type IntroId = (typeof INTROS)[number];

/** The mechanics a level shows the player, from its starting state. */
export function levelIntros(state: GameState): IntroId[] {
  const has: Record<IntroId, boolean> = {
    backLayers: state.shelves.some((shelf) => shelf.layers.length > 1),
    lockedShelves: state.unlockAt.some((at) => at !== null),
    roamingBlocker: state.blocker !== null,
    stackTracks: state.tracks.some((track) => track.carriers.some((carrier) => carrier.kind === 'stack')),
    shelfTracks: state.tracks.some((track) => track.carriers.some((carrier) => carrier.kind === 'shelf')),
  };
  return INTROS.filter((id) => has[id]);
}

/** The intros of a level the player has not seen yet. */
export function unseenIntros(state: GameState, seen: readonly string[]): IntroId[] {
  return levelIntros(state).filter((id) => !seen.includes(id));
}
