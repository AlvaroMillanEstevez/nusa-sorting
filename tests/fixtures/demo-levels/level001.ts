import type { LevelDefinition } from '../../../src/core';

/** First level: 6 shelves, 4 item types, plenty of free space. */
export const level001: LevelDefinition = {
  id: 'level001',
  timeLimitSeconds: 90,
  shelves: [
    [
      ['rambutan', null, 'ketupat'],
      ['manggis', 'rambutan', 'manggis'],
    ],
    [['manggis', null, 'nasi-goreng']],
    [['ketupat', null, 'rambutan']],
    [['ketupat', 'rambutan', null]],
    [['rambutan', null, 'rambutan']],
    [['nasi-goreng', null, 'nasi-goreng']],
  ],
};
