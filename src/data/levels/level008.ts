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
      slots: [null, 'nasi-goreng', 'ketupat', 'nasi-goreng', 'nasi-goreng', null, 'rambutan', 'manggis'],
    },
  ],
  shelves: [
    [
      [null, 'manggis', 'manggis'],
      ['ketupat', 'rambutan', 'nasi-goreng'],
    ],
    [[null, 'ketupat', 'nasi-goreng']],
    [
      ['ketupat', null, 'manggis'],
      ['rambutan', 'ketupat', 'manggis'],
    ],
    [['rambutan', 'manggis', null]],
    [[null, 'ketupat', 'rambutan']],
    [[null, 'rambutan', 'nasi-goreng']],
  ],
};
