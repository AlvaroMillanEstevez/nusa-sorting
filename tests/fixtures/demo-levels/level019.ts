import type { LevelDefinition } from '../../../src/core';

/**
 * Fresh foods (basi), demo B: three fresh foods with different countdowns (rambutan 8 moves, manggis 14, durian
 * 22). One rambutan waits behind the first shelf and two manggis behind others, so the order matters: dig out the
 * rambutan first, then the manggis, while the durian can wait.
 */
export const level019: LevelDefinition = {
  id: 'level019',
  timeLimitSeconds: 130,
  mechanics: [
    {
      kind: 'fresh',
      foods: [
        { type: 'rambutan', moves: 8 },
        { type: 'manggis', moves: 14 },
        { type: 'durian', moves: 22 },
      ],
    },
  ],
  shelves: [
    [
      ['sate', 'bakso', null],
      ['manggis', 'rambutan', 'bakso'],
    ],
    [
      ['sate', 'rambutan', null],
      ['manggis', 'durian', 'durian'],
    ],
    [['rambutan', null, 'sate']],
    [
      ['manggis', 'ketupat', null],
      ['bakso', 'ketupat', 'durian'],
    ],
    [[null, 'ketupat', null]],
  ],
};
