import {
  COMBO_DEFAULTS,
  type Arrangement,
  createGame,
  LevelError,
  startTriples,
  trapWithin,
  tripleDepthIssues,
  tripleMoves,
  typesNotOneTriple,
  type ColumnDefinition,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type TrackDefinition,
} from '../../src/core';
import { itemSize, layoutForLevel, validateLevelLayout } from '../../src/ui/levelLayout';
import { CASUAL, EXPERT, playMany, rng, simulate, solve, type SimulationStats } from '../simulator';
import { typesFor } from './plan';
import type { LevelRecipe } from './recipe';

/** Simulated games while searching, and for the final figures. */
const SEARCH_RUNS = 100;
export const REPORT_RUNS = 200;
/** Time limits are whole multiples of this many seconds, unless a recipe sets its own step. */
const TIME_STEP = 5;
const MIN_TIME = 30;
/** No level gives more than four minutes. */
export const MAX_TIME = 240;

export interface GeneratedLevel {
  readonly level: LevelDefinition;
  readonly recipe: LevelRecipe;
  readonly seed: number;
  /** Which candidate of the seed's sequence passed. */
  readonly attempt: number;
  readonly stats: LevelStats;
  /** Item size in px on a phone in portrait and in landscape. */
  readonly itemPx: { readonly portrait: number; readonly landscape: number };
}

type Random = () => number;

/** Both simulated players' results on a level, REPORT_RUNS games each. */
export interface LevelStats {
  readonly casual: SimulationStats;
  readonly expert: SimulationStats;
}

/**
 * Whether a timed level meets its recipe's bands: the casual player's wins, time-ups and space pressure, then
 * (only worth simulating if those pass) the expert's wins. Returns the results when it does, null otherwise.
 */
export function bandedStats(level: LevelDefinition, recipe: LevelRecipe): LevelStats | null {
  const casual = simulate(createGame(level), REPORT_RUNS, 1, CASUAL);
  if (!inRange(casual.winRate, recipe.winBand) || !inRange(casual.timeUpRate, recipe.time.timeUp)) return null;
  if (recipe.pressure && !inRange(casual.pressure, recipe.pressure)) return null;
  const expert = simulate(createGame(level), REPORT_RUNS, 1, EXPERT);
  if (recipe.expertBand && !inRange(expert.winRate, recipe.expertBand)) return null;
  return { casual, expert };
}

