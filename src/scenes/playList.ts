import type { LevelDefinition } from '../core';
import { levels } from '../data/levels';

/** A level and the number it shows. */
export interface NumberedLevel {
  readonly number: number;
  readonly level: LevelDefinition;
}

/** The levels the game plays, in order, with the number each one shows. */
export const playList: readonly NumberedLevel[] = levels.map((level, i) => ({ number: i + 1, level }));
