import type { LevelDefinition } from '../../../src/core';

/**
 * Closing shelves demo: six shelves, two of which (1 and 4) close for good once emptied. Emptying them early
 * gives up their slots, so the player has to decide when to clear them.
 */
export const level016: LevelDefinition = {
  id: 'level016',
  timeLimitSeconds: 120,
  mechanics: [{ kind: 'closingShelves', shelves: [1, 4] }],
  shelves: [
    [
      ['rambutan', null, 'onde-onde'],
      ['ketupat', 'rambutan', 'durian'],
    ],
    [['es-teh-manis', 'es-teh-manis', 'ketupat']],
    [
      ['bakso', null, null],
      ['onde-onde', 'durian', 'onde-onde'],
    ],
    [
      ['bakso', null, 'manggis'],
      ['manggis', 'es-teh-manis', 'ketupat'],
    ],
    [['manggis', 'sate', 'sate']],
    [
      [null, 'rambutan', 'bakso'],
      ['durian', 'sate', null],
    ],
  ],
};
