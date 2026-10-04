import type { LevelDefinition } from '../../../src/core';

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
      ['rambutan', 'nasi-goreng', 'manggis'],
      ['rambutan', 'rambutan', 'manggis'],
    ],
    [['manggis', 'ketupat', 'nasi-goreng']],
    [['nasi-goreng', 'manggis', 'ketupat']],
    [['nasi-goreng', null, 'rambutan']],
    [
      ['manggis', null, 'nasi-goreng'],
      ['rambutan', 'ketupat', 'nasi-goreng'],
    ],
    [['ketupat', null, 'manggis']],
    [
      ['sate', 'ketupat', 'sate'],
      ['ketupat', 'rambutan', 'sate'],
    ],
  ],
};
