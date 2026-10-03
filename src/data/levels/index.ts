import type { LevelDefinition } from '../../core';
import { level001 } from './level001';
import { level002 } from './level002';
import { level003 } from './level003';
import { level004 } from './level004';
import { level005 } from './level005';
import { level006 } from './level006';
import { level007 } from './level007';

/**
 * Levels in play order: three base levels from easiest to hardest, then one demo per mechanic
 * (combo, locked shelves, roaming blocker) and one combining both obstacles.
 */
export const levels: readonly LevelDefinition[] = [level001, level002, level003, level004, level005, level006, level007];

/** Number of leading levels that use no mechanics. */
export const BASE_LEVEL_COUNT = 3;
