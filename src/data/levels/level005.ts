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
      [null, 'rambutan', 'manggis'],
      ['manggis', 'rambutan', 'nasi-goreng'],
    ],
    [['ketupat', null, 'nasi-goreng']],
    [['manggis', 'ketupat', 'sate']],
    [
      [null, 'rambutan', 'nasi-goreng'],
      ['nasi-goreng', 'nasi-goreng', 'rambutan'],
    ],
    [['manggis', 'ketupat', 'manggis']],
    [
      ['manggis', 'ketupat', 'sate'],
      ['ketupat', 'nasi-goreng', 'rambutan'],
    ],
    [['rambutan', 'ketupat', 'sate']],
  ],
};
