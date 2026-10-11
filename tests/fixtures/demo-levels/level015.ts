import type { LevelDefinition } from '../../../src/core';

/**
 * Fixed stacks demo: shelves | a column of five fixed one-slot stacks | shelves. The stacks never move; only their
 * top item can be taken, and the next one comes up behind it. Two are deep enough to show their count.
 */
export const level015: LevelDefinition = {
  id: 'level015',
  timeLimitSeconds: 150,
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [3, 4, 5] },
    ],
  },
  mechanics: [
    {
      kind: 'tracks',
      // Speed 0: fixed stacks, top first.
      tracks: [
        {
          orientation: 'vertical',
          speed: 0,
          carriers: [
            ['sate', 'durian', 'manggis', 'ketupat', 'bakso', 'rambutan'],
            ['onde-onde'],
            ['es-teh-manis', 'sate', 'kerupuk-udang'],
            ['nasi-goreng', 'ketupat', 'durian', 'onde-onde', 'es-teh-manis'],
            ['manggis', 'bakso'],
          ],
        },
      ],
    },
  ],
  shelves: [
    [
      ['rambutan', null, 'nasi-goreng'],
      ['kerupuk-udang', 'onde-onde', 'durian'],
    ],
    [['bakso', 'es-teh-manis', null]],
    [
      ['ketupat', 'manggis', null],
      ['nasi-goreng', 'sate', 'rambutan'],
    ],
    [[null, 'kerupuk-udang', null]],
    [[null, null, null]],
    [[null, null, null]],
  ],
};
