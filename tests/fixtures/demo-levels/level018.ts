import type { LevelDefinition } from '../../../src/core';

/**
 * Fresh foods (basi), demo A: one fresh food, the rambutan, with a generous countdown of 18 moves, on a small open
 * board. Enough to see the mark count down and to make its triple in time, or to let it spoil and see what that
 * costs.
 */
export const level018: LevelDefinition = {
  id: 'level018',
  timeLimitSeconds: 120,
  mechanics: [{ kind: 'fresh', foods: [{ type: 'rambutan', moves: 18 }] }],
  shelves: [
    [['sate', 'rambutan', null]],
    [
      ['bakso', 'sate', 'rambutan'],
      ['ketupat', 'ketupat', 'bakso'],
    ],
    [[null, 'bakso', 'sate']],
    [['rambutan', null, 'ketupat']],
  ],
};
