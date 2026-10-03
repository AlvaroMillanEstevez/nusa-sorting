import type { LevelDefinition } from '../../core';

/** Locked shelves demo: two full shelves open after 2 and 4 triples. */
export const level005: LevelDefinition = {
  id: 'level005',
  timeLimitSeconds: 120,
  mechanics: [
    {
      kind: 'lockedShelves',
      shelves: [{ shelf: 5, triplesRequired: 2 }, { shelf: 6, triplesRequired: 4 }],
    },
  ],
  shelves: [
    [
      ['apple', 'apple', 'grape'],
      ['grape', 'apple', 'banana'],
    ],
    [['lime', null, 'banana']],
    [['grape', 'lime', 'blueberry']],
    [
      [null, null, 'banana'],
      ['banana', 'banana', 'apple'],
    ],
    [['grape', 'lime', 'grape']],
    [
      ['grape', 'lime', 'blueberry'],
      ['lime', 'banana', 'apple'],
    ],
    [['apple', 'lime', 'blueberry']],
  ],
};
