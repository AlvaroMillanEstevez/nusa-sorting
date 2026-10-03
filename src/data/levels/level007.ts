import type { LevelDefinition } from '../../core';

/** Both obstacles: two locked shelves (2 and 5 triples) and a roaming blocker that a combo of 5 removes. */
export const level007: LevelDefinition = {
  id: 'level007',
  timeLimitSeconds: 150,
  mechanics: [
    { kind: 'combo', windowSeconds: 5, pointsPerTriple: 100, multipliers: [1, 1.5, 2, 2.5, 3, 4, 5] },
    {
      kind: 'lockedShelves',
      shelves: [{ shelf: 4, triplesRequired: 2 }, { shelf: 3, triplesRequired: 5 }],
    },
    { kind: 'roamingBlocker', start: { shelf: 2, slot: 1 }, seed: 537886, removeAtCombo: 5 },
  ],
  shelves: [
    [['grape', null, 'blueberry']],
    [['lime', 'grape', 'lime']],
    [
      ['grape', null, 'lime'],
      ['apple', 'lime', 'apple'],
    ],
    [
      ['grape', 'blueberry', 'apple'],
      ['banana', 'apple', 'apple'],
      ['grape', 'blueberry', 'apple'],
    ],
    [
      ['banana', 'blueberry', 'banana'],
      ['banana', 'blueberry', 'apple'],
    ],
    [[null, 'banana', 'blueberry']],
    [['grape', 'lime', 'apple']],
    [['lime', 'banana', 'apple']],
  ],
};
