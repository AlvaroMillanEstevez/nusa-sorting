import type { LevelDefinition } from '../../../src/core';

/** Column layout demo: shelves | a slow vertical conveyor of stacks running down | shelves. */
export const level010: LevelDefinition = {
  id: 'level010',
  timeLimitSeconds: 110,
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
      // Speed in carriers per second: negative runs up, positive runs down. Each carrier is a stack, top first.
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.35,
          carriers: [['rambutan'], [], ['ketupat', 'nasi-goreng'], ['rambutan', 'nasi-goreng'], [], ['rambutan']],
        },
      ],
    },
  ],
  shelves: [
    [
      ['rambutan', null, 'manggis'],
      ['rambutan', 'manggis', 'nasi-goreng'],
    ],
    [
      ['manggis', 'nasi-goreng', 'ketupat'],
      ['nasi-goreng', 'ketupat', 'manggis'],
    ],
    [['nasi-goreng', null, null]],
    [[null, 'ketupat', 'ketupat']],
    [[null, 'manggis', 'ketupat']],
    [[null, 'manggis', 'rambutan']],
  ],
};
