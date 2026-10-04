import type { LevelDefinition } from '../../../src/core';

/** Shelves riding a track: three fixed shelves beside a slow vertical track of three shelves that take items too. */
export const level013: LevelDefinition = {
  id: 'level013',
  timeLimitSeconds: 110,
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'shelfTrack', track: 0 },
    ],
  },
  mechanics: [
    {
      kind: 'tracks',
      // Speed in carriers per second: negative runs up, positive runs down. A carrier is a stack (top first)
      // or { shelf: i }, one of the shelves below riding the track.
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.25,
          carriers: [{ shelf: 3 }, { shelf: 4 }, { shelf: 5 }],
        },
      ],
    },
  ],
  shelves: [
    [['rambutan', 'manggis', null]],
    [[null, 'nasi-goreng', 'rambutan']],
    [
      ['rambutan', 'ketupat', 'ketupat'],
      ['rambutan', 'ketupat', 'nasi-goreng'],
    ],
    [['nasi-goreng', null, 'manggis']],
    [
      ['nasi-goreng', 'manggis', 'rambutan'],
      ['nasi-goreng', 'manggis', 'manggis'],
    ],
    [['manggis', 'nasi-goreng', 'rambutan']],
  ],
};
