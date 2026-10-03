import type { LevelDefinition } from '../../core';

/** Second level: 7 shelves, 5 item types, only two free slots. */
export const level002: LevelDefinition = {
  id: 'level002',
  timeLimitSeconds: 100,
  shelves: [
    [['lime', 'apple', 'lime']],
    [
      ['banana', 'grape', null],
      ['lime', 'grape', 'grape'],
    ],
    [['blueberry', 'lime', 'apple']],
    [
      ['lime', 'banana', 'blueberry'],
      ['banana', 'grape', 'blueberry'],
    ],
    [['banana', 'banana', 'apple']],
    [
      ['lime', 'apple', 'grape'],
      [null, 'grape', 'apple'],
    ],
    [['apple', 'banana', null]],
  ],
};
