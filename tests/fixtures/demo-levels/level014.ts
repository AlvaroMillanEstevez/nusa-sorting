import type { LevelDefinition } from '../../../src/core';

/** A track of stacks, a track of shelves (one locked) and fixed shelves, with the roaming blocker. */
export const level014: LevelDefinition = {
  id: 'level014',
  timeLimitSeconds: 140,
  layout: {
    columns: [
      { kind: 'track', track: 0 },
      { kind: 'shelfTrack', track: 1 },
      { kind: 'shelves', shelves: [3, 4, 5] },
    ],
  },
  mechanics: [
    { kind: 'lockedShelves', shelves: [{ shelf: 2, triplesRequired: 2 }] },
    { kind: 'roamingBlocker', start: { shelf: 4, slot: 0 }, seed: 88960, removeAtCombo: 5 },
    {
      kind: 'tracks',
      // Speed in carriers per second: negative runs up, positive runs down. A carrier is a stack (top first)
      // or { shelf: i }, one of the shelves below riding the track.
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.4,
          carriers: [[], ['manggis'], ['manggis', 'manggis'], ['nasi-goreng'], ['nasi-goreng', 'sate']],
        },
        {
          orientation: 'vertical',
          speed: -0.22,
          carriers: [{ shelf: 0 }, { shelf: 1 }, { shelf: 2 }],
        },
      ],
    },
  ],
  shelves: [
    [
      ['nasi-goreng', 'ketupat', null],
      ['rambutan', 'rambutan', 'manggis'],
    ],
    [['sate', null, 'sate']],
    [['ketupat', 'nasi-goreng', 'manggis']],
    [['rambutan', 'ketupat', 'ketupat']],
    [[null, 'ketupat', 'ketupat']],
    [
      ['nasi-goreng', 'rambutan', 'rambutan'],
      ['nasi-goreng', 'rambutan', 'manggis'],
    ],
  ],
};
