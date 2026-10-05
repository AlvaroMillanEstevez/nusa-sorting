import { levels, upcomingLevels, type NumberedLevel } from '../data/levels';

/**
 * The levels the game plays, in order, with the number each one shows. In development, the themed levels made
 * ahead of their turn (15, 20) follow level 10 under their own number, so they can be played before the
 * levels in between exist; production builds play only the regular sequence.
 */
export const playList: readonly NumberedLevel[] = [
  ...levels.map((level, i) => ({ number: i + 1, level })),
  ...(import.meta.env.DEV ? upcomingLevels : []),
];
