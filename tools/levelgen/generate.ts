import {
  COMBO_DEFAULTS,
  createGame,
  LevelError,
  startTriples,
  trapWithin,
  tripleDepthIssues,
  type ColumnDefinition,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type TrackDefinition,
} from '../../src/core';
import { itemSize, layoutForLevel, validateLevelLayout } from '../../src/ui/levelLayout';
import { playMany, rng, simulate, solve, type SimulationStats } from '../simulator';
import type { LevelRecipe } from './recipe';

/** Simulated games while searching, and for the final figures. */
const SEARCH_RUNS = 100;
export const REPORT_RUNS = 200;
/** Time limits are whole multiples of this many seconds. */
const TIME_STEP = 5;
const MIN_TIME = 30;

export interface GeneratedLevel {
  readonly level: LevelDefinition;
  readonly recipe: LevelRecipe;
  readonly seed: number;
  /** Which candidate of the seed's sequence passed. */
  readonly attempt: number;
  readonly stats: SimulationStats;
  /** Item size in px on a phone in portrait and in landscape. */
  readonly itemPx: { readonly portrait: number; readonly landscape: number };
}

type Random = () => number;

function shuffle<T>(random: Random, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/** `count` distinct indices from 0..n-1. */
function choose(random: Random, n: number, count: number): number[] {
  return shuffle(
    random,
    Array.from({ length: n }, (_, i) => i),
  ).slice(0, count);
}

const intIn = (random: Random, [min, max]: readonly [number, number]) => min + Math.floor(random() * (max - min + 1));

interface Plan {
  readonly shelfCount: number;
  readonly columns: ColumnDefinition[] | undefined;
  readonly tracks: { orientation: 'horizontal' | 'vertical'; speed: number; carriers: number }[];
}

/** Shelves, tracks and columns from the recipe's layout. */
function plan(recipe: LevelRecipe): Plan {
  if (recipe.layout === 'grid') {
    if (!recipe.shelves) throw new Error(`${recipe.id}: a grid layout needs a shelf count`);
    const tracks = recipe.belt ? [{ orientation: 'horizontal' as const, ...recipe.belt }] : [];
    return { shelfCount: recipe.shelves, columns: undefined, tracks };
  }
  let shelfCount = 0;
  const tracks: Plan['tracks'] = [];
  const columns = recipe.layout.map((column): ColumnDefinition => {
    if (column.kind === 'shelves') {
      const shelves = Array.from({ length: column.count }, (_, i) => shelfCount + i);
      shelfCount += column.count;
      return { kind: 'shelves', shelves };
    }
    tracks.push({ orientation: 'vertical', speed: column.speed, carriers: column.carriers });
    return { kind: 'track', track: tracks.length - 1 };
  });
  return { shelfCount, columns, tracks };
}

/** Where an item can go: a shelf slot or a place in a track stack. */
type Place = { kind: 'shelf'; shelf: number; layer: number; slot: number } | { kind: 'stack'; track: number; carrier: number; depth: number };

/**
 * One random board for the recipe, without a time limit: shelves with their layers, empty front slots, stacks on
 * the tracks, locks, and every kind in a whole number of triples spread over all of it. Null if the numbers do
 * not work out (e.g. fewer triples than kinds).
 */
export function buildCandidate(recipe: LevelRecipe, random: Random): LevelDefinition | null {
  const { shelfCount, columns, tracks } = plan(recipe);
  const layerCounts = Array<number>(shelfCount).fill(1);
  for (const shelf of choose(random, shelfCount, recipe.backLayers.shelves)) layerCounts[shelf] = intIn(random, recipe.backLayers.layers);

  const places: Place[] = [];
  layerCounts.forEach((layers, shelf) => {
    for (let layer = 0; layer < layers; layer++) for (let slot = 0; slot < 3; slot++) places.push({ kind: 'shelf', shelf, layer, slot });
  });
  tracks.forEach((track, t) => {
    const stacks = recipe.stacks ?? { depth: [1, 1] as const, empty: 0 };
    const empty = new Set(choose(random, track.carriers, stacks.empty));
    for (let carrier = 0; carrier < track.carriers; carrier++) {
      if (empty.has(carrier)) continue;
      const depth = intIn(random, stacks.depth);
      for (let d = 0; d < depth; d++) places.push({ kind: 'stack', track: t, carrier, depth: d });
    }
  });

  // Empty front slots; then, to make the item count a multiple of three, a few more empty back slots.
  const fronts = places.filter((p) => p.kind === 'shelf' && p.layer === 0);
  const empty = new Set<Place>(shuffle(random, fronts).slice(0, recipe.emptyFront));
  const backs = shuffle(
    random,
    places.filter((p) => p.kind === 'shelf' && p.layer > 0),
  );
  let filled = places.length - empty.size;
  for (const back of backs) {
    if (filled % 3 === 0) break;
    empty.add(back);
    filled--;
  }
  if (filled % 3 !== 0) return null;

  const triples = filled / 3;
  const kinds = recipe.kinds;
  if (triples < kinds.length) return null;
  const perKind = kinds.map(() => Math.floor(triples / kinds.length));
  for (const k of choose(random, kinds.length, triples % kinds.length)) perKind[k]!++;
  const items = shuffle(
    random,
    kinds.flatMap((kind, k) => Array<string>(perKind[k]! * 3).fill(kind)),
  );

  const shelves = layerCounts.map((layers) => Array.from({ length: layers }, () => Array<string | null>(3).fill(null)));
  const stacks = tracks.map((track) => Array.from({ length: track.carriers }, () => [] as string[]));
  let next = 0;
  for (const place of places) {
    if (empty.has(place)) continue;
    const item = items[next++]!;
    if (place.kind === 'shelf') shelves[place.shelf]![place.layer]![place.slot] = item;
    else stacks[place.track]![place.carrier]!.push(item);
  }

  const mechanics: MechanicDefinition[] = [];
  if (recipe.comboMultipliers) {
    mechanics.push({ kind: 'combo', windowSeconds: COMBO_DEFAULTS.windowSeconds, multipliers: recipe.comboMultipliers });
  }
  if (recipe.locked && recipe.locked.length > 0) {
    const lockedShelves = choose(random, shelfCount, recipe.locked.length);
    mechanics.push({
      kind: 'lockedShelves',
      shelves: lockedShelves.map((shelf, i) => ({ shelf, triplesRequired: recipe.locked![i]! })),
    });
  }
  if (tracks.length > 0) {
    mechanics.push({
      kind: 'tracks',
      tracks: tracks.map((track, t): TrackDefinition => ({ orientation: track.orientation, speed: track.speed, carriers: stacks[t]! })),
    });
  }
  return {
    id: recipe.id,
    shelves,
    ...(mechanics.length > 0 ? { mechanics } : {}),
    ...(columns ? { layout: { columns } } : {}),
    ...(recipe.theme ? { theme: recipe.theme } : {}),
  };
}

/**
 * The rules every generated level must meet, as a list of failures (empty when it passes): a valid level whose
 * items are big enough on a phone; no layer that starts as a triple; no defeat within the first two moves; no
 * triple buried deeper than the recipe allows; enough triples in reach at the start; solvable even without
 * combos.
 */
export function ruleFailures(level: LevelDefinition, recipe: Pick<LevelRecipe, 'maxDepth' | 'minStartTriples'>): string[] {
  let state: GameState;
  try {
    state = createGame(level);
    validateLevelLayout(level);
  } catch (error) {
    if (error instanceof LevelError || error instanceof Error) return [error.message];
    throw error;
  }
  const failures: string[] = [];
  // A back layer of three alike would clear by itself as it comes forward: a gift, not a puzzle.
  const readyTriples = level.shelves.flatMap((layers, s) =>
    layers.flatMap((layer, l) => (layer[0] && layer.every((type) => type === layer[0]) ? [`shelf ${s} layer ${l}`] : [])),
  );
  if (readyTriples.length > 0) failures.push(`layers that start as a triple: ${readyTriples.join(', ')}`);
  if (trapWithin(state, 2)) failures.push('a sequence of one or two moves loses by running out of space');
  const deep = tripleDepthIssues(state, recipe.maxDepth);
  if (deep.length > 0) failures.push(`triples buried too deep: ${deep.map((d) => `${d.type} #${d.triple + 1}`).join(', ')}`);
  const reachable = startTriples(state);
  if (reachable < recipe.minStartTriples) failures.push(`only ${reachable} triple(s) in reach at the start`);
  if (failures.length === 0 && !solve(state)) failures.push('no solution found');
  return failures;
}

const roundUp = (seconds: number) => Math.max(MIN_TIME, Math.ceil(seconds / TIME_STEP) * TIME_STEP);

const inRange = (value: number, [min, max]: readonly [number, number]) => value >= min - 1e-9 && value <= max + 1e-9;

/**
 * A time limit for a board that puts the simulated win rate in the recipe's band, or null if none does. Starts
 * from what untimed games predict, then checks with timed games around it.
 */
function chooseTime(level: LevelDefinition, recipe: LevelRecipe): { seconds: number; stats: SimulationStats } | null {
  const untimed = playMany(createGame(level), SEARCH_RUNS, 1);
  const winTimes = untimed
    .filter((o) => o.won)
    .map((o) => o.seconds)
    .sort((a, b) => a - b);
  if (winTimes.length / SEARCH_RUNS < recipe.winBand[0]) return null;
  const p90 = winTimes[Math.floor(winTimes.length * 0.9)] ?? winTimes.at(-1)!;
  const floor = roundUp(recipe.time.slack * p90);
  const target = (recipe.winBand[0] + recipe.winBand[1]) / 2;
  // Predicted win rate for a limit: untimed wins that finish in time.
  const predicted = (limit: number) => winTimes.filter((s) => s <= limit).length / SEARCH_RUNS;
  let best = floor;
  for (let limit = floor; limit <= roundUp(winTimes.at(-1)!) + TIME_STEP; limit += TIME_STEP) {
    if (Math.abs(predicted(limit) - target) < Math.abs(predicted(best) - target)) best = limit;
  }
  for (const delta of [0, TIME_STEP, -TIME_STEP, 2 * TIME_STEP, -2 * TIME_STEP]) {
    const seconds = best + delta;
    if (seconds < floor) continue;
    const stats = simulate(createGame({ ...level, timeLimitSeconds: seconds }), SEARCH_RUNS, 1);
    if (inRange(stats.winRate, recipe.winBand) && inRange(stats.timeUpRate, recipe.time.timeUp)) return { seconds, stats };
  }
  return null;
}

/** The seed of a candidate: the recipe's seed and the attempt number, mixed. */
const candidateSeed = (seed: number, attempt: number) => (Math.imul(seed, 1_000_003) + attempt * 7_919) >>> 0;

/**
 * Generates the recipe's level: tries candidate boards in a fixed order (from the seed) until one meets every
 * rule and lands in the win band with a fitting time limit. Same recipe and seed, same level.
 */
export function generateLevel(recipe: LevelRecipe, seed = recipe.seed, maxAttempts = 4000): GeneratedLevel {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && attempt % 250 === 0) console.log(`  ${recipe.id}: ${attempt} candidates tried`);
    const board = buildCandidate(recipe, rng(candidateSeed(seed, attempt)));
    if (!board || ruleFailures(board, recipe).length > 0) continue;
    const timed = chooseTime(board, recipe);
    if (!timed) continue;
    const level = { ...board, timeLimitSeconds: timed.seconds };
    const stats = simulate(createGame(level), REPORT_RUNS, 1);
    if (!inRange(stats.winRate, recipe.winBand) || !inRange(stats.timeUpRate, recipe.time.timeUp)) continue;
    return { level, recipe, seed, attempt, stats, itemPx: itemPx(level) };
  }
  throw new Error(`${recipe.id}: no level found in ${maxAttempts} attempts with seed ${seed}`);
}

export function itemPx(level: LevelDefinition): { portrait: number; landscape: number } {
  const state = createGame(level);
  const at = (w: number, h: number) => Math.round(itemSize(layoutForLevel(level, state, w, h)) * 10) / 10;
  return { portrait: at(390, 844), landscape: at(844, 390) };
}

