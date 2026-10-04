import type { LevelDefinition } from '../../../src/core';

/** Combo demo: triples cleared within 5 s of each other chain into a score multiplier. */
export const level004: LevelDefinition = {
  id: 'level004',
  timeLimitSeconds: 100,
  mechanics: [
    { kind: 'combo', windowSeconds: 5, pointsPerTriple: 100, multipliers: [1, 1.5, 2, 2.5, 3, 4, 5] },
  ],
  shelves: [
    [['sate', 'manggis', 'ketupat']],
    [
      [null, null, 'rambutan'],
      ['manggis', 'ketupat', 'nasi-goreng'],
    ],
    [['nasi-goreng', 'nasi-goreng', 'rambutan']],
    [
      ['nasi-goreng', null, null],
      ['nasi-goreng', 'rambutan', 'manggis'],
    ],
    [[null, 'nasi-goreng', 'manggis']],
    [
      ['sate', 'manggis', 'rambutan'],
      ['ketupat', 'manggis', 'rambutan'],
    ],
    [[null, 'rambutan', 'sate']],
  ],
};
