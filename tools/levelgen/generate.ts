import {
  COMBO_DEFAULTS,
  createGame,
  LevelError,
  startTriples,
  trapWithin,
  tripleDepthIssues,
  typesNotOneTriple,
  type ColumnDefinition,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type TrackDefinition,
} from '../../src/core';
import { itemSize, layoutForLevel, validateLevelLayout } from '../../src/ui/levelLayout';
import { playMany, rng, simulate, solve, type SimulationStats } from '../simulator';
import { typesFor } from './plan';
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
 * the tracks, locks, and one triple of each of the recipe's types spread over all of it. Null if the numbers do
 * not work out (more items than slots, or too many empty slots for the back layers to take).
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

  // Exactly three items of each type: the front gets the recipe's empty slots, back layers any others (never
  // a whole back layer), and boards where that does not work out are skipped.
  const types = typesFor(recipe);
  if (types.length !== recipe.types) throw new Error(`${recipe.id}: ${types.length} types planned for ${recipe.types}`);
  const spare = places.length - types.length * 3 - recipe.emptyFront;
  if (spare < 0) return null;
  const fronts = places.filter((p) => p.kind === 'shelf' && p.layer === 0);
  const empty = new Set<Place>(shuffle(random, fronts).slice(0, recipe.emptyFront));
  const left = new Map<string, number>();
  for (const p of places) if (p.kind === 'shelf' && p.layer > 0) left.set(`${p.shelf}:${p.layer}`, (left.get(`${p.shelf}:${p.layer}`) ?? 0) + 1);
  let toEmpty = spare;
  for (const back of shuffle(
    random,
    places.filter((p) => p.kind === 'shelf' && p.layer > 0),
  )) {
    if (toEmpty === 0) break;
    if (back.kind !== 'shelf') continue;
    const key = `${back.shelf}:${back.layer}`;
    if (left.get(key)! <= 1) continue;
    left.set(key, left.get(key)! - 1);
    empty.add(back);
    toEmpty--;
  }
  if (toEmpty > 0) return null;
  const items = shuffle(
    random,
    types.flatMap((type) => [type, type, type]),
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
 * items are big enough on a phone; exactly one triple of each type; no layer that starts as a triple; no defeat within the first two moves; no
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
  const counts = typesNotOneTriple(state);
  if (counts.length > 0) failures.push(`types not exactly one triple: ${counts.map((c) => `${c.type} ×${c.count}`).join(', ')}`);
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
  if (failures.length === 0 && !isSolvable(state)) failures.push('no solution found');
  return failures;
}

/**
 * Whether the level can be won: some untimed game of the simulated player wins (a won game is a solution),
 * or else the solver finds a way; its search can run out on big boards, which is why the player goes first.
 * The player's wins only count without a roaming blocker, whose removal depends on combos the solver does not
 * assume.
 */
function isSolvable(state: GameState): boolean {
  if (!state.blocker && playMany({ ...state, timeLeftMs: null }, 40, 7).some((o) => o.won)) return true;
  return solve(state) !== undefined;
}

const roundUp = (seconds: number) => Math.max(MIN_TIME, Math.ceil(seconds / TIME_STEP) * TIME_STEP);

const inRange = (value: number, [min, max]: readonly [number, number]) => value >= min - 1e-9 && value <= max + 1e-9;

/**
 * A time limit for a board that puts the simulated win rate in the recipe's band, or null if none does: the
 * shortest one (never under the recipe's floor) whose predicted win rate reaches the band while the share of
 * games lost to the clock stays in its range, checked with timed games.
 */
function chooseTime(level: LevelDefinition, recipe: LevelRecipe): { seconds: number; stats: SimulationStats } | null {
  if (recipe.time.fixed !== undefined) {
    const stats = simulate(createGame({ ...level, timeLimitSeconds: recipe.time.fixed }), SEARCH_RUNS, 1);
    const fits = inRange(stats.winRate, recipe.winBand) && inRange(stats.timeUpRate, recipe.time.timeUp);
    return fits ? { seconds: recipe.time.fixed, stats } : null;
  }
  const untimed = playMany(createGame(level), SEARCH_RUNS, 1);
  const winTimes = untimed
    .filter((o) => o.won)
    .map((o) => o.seconds)
    .sort((a, b) => a - b);
  const untimedRate = winTimes.length / SEARCH_RUNS;
  if (untimedRate < recipe.winBand[0]) return null;
  const p90 = winTimes[Math.floor(winTimes.length * 0.9)] ?? winTimes.at(-1)!;
  const floor = roundUp(recipe.time.slack * p90);
  // Predicted win rate for a limit: untimed wins that finish in time; the rest of those wins become time-ups.
  const predicted = (limit: number) => winTimes.filter((s) => s <= limit).length / SEARCH_RUNS;
  // Up to past the slowest win; at least the floor itself, which can be above it with a generous slack.
  const last = Math.max(floor, roundUp(winTimes.at(-1)!) + TIME_STEP);
  // Timed games differ a little from the prediction, so a few limits near it are checked, shortest first.
  const near = ([min, max]: readonly [number, number]) => [min - 0.05, max + 0.05] as const;
  let checks = 0;
  for (let limit = floor; limit <= last && checks < 6; limit += TIME_STEP) {
    const win = predicted(limit);
    if (win < recipe.winBand[0] - 0.05 || !inRange(untimedRate - win, near(recipe.time.timeUp))) continue;
    checks++;
    const stats = simulate(createGame({ ...level, timeLimitSeconds: limit }), SEARCH_RUNS, 1);
    if (inRange(stats.winRate, recipe.winBand) && inRange(stats.timeUpRate, recipe.time.timeUp)) return { seconds: limit, stats };
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
  // A recipe that names its candidate (with its own seed) keeps that board: only the time is worked out.
  if (recipe.candidate !== undefined && seed === recipe.seed) return retime(recipe, seed, recipe.candidate);
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

function retime(recipe: LevelRecipe, seed: number, attempt: number): GeneratedLevel {
  const board = buildCandidate(recipe, rng(candidateSeed(seed, attempt)));
  if (!board) throw new Error(`${recipe.id}: candidate ${attempt} no longer fits the recipe`);
  const failures = ruleFailures(board, recipe);
  if (failures.length > 0) throw new Error(`${recipe.id}: candidate ${attempt} breaks the rules: ${failures.join('; ')}`);
  const timed = chooseTime(board, recipe);
  if (!timed) throw new Error(`${recipe.id}: no time limit puts candidate ${attempt} in the win band`);
  const level = { ...board, timeLimitSeconds: timed.seconds };
  return { level, recipe, seed, attempt, stats: simulate(createGame(level), REPORT_RUNS, 1), itemPx: itemPx(level) };
}

export function itemPx(level: LevelDefinition): { portrait: number; landscape: number } {
  const state = createGame(level);
  const at = (w: number, h: number) => Math.round(itemSize(layoutForLevel(level, state, w, h)) * 10) / 10;
  return { portrait: at(390, 844), landscape: at(844, 390) };
}

