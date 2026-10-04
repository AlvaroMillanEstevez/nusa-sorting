import type { LevelDefinition } from '../../core';

/** Third level: 8 shelves, 5 item types, two free slots and two-deep back layers. */
export const level003: LevelDefinition = {
  id: 'level003',
  timeLimitSeconds: 120,
  shelves: [
    [['nasi-goreng', 'manggis', 'rambutan']],
    [
      ['ketupat', 'manggis', 'ketupat'],
      ['ketupat', 'sate', 'nasi-goreng'],
    ],
    [
      ['rambutan', 'nasi-goreng', 'rambutan'],
      ['nasi-goreng', 'rambutan', 'manggis'],
      ['manggis', 'ketupat', 'nasi-goreng'],
    ],
    [['rambutan', 'nasi-goreng', 'ketupat']],
    [['rambutan', 'rambutan', 'nasi-goreng']],
    [['sate', 'sate', 'manggis']],
    [
      ['manggis', null, 'sate'],
      ['rambutan', 'nasi-goreng', 'sate'],
      ['nasi-goreng', 'rambutan', null],
    ],
    [['sate', null, 'ketupat']],
  ],
};
