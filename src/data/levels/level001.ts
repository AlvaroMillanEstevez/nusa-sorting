import type { LevelDefinition } from '../../core';

/** First level: 6 shelves, 4 item types, plenty of free space. */
export const level001: LevelDefinition = {
  id: 'level001',
  timeLimitSeconds: 90,
  shelves: [
    [
      ['apple', null, 'lime'],
      ['grape', 'apple', 'grape'],
    ],
    [['grape', null, 'banana']],
    [['lime', null, 'apple']],
    [['lime', 'apple', null]],
    [['apple', null, 'apple']],
    [['banana', null, 'banana']],
  ],
};
