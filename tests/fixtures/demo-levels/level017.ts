import type { LevelDefinition } from '../../../src/core';

/**
 * Both new mechanics with a moving belt: a column of shelves (two of them close once emptied), a column of fixed
 * stacks, and a slow belt of stacks running down.
 */
export const level017: LevelDefinition = {
  id: 'level017',
  timeLimitSeconds: 170,
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2, 3, 4] },
      { kind: 'track', track: 0 },
      { kind: 'track', track: 1 },
    ],
  },
  mechanics: [
    { kind: 'closingShelves', shelves: [1, 3] },
    {
      kind: 'tracks',
      tracks: [
        {
          orientation: 'vertical',
          speed: 0,
          carriers: [
            ['es-teh-manis', 'sate', 'onde-onde', 'rambutan'],
            ['sate', 'manggis'],
            ['bakso', 'ketupat', 'es-teh-manis', 'bakso'],
          ],
        },
        {
          orientation: 'vertical',
          speed: 0.3,
          carriers: [['sate'], ['bakso'], [], ['es-teh-manis'], ['rambutan'], []],
        },
      ],
    },
  ],
  shelves: [
    [
      ['manggis', null, null],
      ['onde-onde', 'ketupat', null],
    ],
    [['durian', 'durian', 'rambutan']],
    [
      [null, 'ketupat', null],
      ['manggis', null, null],
    ],
    [['onde-onde', 'durian', null]],
    [[null, null, null]],
  ],
};
