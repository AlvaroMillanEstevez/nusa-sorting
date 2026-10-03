import type { LevelDefinition } from '../../core';
import { level001 } from './level001';
import { level002 } from './level002';
import { level003 } from './level003';

/** Levels in play order, from easiest to hardest. */
export const levels: readonly LevelDefinition[] = [level001, level002, level003];
