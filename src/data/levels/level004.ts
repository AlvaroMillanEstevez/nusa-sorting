import type { LevelDefinition } from '../../core';

/** Combo demo: triples cleared within 5 s of each other chain into a score multiplier. */
export const level004: LevelDefinition = {
  id: 'level004',
  timeLimitSeconds: 100,
  mechanics: [
    { kind: 'combo', windowSeconds: 5, pointsPerTriple: 100, multipliers: [1, 1.5, 2, 2.5, 3, 4, 5] },
  ],
  shelves: [
    [['blueberry', 'grape', 'lime']],
    [
      [null, null, 'apple'],
      ['grape', 'lime', 'banana'],
    ],
    [['banana', 'banana', 'apple']],
    [
      ['banana', null, null],
      ['banana', 'apple', 'grape'],
    ],
    [[null, 'banana', 'grape']],
    [
      ['blueberry', 'grape', 'apple'],
      ['lime', 'grape', 'apple'],
    ],
    [[null, 'apple', 'blueberry']],
  ],
};
