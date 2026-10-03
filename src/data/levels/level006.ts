import type { LevelDefinition } from '../../core';

/** Roaming blocker demo: a blocked slot hops after every triple; a combo of 4 removes it. */
export const level006: LevelDefinition = {
  id: 'level006',
  timeLimitSeconds: 120,
  mechanics: [
    { kind: 'combo', windowSeconds: 5, pointsPerTriple: 100, multipliers: [1, 1.5, 2, 2.5, 3, 4, 5] },
    { kind: 'roamingBlocker', start: { shelf: 4, slot: 1 }, seed: 958115, removeAtCombo: 4 },
  ],
  shelves: [
    [
      ['apple', 'banana', 'grape'],
      ['apple', 'apple', 'grape'],
    ],
    [['grape', 'lime', 'banana']],
    [['banana', 'grape', 'lime']],
    [['banana', 'banana', 'apple']],
    [
      ['grape', null, null],
      ['apple', 'lime', 'banana'],
    ],
    [['lime', null, 'grape']],
    [
      ['blueberry', 'lime', 'blueberry'],
      ['lime', 'apple', 'blueberry'],
    ],
  ],
};
