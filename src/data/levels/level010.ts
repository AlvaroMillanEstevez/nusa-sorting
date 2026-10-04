import type { LevelDefinition } from '../../core';

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
          carriers: [['apple'], [], ['lime', 'banana'], ['apple', 'banana'], [], ['apple']],
        },
      ],
    },
  ],
  shelves: [
    [
      ['apple', null, 'grape'],
      ['apple', 'grape', 'banana'],
    ],
    [
      ['grape', 'banana', 'lime'],
      ['banana', 'lime', 'grape'],
    ],
    [['banana', null, null]],
    [[null, 'lime', 'lime']],
    [[null, 'grape', 'lime']],
    [[null, 'grape', 'apple']],
  ],
};
