import type { LevelDefinition } from '../../core';

/** Second level: 7 shelves, 5 item types, only two free slots. */
export const level002: LevelDefinition = {
  id: 'level002',
  timeLimitSeconds: 100,
  shelves: [
    [['ketupat', 'rambutan', 'ketupat']],
    [
      ['nasi-goreng', 'manggis', null],
      ['ketupat', 'manggis', 'manggis'],
    ],
    [['sate', 'ketupat', 'rambutan']],
    [
      ['ketupat', 'nasi-goreng', 'sate'],
      ['nasi-goreng', 'manggis', 'sate'],
    ],
    [['nasi-goreng', 'nasi-goreng', 'rambutan']],
    [
      ['ketupat', 'rambutan', 'manggis'],
      [null, 'manggis', 'rambutan'],
    ],
    [['rambutan', 'nasi-goreng', null]],
  ],
};
