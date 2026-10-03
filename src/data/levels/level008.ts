import type { LevelDefinition } from '../../core';

/** Conveyor demo: a slow belt of 8 slots carrying 6 items. */
export const level008: LevelDefinition = {
  id: 'level008',
  timeLimitSeconds: 100,
  mechanics: [
    {
      kind: 'conveyor',
      // Tuning: speed is in belt slots per second; K is the length of `slots` (add or remove nulls).
      // In dev builds, ?beltSpeed=1.2&beltSlots=10 overrides both without editing this file.
      speed: 0.4,
      slots: [null, 'banana', 'lime', 'banana', 'banana', null, 'apple', 'grape'],
    },
  ],
  shelves: [
    [
      [null, 'grape', 'grape'],
      ['lime', 'apple', 'banana'],
    ],
    [[null, 'lime', 'banana']],
    [
      ['lime', null, 'grape'],
      ['apple', 'lime', 'grape'],
    ],
    [['apple', 'grape', null]],
    [[null, 'lime', 'apple']],
    [[null, 'apple', 'banana']],
  ],
};