/** Both players' results, whatever the bands. */
export function levelStats(level: LevelDefinition): LevelStats {
  return { casual: simulate(createGame(level), REPORT_RUNS, 1, CASUAL), expert: simulate(createGame(level), REPORT_RUNS, 1, EXPERT) };
}

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
  /** Tracks of stacks, or of shelves (`shelves`: the level's shelves riding it, in carrier order). */
  readonly tracks: { orientation: 'horizontal' | 'vertical'; speed: number; carriers: number; shelves?: number[] }[];
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
    if (column.kind === 'shelfTrack') {
      const shelves = Array.from({ length: column.count }, (_, i) => shelfCount + i);
      shelfCount += column.count;
      tracks.push({ orientation: 'vertical', speed: column.speed, carriers: column.count, shelves });
      return { kind: 'shelfTrack', track: tracks.length - 1 };
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
  const layered = choose(random, shelfCount, recipe.backLayers.shelves);
  const { total } = recipe.backLayers;
  if (total === undefined) {
    for (const shelf of layered) layerCounts[shelf] = intIn(random, recipe.backLayers.layers);
  } else {
    // Each layered shelf gets the fewest layers, then the rest go one at a time to shelves with room for more.
    const [fewest, most] = recipe.backLayers.layers;
    for (const shelf of layered) layerCounts[shelf] = fewest;
    let left = total - layered.length * (fewest - 1);
    while (left > 0) {
      const open = layered.filter((shelf) => layerCounts[shelf]! < most);
      if (open.length === 0) return null;
      layerCounts[open[Math.floor(random() * open.length)]!]!++;
      left--;
    }
    if (left < 0) return null;
  }
  const lockedShelves = recipe.locked?.length ? choose(random, shelfCount, recipe.locked.length) : [];

  const places: Place[] = [];
  layerCounts.forEach((layers, shelf) => {
    for (let layer = 0; layer < layers; layer++) for (let slot = 0; slot < 3; slot++) places.push({ kind: 'shelf', shelf, layer, slot });
  });
  tracks.forEach((track, t) => {
    // Shelves riding a track hold their items on the shelves themselves.
    if (track.shelves) return;
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
  // Empty front slots go on unlocked shelves, so they are all free from the start, and first on shelves with
  // the fewest hidden layers: a front with a layer behind it that is nearly empty would refill as soon as it
  // is emptied, taking up the space it seemed to offer (and making two-move traps likely on a full board).
  const fronts = shuffle(
    random,
    places.filter((p) => p.kind === 'shelf' && p.layer === 0 && !lockedShelves.includes(p.shelf)),
  ).sort((a, b) => layerCounts[(a as { shelf: number }).shelf]! - layerCounts[(b as { shelf: number }).shelf]!);
  // A shelf with layers behind keeps at least one item in front (an empty front would bring them forward).
  const emptyPerShelf = new Map<number, number>();
  const empty = new Set<Place>();
  for (const place of fronts) {
    if (empty.size === recipe.emptyFront) break;
    const shelf = (place as { shelf: number }).shelf;
    if (layerCounts[shelf]! > 1 && (emptyPerShelf.get(shelf) ?? 0) >= 2) continue;
    emptyPerShelf.set(shelf, (emptyPerShelf.get(shelf) ?? 0) + 1);
    empty.add(place);
  }
  if (empty.size < recipe.emptyFront) return null;
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
  if (lockedShelves.length > 0) {
    mechanics.push({
      kind: 'lockedShelves',
      shelves: lockedShelves.map((shelf, i) => ({ shelf, triplesRequired: recipe.locked![i]! })),
    });
  }
  if (recipe.blocker) {
    const locked = new Set(mechanics.flatMap((m) => (m.kind === 'lockedShelves' ? m.shelves.map((s) => s.shelf) : [])));
    const free = shelves.flatMap((layers, shelf) =>
      locked.has(shelf) ? [] : layers[0]!.flatMap((type, slot) => (type === null ? [{ shelf, slot }] : [])),
    );
    if (free.length === 0) return null;
    const start = free[Math.floor(random() * free.length)]!;
    mechanics.push({ kind: 'roamingBlocker', start, seed: Math.floor(random() * 1_000_000), removeAtCombo: recipe.blocker.removeAtCombo });
  }
  if (tracks.length > 0) {
    mechanics.push({
      kind: 'tracks',
      tracks: tracks.map(
        (track, t): TrackDefinition => ({
          orientation: track.orientation,
          speed: track.speed,
          carriers: track.shelves ? track.shelves.map((shelf) => ({ shelf })) : stacks[t]!,
        }),
      ),
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
 * triple buried deeper than the recipe allows; enough triples in reach at the start; a move completing a triple
 * for a level with the tutorial; solvable even without combos.
 */
export function ruleFailures(level: LevelDefinition, recipe: Pick<LevelRecipe, 'maxDepth' | 'minStartTriples' | 'tutorial'>): string[] {
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
  if (recipe.tutorial && tripleMoves(state).length === 0) failures.push('no single move completes a triple for the tutorial');
  if (failures.length === 0 && !isSolvable(state)) failures.push('no solution found');
  return failures;
}

/**
 * Whether the level can be won without combos: some untimed game of the simulated player wins (a won game is a
 * solution), or else the solver finds a way; its search can run out on big boards, which is why the player goes
 * first. A roaming blocker never goes away in those games, since its removal depends on a combo: where it jumps
 * does not.
 */
function isSolvable(state: GameState): boolean {
  const blocker = state.blocker && { ...state.blocker, removeAtCombo: Number.POSITIVE_INFINITY };
  if (playMany({ ...state, blocker, timeLeftMs: null }, 40, 7, EXPERT).some((o) => o.won)) return true;
  return solve(state) !== undefined;
}

const roundUp = (seconds: number, step = TIME_STEP) => Math.min(MAX_TIME, Math.max(MIN_TIME, Math.ceil(seconds / step) * step));

const inRange = (value: number, [min, max]: readonly [number, number]) => value >= min - 1e-9 && value <= max + 1e-9;

/**
 * A time limit for a board that puts the simulated win rate in the recipe's band, or null if none does: the
 * shortest one (never under the recipe's floor, never over MAX_TIME) whose predicted win rate reaches the band while the share of
 * games lost to the clock stays in its range, checked with timed games.
 */
function chooseTime(level: LevelDefinition, recipe: LevelRecipe, seed: number): { seconds: number; stats: SimulationStats } | null {
  if (recipe.time.typical) return chooseTypicalTime(level, recipe, seed);
  if (recipe.time.fixed !== undefined) {
    const stats = simulate(createGame({ ...level, timeLimitSeconds: recipe.time.fixed }), SEARCH_RUNS, 1);
    const fits = recipe.time.fixed <= MAX_TIME && inRange(stats.winRate, recipe.winBand) && inRange(stats.timeUpRate, recipe.time.timeUp);
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
  const step = recipe.time.step ?? TIME_STEP;
  const floor = roundUp(recipe.time.slack * p90, step);
  // Predicted win rate for a limit: untimed wins that finish in time; the rest of those wins become time-ups.
  const predicted = (limit: number) => winTimes.filter((s) => s <= limit).length / SEARCH_RUNS;
  // Up to past the slowest win; at least the floor itself, which can be above it with a generous slack.
  const last = Math.min(MAX_TIME, Math.max(floor, roundUp(winTimes.at(-1)!, step) + step));
  // Timed games differ a little from the prediction, so a few limits near it are checked, shortest first.
  const near = ([min, max]: readonly [number, number]) => [min - 0.05, max + 0.05] as const;
  let checks = 0;
  for (let limit = floor; limit <= last && checks < 6; limit += step) {
    const win = predicted(limit);
    if (win < recipe.winBand[0] - 0.05 || !inRange(untimedRate - win, near(recipe.time.timeUp))) continue;
    checks++;
    const stats = simulate(createGame({ ...level, timeLimitSeconds: limit }), SEARCH_RUNS, 1);
    if (inRange(stats.winRate, recipe.winBand) && inRange(stats.timeUpRate, recipe.time.timeUp)) return { seconds: limit, stats };
  }
  return null;
}

/** Boards a typical time is set from: the board and this many reshuffles of it that meet the rules. */
const TYPICAL_RESHUFFLES = 4;
const TYPICAL_RUNS = 40;
/** Mixed into a candidate's seed for its reshuffles, so they differ from the board's own random choices. */
const TYPICAL_SALT = 0x5eed;

/**
 * Like chooseTime, for recipes with `time.typical`: the shortest limit (never under the floor) at which the
 * board and a few reshuffles of it, together, land in the band. Null if none does, or if too few reshuffles
 * meet the rules.
 */
function chooseTypicalTime(level: LevelDefinition, recipe: LevelRecipe, seed: number): { seconds: number; stats: SimulationStats } | null {
  const random = rng(seed);
  const boards = [level];
  for (let i = 0; i < TYPICAL_RESHUFFLES * 3 && boards.length <= TYPICAL_RESHUFFLES; i++) {
    const other = rearrange(level, random);
    if (ruleFailures(other, recipe).length === 0) boards.push(other);
  }
  if (boards.length <= TYPICAL_RESHUFFLES) return null;
  const runs = boards.length * TYPICAL_RUNS;
  const winTimes = boards
    .flatMap((b) => playMany(createGame(b), TYPICAL_RUNS, 1))
    .filter((o) => o.won)
    .map((o) => o.seconds)
    .sort((a, b) => a - b);
  const untimedRate = winTimes.length / runs;
  if (untimedRate < recipe.winBand[0]) return null;
  const p90 = winTimes[Math.floor(winTimes.length * 0.9)] ?? winTimes.at(-1)!;
  const step = recipe.time.step ?? TIME_STEP;
  const floor = roundUp(recipe.time.slack * p90, step);
  const predicted = (limit: number) => winTimes.filter((s) => s <= limit).length / runs;
  const last = Math.min(MAX_TIME, Math.max(floor, roundUp(winTimes.at(-1)!, step) + step));
  const near = ([min, max]: readonly [number, number]) => [min - 0.05, max + 0.05] as const;
  let checks = 0;
  for (let limit = floor; limit <= last && checks < 6; limit += step) {
    const win = predicted(limit);
    if (win < recipe.winBand[0] - 0.05 || !inRange(untimedRate - win, near(recipe.time.timeUp))) continue;
    checks++;
    const all = boards.map((b) => simulate(createGame({ ...b, timeLimitSeconds: limit }), TYPICAL_RUNS, 1));
    const mean = (key: 'winRate' | 'timeUpRate') => all.reduce((sum, s) => sum + s[key], 0) / all.length;
    if (inRange(mean('winRate'), recipe.winBand) && inRange(mean('timeUpRate'), recipe.time.timeUp)) {
      return { seconds: limit, stats: all[0]! };
    }
  }
  return null;
}

/** The seed of a candidate: the recipe's seed and the attempt number, mixed. */
const candidateSeed = (seed: number, attempt: number) => (Math.imul(seed, 1_000_003) + attempt * 7_919) >>> 0;

/**
 * Generates the recipe's level: tries candidate boards in a fixed order (from the seed) until one meets every
 * rule and lands in the win band with a fitting time limit. Same recipe and seed, same level.
 */
export function generateLevel(recipe: LevelRecipe, seed = recipe.seed, maxAttempts = 4000, from = 0): GeneratedLevel {
  // A recipe that names its candidate (with its own seed) keeps that board: only the time is worked out.
  if (isPinned(recipe, seed)) return retime(recipe, seed, recipe.candidate!);
  for (let attempt = from; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && attempt % 250 === 0) console.log(`  ${recipe.id}: ${attempt} candidates tried`);
    const board = buildCandidate(recipe, rng(candidateSeed(seed, attempt)));
    if (!board || ruleFailures(board, recipe).length > 0) continue;
    const timed = chooseTime(board, recipe, candidateSeed(seed, attempt) ^ TYPICAL_SALT);
    if (!timed) continue;
    const level = { ...board, timeLimitSeconds: timed.seconds };
    const stats = bandedStats(level, recipe);
    if (!stats) continue;
    return { level, recipe, seed, attempt, stats, itemPx: itemPx(level) };
  }
  throw new Error(`${recipe.id}: no level found in ${maxAttempts} attempts with seed ${seed}`);
}

/** Whether the recipe names the board to use for this seed, rather than searching for one. */
export const isPinned = (recipe: LevelRecipe, seed: number) => recipe.candidate !== undefined && seed === recipe.seed;

function retime(recipe: LevelRecipe, seed: number, attempt: number): GeneratedLevel {
  const board = buildCandidate(recipe, rng(candidateSeed(seed, attempt)));
  if (!board) throw new Error(`${recipe.id}: candidate ${attempt} no longer fits the recipe`);
  const failures = ruleFailures(board, recipe);
  if (failures.length > 0) throw new Error(`${recipe.id}: candidate ${attempt} breaks the rules: ${failures.join('; ')}`);
  const timed = chooseTime(board, recipe, candidateSeed(seed, attempt) ^ TYPICAL_SALT);
  if (!timed) throw new Error(`${recipe.id}: no time limit puts candidate ${attempt} in the win band`);
  const level = { ...board, timeLimitSeconds: timed.seconds };
  return { level, recipe, seed, attempt, stats: levelStats(level), itemPx: itemPx(level) };
}

export function itemPx(level: LevelDefinition): { portrait: number; landscape: number } {
  const state = createGame(level);
  const at = (w: number, h: number) => Math.round(itemSize(layoutForLevel(level, state, w, h)) * 10) / 10;
  return { portrait: at(390, 844), landscape: at(844, 390) };
}


/** Arrangements per level, the level as written included (see Arrangement in src/core). */
export const ARRANGEMENTS = 8;
/**
 * Arrangements a newly searched board needs, the board itself included: a board most of whose reshuffles leave
 * the band is a lucky exception of its recipe, so the search moves on to the next candidate.
 */
export const MIN_NEW_ARRANGEMENTS = 5;
/** With quickReject: reshuffles after which a board with fewer than two good ones is given up. */
const QUICK_REJECT_AFTER = 60;
/** Reshuffles tried per level before settling for fewer arrangements. */
const ARRANGEMENT_ATTEMPTS = 400;

export interface GeneratedArrangement {
  readonly arrangement: Arrangement;
  readonly stats: LevelStats;
}

/**
 * The same board with its items in other places: every occupied shelf slot and stack position keeps being
 * occupied (so empty slots, layers, stack depths and a roaming blocker's start stay put) and gets a random item.
 */
export function rearrange(level: LevelDefinition, random: Random): LevelDefinition {
  const items: string[] = [];
  level.shelves.forEach((layers) => layers.forEach((slots) => slots.forEach((t) => t !== null && items.push(t))));
  for (const m of level.mechanics ?? []) {
    if (m.kind === 'tracks') for (const track of m.tracks) for (const c of track.carriers) if (!('shelf' in c)) items.push(...c);
  }
  shuffle(random, items);
  let next = 0;
  const shelves = level.shelves.map((layers) => layers.map((slots) => slots.map((t) => (t === null ? null : items[next++]!))));
  const mechanics = level.mechanics?.map((m): MechanicDefinition => {
    if (m.kind !== 'tracks') return m;
    const tracks = m.tracks.map((track) => ({
      ...track,
      carriers: track.carriers.map((c) => ('shelf' in c ? c : c.map(() => items[next++]!))),
    }));
    return { ...m, tracks };
  });
  return { ...level, shelves, ...(mechanics ? { mechanics } : {}) };
}

/** The arrangement (items only) of a level. */
export function arrangementOf(level: LevelDefinition): Arrangement {
  const tracks = level.mechanics?.find((m) => m.kind === 'tracks');
  if (tracks?.kind !== 'tracks') return { shelves: level.shelves };
  const stacks = tracks.tracks.map((track) =>
    track.carriers.some((c) => 'shelf' in c) ? null : (track.carriers as readonly (readonly string[])[]),
  );
  return { shelves: level.shelves, stacks };
}

/**
 * Up to ARRANGEMENTS - 1 other arrangements of a generated level, each meeting every rule and landing in the
 * recipe's win band with the level's own time limit (checked with the same simulated games as the level).
 * Reshuffles that miss are discarded. Same level, recipe and seed, same arrangements. With `quickReject` (while
 * searching for a new board) it gives up early on a board whose reshuffles clearly miss the band too often to
 * reach MIN_NEW_ARRANGEMENTS.
 */
export function generateArrangements(level: LevelDefinition, recipe: LevelRecipe, seed: number, quickReject = false): GeneratedArrangement[] {
  const found: GeneratedArrangement[] = [];
  const seen = new Set([JSON.stringify(arrangementOf(level))]);
  const random = rng(candidateSeed(seed, 1_000_000));
  for (let attempt = 0; attempt < ARRANGEMENT_ATTEMPTS && found.length < ARRANGEMENTS - 1; attempt++) {
    if (quickReject && attempt === QUICK_REJECT_AFTER && found.length < 2) return found;
    const candidate = rearrange(level, random);
    const key = JSON.stringify(arrangementOf(candidate));
    if (seen.has(key)) continue;
    seen.add(key);
    if (ruleFailures(candidate, recipe).length > 0) continue;
    const stats = bandedStats(candidate, recipe);
    if (!stats) continue;
    found.push({ arrangement: arrangementOf(candidate), stats });
  }
  return found;
}

/** A generated level with the arrangements made for it (also in `level.arrangements`). */
export type WithArrangements = GeneratedLevel & { readonly arrangements: readonly GeneratedArrangement[] };

/** Lowest and highest value of a figure over all of a level's arrangements, the level as written included. */
export function statRange(generated: WithArrangements, figure: (stats: LevelStats) => number): [number, number] {
  const values = [generated.stats, ...generated.arrangements.map((a) => a.stats)].map(figure);
  return [Math.min(...values), Math.max(...values)];
}
