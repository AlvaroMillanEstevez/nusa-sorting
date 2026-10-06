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
import { nusa011 } from './nusa-011';
import { nusa012 } from './nusa-012';
import { nusa013 } from './nusa-013';
import { nusa014 } from './nusa-014';
import { nusa015 } from './nusa-015';
import { nusa016 } from './nusa-016';
import { nusa017 } from './nusa-017';
import { nusa018 } from './nusa-018';
import { nusa019 } from './nusa-019';
import { nusa020 } from './nusa-020';
import { nusa021 } from './nusa-021';
import { nusa022 } from './nusa-022';
import { nusa023 } from './nusa-023';
import { nusa024 } from './nusa-024';

/**
 * The game's levels in play order. Made with the level generator (tools/levelgen) from the recipes in
 * tools/levelgen/recipes.ts, then reviewed: a sawtooth curve where something new or demanding is followed by an
 * easier level, with a themed level every fifth level.
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
  nusa011,
  nusa012,
  nusa013,
  nusa014,
  nusa015,
  nusa016,
  nusa017,
  nusa018,
  nusa019,
  nusa020,
  nusa021,
  nusa022,
  nusa023,
  nusa024,
];
