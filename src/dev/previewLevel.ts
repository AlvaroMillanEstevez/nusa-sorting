import type { LevelDefinition } from '../core';

/**
 * Development only (?preview): a small board for the store preview video. It shows in a few seconds what sets the
 * game apart: triples one after another (combos), a fresh rambutan made into its triple in time (its price tag,
 * then the bonus), a fresh prawn cracker whose copies are buried too deep to save (it spoils, flies and all, and is
 * cleared spoiled later), a belt to pick from and two shelves that close once emptied. Never part of the game: the
 * preview mode plays it in place of the level it stands for, so the win goes on to the real map.
 */
export const PREVIEW_LEVEL_NUMBER = 33;

export const previewLevel: LevelDefinition = {
  id: 'preview-showcase',
  timeLimitSeconds: 90,
  layout: {
    columns: [
      { kind: 'shelves', shelves: [0, 1, 2] },
      { kind: 'track', track: 0 },
      { kind: 'shelves', shelves: [3, 4, 5] },
    ],
  },
  mechanics: [
    { kind: 'closingShelves', shelves: [2, 5] },
    {
      kind: 'tracks',
      tracks: [
        {
          orientation: 'vertical',
          speed: 0.6,
          carriers: [['sate'], ['nasi-goreng', 'klepon'], ['wayang-kulit'], ['layangan', 'wayang-kulit'], ['kerupuk-udang', 'klepon'], []],
        },
      ],
    },
    {
      kind: 'fresh',
      foods: [
        { type: 'rambutan', moves: 9 },
        { type: 'kerupuk-udang', moves: 3 },
      ],
    },
  ],
  shelves: [
    [['sate', 'sate', null]],
    [
      ['ketupat', 'ketupat', 'rambutan'],
      ['klepon', 'kerupuk-udang', null],
    ],
    [['es-teh-manis', 'layangan', null]],
    [['rambutan', 'rambutan', null]],
    [
      ['nasi-goreng', 'nasi-goreng', 'ketupat'],
      ['layangan', 'wayang-kulit', 'kerupuk-udang'],
    ],
    [['es-teh-manis', 'es-teh-manis', null]],
  ],
};
