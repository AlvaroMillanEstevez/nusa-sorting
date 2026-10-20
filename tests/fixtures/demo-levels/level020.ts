import type { LevelDefinition } from '../../../src/core';

/**
 * Fresh foods (basi), demo C: two fresh foods with other mechanics. A copy of each fresh food rides a slow belt
 * or waits on a shelf that opens after two triples, so saving them means planning around both.
 */
export const level020: LevelDefinition = {
  id: 'level020',
  timeLimitSeconds: 170,
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2, 3] },
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [4, 5, 6] },
    ],
  },
  mechanics: [
    {
      kind: 'fresh',
      foods: [
        { type: 'kerupuk-udang', moves: 16 },
        { type: 'es-teh-manis', moves: 24 },
      ],
    },
    { kind: 'lockedShelves', shelves: [{ shelf: 6, triplesRequired: 2 }] },
    {
      kind: 'tracks',
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.3,
          carriers: [['kerupuk-udang'], ['sate'], [], ['bakso', 'onde-onde'], ['durian'], []],
        },
      ],
    },
  ],
  shelves: [
    [
      ['kerupuk-udang', 'sate', null],
      ['manggis', 'durian', 'bakso'],
    ],
    [['es-teh-manis', 'manggis', null]],
    [
      [null, 'bakso', 'ketupat'],
      ['onde-onde', 'sate', 'ketupat'],
    ],
    [['durian', 'kerupuk-udang', null]],
    [
      ['ketupat', null, 'onde-onde'],
      ['manggis', 'es-teh-manis', null],
    ],
    [['nasi-goreng', null, null]],
    [['es-teh-manis', 'nasi-goreng', 'nasi-goreng']],
  ],
};
