import type { LevelDefinition } from '../../core';

/** First prototype level: 7 shelves, 5 item types, two shelves with a back layer. */
export const level001: LevelDefinition = {
  id: 'level001',
  shelves: [
    [
      ['apple', 'banana', 'grape'],
      ['lime', 'lime', 'blueberry'],
    ],
    [['banana', 'apple', null]],
    [
      ['grape', null, 'apple'],
      ['apple', 'blueberry', 'grape'],
    ],
    [['lime', 'banana', null]],
    [['grape', null, 'blueberry']],
    [['apple', 'grape', null]],
    [['apple', 'grape', null]],
  ],
};
