import type { LevelDefinition } from '../../core';

/** A vertical conveyor with stacks up to three deep beside six shelves, one of them locked. */
export const level012: LevelDefinition = {
  id: 'level012',
  timeLimitSeconds: 140,
  layout: {
    columns: [
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'shelves', shelves: [3, 4, 5] },
    ],
  },
  mechanics: [
    { kind: 'lockedShelves', shelves: [{ shelf: 0, triplesRequired: 2 }] },
    {
      kind: 'tracks',
      // Speed in carriers per second: negative runs up, positive runs down. Each carrier is a stack, top first.
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.45,
          carriers: [[], ['manggis'], ['sate', 'rambutan', 'nasi-goreng'], ['rambutan', 'sate', 'ketupat'], ['manggis', 'rambutan']],
        },
      ],
    },
  ],
  shelves: [
    [['sate', 'manggis', 'ketupat']],
    [
      ['nasi-goreng', 'rambutan', null],
      ['sate', 'nasi-goreng', 'ketupat'],
    ],
    [['manggis', 'ketupat', 'nasi-goreng']],
    [['ketupat', 'manggis', null]],
    [['sate', 'ketupat', 'rambutan']],
    [
      [null, 'nasi-goreng', 'manggis'],
      ['nasi-goreng', 'sate', 'rambutan'],
    ],
  ],
};
