import type { LevelDefinition } from '../../core';

/** Third level: 8 shelves, 5 item types, two free slots and two-deep back layers. */
export const level003: LevelDefinition = {
  id: 'level003',
  timeLimitSeconds: 120,
  shelves: [
    [['banana', 'grape', 'apple']],
    [
      ['lime', 'grape', 'lime'],
      ['lime', 'blueberry', 'banana'],
    ],
    [
      ['apple', 'banana', 'apple'],
      ['banana', 'apple', 'grape'],
      ['grape', 'lime', 'banana'],
    ],
    [['apple', 'banana', 'lime']],
    [['apple', 'apple', 'banana']],
    [['blueberry', 'blueberry', 'grape']],
    [
      ['grape', null, 'blueberry'],
      ['apple', 'banana', 'blueberry'],
      ['banana', 'apple', null],
    ],
    [['blueberry', null, 'lime']],
  ],
};
