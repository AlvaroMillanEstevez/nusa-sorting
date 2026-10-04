import type { LevelDefinition } from '../../core';

/** Two vertical conveyors around one column of shelves: the left runs up, the right runs down. */
export const level011: LevelDefinition = {
  id: 'level011',
  timeLimitSeconds: 100,
  layout: {
    columns: [
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'track', track: 1 },
    ],
  },
  mechanics: [
    {
      kind: 'tracks',
      // Speed in carriers per second: negative runs up, positive runs down. Each carrier is a stack, top first.
      tracks: [
        {
          orientation: 'vertical',
          speed: -0.4,
          carriers: [['grape'], [], ['lime', 'lime'], ['banana'], ['grape'], []],
        },
        {
          orientation: 'vertical',
          speed: 0.4,
          carriers: [['banana'], ['apple'], [], ['apple', 'banana'], [], ['apple']],
        },
      ],
    },
  ],
  shelves: [
    [
      [null, 'apple', null],
      ['apple', 'banana', 'banana'],
    ],
    [['apple', 'lime', 'grape']],
    [[null, 'banana', null]],
  ],
};
