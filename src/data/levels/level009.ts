import type { LevelDefinition } from '../../core';

/** Faster conveyor with a locked shelf and little free space: the belt keeps feeding a tight board. */
export const level009: LevelDefinition = {
  id: 'level009',
  timeLimitSeconds: 110,
  mechanics: [
    {
      kind: 'lockedShelves',
      shelves: [{ shelf: 1, triplesRequired: 2 }],
    },
    {
      kind: 'conveyor',
      // Tuning: speed is in belt slots per second; K is the length of `slots` (add or remove nulls).
      // In dev builds, ?beltSpeed=1.2&beltSlots=10 overrides both without editing this file.
      speed: 1,
      slots: ['nasi-goreng', 'sate', null, 'rambutan', 'ketupat', 'manggis', null, 'rambutan'],
    },
  ],
  shelves: [
    [['rambutan', null, 'nasi-goreng']],
    [['manggis', 'ketupat', 'manggis']],
    [
      ['ketupat', 'manggis', null],
      ['ketupat', 'nasi-goreng', 'rambutan'],
    ],
    [
      [null, 'manggis', 'sate'],
      ['ketupat', 'rambutan', 'nasi-goreng'],
    ],
    [['nasi-goreng', 'sate', 'sate']],
    [['sate', 'manggis', 'ketupat']],
    [['rambutan', 'sate', 'nasi-goreng']],
  ],
};
