import type { LevelRecipe } from './recipe';

/**
 * Levels 1-10. A sawtooth: after a level with something new or demanding comes a slightly easier one. Levels
 * 5 and 10 are special levels, their twist made from existing mechanics only (themes still to be decided).
 *
 * Every level holds exactly one triple of each of its types, taken in the generator's type order (types.ts):
 * the starter kinds, then the rest of the catalogue keeping look-alikes apart, then colour variants. So the
 * number of types is the number of items over three, and new kinds appear as levels grow.
 *
 * Win bands are for the simulated casual player (tools/simulator.ts), not real people. That player rarely runs
 * out of space on shelves alone, so on the harder levels the clock does much of the work: `time.slack` below 1
 * lets the limit cut into its slower wins. Its time per move grows with the number of types.
 */

/** Combo multipliers doubled (special level 5). */
const DOUBLE_COMBO = [2, 3, 4, 5, 6, 8, 10];

export const RECIPES: readonly LevelRecipe[] = [
  {
    number: 1,
    id: 'nusa-001',
    purpose: 'First level: very simple and obvious. Few empty slots, six kinds, nothing hidden.',
    seed: 101,
    layout: 'grid',
    shelves: 7,
    types: 6,
    backLayers: { shelves: 0, layers: [1, 1] },
    emptyFront: 3,
    maxDepth: 0,
    minStartTriples: 6,
    winBand: [0.97, 1],
    time: { slack: 2, timeUp: [0, 0] },
  },
  {
    number: 2,
    id: 'nusa-002',
    purpose: 'More shelves and items in two columns; items behind the front ones appear.',
    seed: 202,
    layout: [
      { kind: 'shelves', count: 4 },
      { kind: 'shelves', count: 4 },
    ],
    types: 9,
    backLayers: { shelves: 3, layers: [2, 2] },
    emptyFront: 4,
    maxDepth: 1,
    minStartTriples: 3,
    winBand: [0.88, 0.98],
    time: { slack: 1, timeUp: [0, 0.12] },
  },
  {
    number: 3,
    id: 'nusa-003',
    purpose: 'Three columns and the first locked shelf.',
    seed: 303,
    layout: [
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 3 },
    ],
    types: 10,
    backLayers: { shelves: 3, layers: [2, 2] },
    emptyFront: 5,
    locked: [2],
    maxDepth: 1,
    minStartTriples: 2,
    winBand: [0.78, 0.92],
    time: { slack: 0.85, timeUp: [0.05, 0.22] },
  },
  {
    number: 4,
    id: 'nusa-004',
    purpose: 'Locked shelves get demanding: two of them, one needing four triples.',
    seed: 404,
    layout: [
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 2 },
      { kind: 'shelves', count: 3 },
    ],
    types: 12,
    backLayers: { shelves: 4, layers: [2, 3] },
    emptyFront: 5,
    locked: [2, 4],
    maxDepth: 2,
    minStartTriples: 2,
    winBand: [0.6, 0.76],
    time: { slack: 0.6, timeUp: [0.15, 0.4] },
  },
  {
    number: 5,
    id: 'nusa-005',
    purpose: 'Special level: against the clock, with combo multipliers doubled.',
    seed: 505,
    theme: 'rush',
    layout: [
      { kind: 'shelves', count: 2 },
      { kind: 'shelves', count: 2 },
      { kind: 'shelves', count: 2 },
    ],
    types: 7,
    backLayers: { shelves: 3, layers: [2, 2] },
    emptyFront: 5,
    comboMultipliers: DOUBLE_COMBO,
    maxDepth: 1,
    minStartTriples: 3,
    winBand: [0.45, 0.65],
    time: { slack: 0, timeUp: [0.3, 0.55] },
  },
  {
    number: 6,
    id: 'nusa-006',
    purpose: 'One new kind, on an easier board after the special level.',
    seed: 606,
    layout: [
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 3 },
    ],
    types: 13,
    backLayers: { shelves: 5, layers: [2, 2] },
    emptyFront: 3,
    locked: [1],
    maxDepth: 1,
    minStartTriples: 3,
    winBand: [0.78, 0.92],
    time: { slack: 0.85, timeUp: [0.05, 0.22] },
  },
  {
    number: 7,
    id: 'nusa-007',
    purpose: 'More shelves and deeper layers.',
    seed: 707,
    layout: [
      { kind: 'shelves', count: 4 },
      { kind: 'shelves', count: 3 },
      { kind: 'shelves', count: 4 },
    ],
    types: 15,
    backLayers: { shelves: 6, layers: [2, 3] },
    emptyFront: 7,
    locked: [3],
    maxDepth: 2,
    minStartTriples: 3,
    winBand: [0.6, 0.76],
    time: { slack: 0.6, timeUp: [0.15, 0.4] },
  },
  {
    number: 8,
    id: 'nusa-008',
    purpose: 'A slow belt of stacks, on an easier board since the belt is new.',
    seed: 808,
    layout: 'grid',
    shelves: 7,
    belt: { speed: 0.35, carriers: 7 },
    stacks: { depth: [1, 2], empty: 2 },
    types: 10,
    backLayers: { shelves: 2, layers: [2, 2] },
    emptyFront: 4,
    maxDepth: 1,
    minStartTriples: 3,
    winBand: [0.75, 0.9],
    time: { slack: 0.9, timeUp: [0, 0.2] },
  },
  {
    number: 9,
    id: 'nusa-009',
    purpose: 'A vertical belt between two columns of shelves, faster and with deeper stacks.',
    seed: 909,
    layout: [
      { kind: 'shelves', count: 3 },
      { kind: 'track', speed: 0.6, carriers: 5 },
      { kind: 'shelves', count: 3 },
    ],
    stacks: { depth: [1, 3], empty: 1 },
    types: 10,
    backLayers: { shelves: 3, layers: [2, 2] },
    emptyFront: 4,
    locked: [2],
    maxDepth: 2,
    minStartTriples: 3,
    winBand: [0.6, 0.76],
    time: { slack: 0.8, timeUp: [0, 0.3] },
  },
  {
    number: 10,
    id: 'nusa-010',
    purpose: 'Special level: two fast belts full of stacks around a column of shelves.',
    seed: 1010,
    theme: 'belts',
    layout: [
      { kind: 'track', speed: 0.8, carriers: 5 },
      { kind: 'shelves', count: 4 },
      { kind: 'track', speed: -0.8, carriers: 5 },
    ],
    stacks: { depth: [2, 2], empty: 1 },
    types: 8,
    backLayers: { shelves: 1, layers: [2, 2] },
    emptyFront: 7,
    maxDepth: 2,
    minStartTriples: 3,
    winBand: [0.45, 0.65],
    time: { slack: 1, timeUp: [0, 0.2] },
  },
];

export function recipeFor(numberOrId: number | string): LevelRecipe {
  const recipe = RECIPES.find((r) => r.number === numberOrId || r.id === numberOrId);
  if (!recipe) throw new Error(`no recipe for level ${numberOrId}`);
  return recipe;
}
