import type { LevelDefinition } from '../../../src/core';

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
    [['manggis', null, 'sate']],
    [['ketupat', 'manggis', 'ketupat']],
    [
      ['manggis', null, 'ketupat'],
      ['rambutan', 'ketupat', 'rambutan'],
    ],
    [
      ['manggis', 'sate', 'rambutan'],
      ['nasi-goreng', 'rambutan', 'rambutan'],
      ['manggis', 'sate', 'rambutan'],
    ],
    [
      ['nasi-goreng', 'sate', 'nasi-goreng'],
      ['nasi-goreng', 'sate', 'rambutan'],
    ],
    [[null, 'nasi-goreng', 'sate']],
    [['manggis', 'ketupat', 'rambutan']],
    [['ketupat', 'nasi-goreng', 'rambutan']],
  ],
};
