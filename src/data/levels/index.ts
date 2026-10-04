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
