import type { LevelDefinition } from '../../core';
import { level001 } from './level001';
import { level002 } from './level002';
import { level003 } from './level003';
import { level004 } from './level004';
import { level005 } from './level005';
import { level006 } from './level006';
import { level007 } from './level007';
import { level008 } from './level008';
import { level009 } from './level009';
import { level010 } from './level010';
import { level011 } from './level011';
import { level012 } from './level012';
import { level013 } from './level013';
import { level014 } from './level014';

/**
 * Levels in play order: three base levels from easiest to hardest, one demo per mechanic (combo, locked
 * shelves, roaming blocker), one combining both obstacles, then the conveyor prototype: a slow belt alone
 * and a faster belt with a locked shelf; then column layouts with vertical conveyors carrying stacks; then
 * vertical tracks of shelves that take items too.
 */
export const levels: readonly LevelDefinition[] = [
  level001,
  level002,
  level003,
  level004,
  level005,
  level006,
  level007,
  level008,
  level009,
  level010,
  level011,
  level012,
  level013,
  level014,
];

/** Number of leading levels that use no mechanics. */
export const BASE_LEVEL_COUNT = 3;
