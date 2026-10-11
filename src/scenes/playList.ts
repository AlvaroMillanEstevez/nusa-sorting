import type { LevelDefinition } from '../core';
import { levels } from '../data/levels';

/** A level and the number it shows. */
export interface NumberedLevel {
  readonly number: number;
  readonly level: LevelDefinition;
}

const list: NumberedLevel[] = levels.map((level, i) => ({ number: i + 1, level }));

/** The levels the game plays, in order, with the number each one shows. */
export const playList: readonly NumberedLevel[] = list;

/** Demo levels are numbered from here on when added in development (demo 15 is level 115). */
export const DEMO_NUMBERS_FROM = 100;

/**
 * Development only (?demo=N): adds the test fixtures' demo levels after the game's own, numbered from
 * DEMO_NUMBERS_FROM + 1, so they can be played like any level. Called before the game starts.
 */
export function addDemoLevels(demos: readonly LevelDefinition[]): void {
  demos.forEach((level, i) => list.push({ number: DEMO_NUMBERS_FROM + i + 1, level }));
}
