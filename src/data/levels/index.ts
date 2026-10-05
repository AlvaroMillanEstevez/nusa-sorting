import type { LevelDefinition } from '../../core';
import { nusa001 } from './nusa-001';
import { nusa002 } from './nusa-002';
import { nusa003 } from './nusa-003';
import { nusa004 } from './nusa-004';
import { nusa005 } from './nusa-005';
import { nusa006 } from './nusa-006';
import { nusa007 } from './nusa-007';
import { nusa008 } from './nusa-008';
import { nusa009 } from './nusa-009';
import { nusa010 } from './nusa-010';
import { nusa015 } from './nusa-015';
import { nusa020 } from './nusa-020';

/**
 * The game's levels in play order. Made with the level generator (tools/levelgen) from the recipes in
 * tools/levelgen/recipes.ts, then reviewed: a sawtooth curve where something new or demanding is followed by an
 * easier level, with special levels at 5 and 10.
 */
export const levels: readonly LevelDefinition[] = [
  nusa001,
  nusa002,
  nusa003,
  nusa004,
  nusa005,
  nusa006,
  nusa007,
  nusa008,
  nusa009,
  nusa010,
];

/** A level and its number in the game, for levels that are not yet part of `levels`. */
export interface NumberedLevel {
  readonly number: number;
  readonly level: LevelDefinition;
}

/**
 * Themed levels made ahead of the levels between them (11 to 14 and 16 to 19). Only the dev build plays them,
 * under their own numbers; they join `levels` once the gap is filled.
 */
export const upcomingLevels: readonly NumberedLevel[] = [
  { number: 15, level: nusa015 },
  { number: 20, level: nusa020 },
];
