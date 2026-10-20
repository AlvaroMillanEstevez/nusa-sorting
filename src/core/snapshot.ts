import { BOOSTER_IDS, type BoosterId } from '../data/economy';
import { returnHeld, stackOf } from './game';
import { createGame, type LevelDefinition } from './level';
import { SLOTS_PER_LAYER, type BlockerState, type Carrier, type ComboState, type FreshState, type GameState, type Item, type Layer, type Shelf, type TrackState } from './types';

/**
 * A level in progress, saved so the game can pick it up where it was after the page is reloaded or the browser
 * drops the tab (mobile browsers do that to pages in the background). It is the state after the last move, never
 * an earlier one, so it cannot be used to undo moves.
 */

/**
 * Bumped whenever GameState or the snapshot changes shape: older snapshots are then dropped. 2: closed shelves. 3: fresh foods' countdowns.
 */
export const SNAPSHOT_FORMAT = 3;

export interface GameSnapshot {
  readonly format: number;
  readonly levelId: string;
  /** The arrangement played (see withArrangement). */
  readonly arrangement: number;
  /** Of the level as played: if the level has changed since, the snapshot is dropped. */
  readonly fingerprint: string;
  readonly state: GameState;
  /** Continues used in this attempt (their price goes up with each). */
  readonly continuesUsed: number;
  /** Boosters used in this attempt. */
  readonly boostersUsed: Readonly<Record<BoosterId, number>>;
}

/** What a snapshot gives back to the game. */
export interface RestoredGame {
  readonly state: GameState;
  readonly continuesUsed: number;
  readonly boostersUsed: Readonly<Record<BoosterId, number>>;
}

export const NO_BOOSTERS_USED: Readonly<Record<BoosterId, number>> = { freeze: 0, removeTriple: 0, shuffle: 0 };

/** A short hash (FNV-1a, 32 bits) of the level as played, to notice when it has changed. */
export function levelFingerprint(level: LevelDefinition): string {
  const text = JSON.stringify(level);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * The snapshot of a level being played. An item held from a track goes back on its carrier (as the game does
 * when it pauses), so the snapshot is always a board at rest.
 */
export function takeSnapshot(level: LevelDefinition, arrangement: number, state: GameState, attempt: Omit<RestoredGame, 'state'>): GameSnapshot {
  const returned = state.held ? returnHeld(state) : null;
  return {
    format: SNAPSHOT_FORMAT,
    levelId: level.id,
    arrangement,
    fingerprint: levelFingerprint(level),
    state: returned?.ok ? returned.state : state,
    continuesUsed: attempt.continuesUsed,
    boostersUsed: attempt.boostersUsed,
  };
}

/**
 * The game a saved snapshot holds, for `level` as it is played now (with the arrangement the snapshot names), or
 * null if it cannot be trusted: another format, another level or version of it, a game already over, or any
 * field out of shape. Never throws. Everything the level itself fixes (time limit, combo table, locks, tracks'
 * speeds) comes from the level, and only what play changes comes from the snapshot, checked against it: the
 * same items with the same kinds, whole triples gone, shelves and tracks of the same shape.
 */
export function restoreSnapshot(raw: unknown, level: LevelDefinition): RestoredGame | null {
  try {
    if (!isRecord(raw) || raw.format !== SNAPSHOT_FORMAT || raw.levelId !== level.id || raw.fingerprint !== levelFingerprint(level)) return null;
    const state = restoreState(raw.state, createGame(level));
    if (!state) return null;
    return { state, continuesUsed: count(raw.continuesUsed) ?? 0, boostersUsed: parseBoostersUsed(raw.boostersUsed) };
  } catch {
    return null;
  }
}

function restoreState(raw: unknown, initial: GameState): GameState | null {
  if (!isRecord(raw) || raw.status !== 'playing' || raw.held !== null) return null;
  // The items found so far, by id.
  const types = new Map<number, string>();
  const take = (value: unknown): Item | null => {
    if (!isRecord(value) || typeof value.type !== 'string' || !Number.isInteger(value.id)) return null;
    return { id: value.id as number, type: value.type };
  };
  const known = new Map<number, string>();
  const note = (item: Item) => known.set(item.id, item.type);
  initial.shelves.forEach((shelf) => shelf.layers.forEach((layer) => layer.forEach((item) => item && note(item))));
  initial.tracks.forEach((track) => track.carriers.forEach((carrier) => stackOf(carrier).forEach(note)));
  // Every item must be one of the level's, with its kind, and appear once.
  const place = (item: Item | null): boolean => {
    if (!item || known.get(item.id) !== item.type || types.has(item.id)) return false;
    types.set(item.id, item.type);
    return true;
  };

  // Shelves: the same number, each with 1 to its starting number of layers of three slots.
  if (!Array.isArray(raw.shelves) || raw.shelves.length !== initial.shelves.length) return null;
  const shelves: Shelf[] = [];
  for (let s = 0; s < initial.shelves.length; s++) {
    const shelf = raw.shelves[s] as unknown;
    if (!isRecord(shelf) || !Array.isArray(shelf.layers)) return null;
    const layerCount = shelf.layers.length;
    if (layerCount < 1 || layerCount > initial.shelves[s]!.layers.length) return null;
    const layers: Layer[] = [];
    for (const rawLayer of shelf.layers as unknown[]) {
      if (!Array.isArray(rawLayer) || rawLayer.length !== SLOTS_PER_LAYER) return null;
      const layer: (Item | null)[] = [];
      for (const slot of rawLayer as unknown[]) {
        if (slot === null) {
          layer.push(null);
          continue;
        }
        const item = take(slot);
        if (!place(item)) return null;
        layer.push(item);
      }
      layers.push(layer);
    }
    shelves.push({ layers });
  }

  // Tracks: the same carriers, stacks only shorter.
  if (!Array.isArray(raw.tracks) || raw.tracks.length !== initial.tracks.length) return null;
  const tracks: TrackState[] = [];
  for (let t = 0; t < initial.tracks.length; t++) {
    const track = raw.tracks[t] as unknown;
    const start = initial.tracks[t]!;
    if (!isRecord(track) || !Array.isArray(track.carriers) || track.carriers.length !== start.carriers.length) return null;
    const carriers: Carrier[] = [];
    for (let c = 0; c < start.carriers.length; c++) {
      const carrier = track.carriers[c] as unknown;
      const was = start.carriers[c]!;
      if (!isRecord(carrier) || carrier.kind !== was.kind) return null;
      if (was.kind === 'shelf') {
        if (carrier.shelf !== was.shelf) return null;
        carriers.push(was);
        continue;
      }
      if (!Array.isArray(carrier.stack) || carrier.stack.length > was.stack.length) return null;
      const stack: Item[] = [];
      for (const value of carrier.stack as unknown[]) {
        const item = take(value);
        if (!place(item)) return null;
        stack.push(item!);
      }
      carriers.push({ kind: 'stack', stack });
    }
    tracks.push({ ...start, carriers });
  }

  // Whole triples only: each kind is a multiple of three, and the triples gone are the ones counted.
  const perType = new Map<string, number>();
  for (const type of types.values()) perType.set(type, (perType.get(type) ?? 0) + 1);
  if ([...perType.values()].some((n) => n % 3 !== 0)) return null;
  const triplesCleared = count(raw.triplesCleared);
  if (triplesCleared === null || triplesCleared * 3 !== known.size - types.size) return null;

  const timeLeftMs = initial.timeLeftMs === null ? (raw.timeLeftMs === null ? null : undefined) : positive(raw.timeLeftMs);
  const trackTimeMs = positive(raw.trackTimeMs);
  const frozenMs = positive(raw.frozenMs);
  const combo = restoreCombo(raw.combo, initial.combo);
  const blocker = restoreBlocker(raw.blocker, initial.blocker, shelves.length);
  if (timeLeftMs === undefined || typeof trackTimeMs !== 'number' || typeof frozenMs !== 'number' || !combo || blocker === undefined) return null;
  if (typeof raw.clockStarted !== 'boolean') return null;
  // Closed shelves: only ones that close when empty, and empty with no layers behind.
  if (!Array.isArray(raw.closed) || raw.closed.length !== shelves.length) return null;
  const closed: boolean[] = [];
  for (let s = 0; s < shelves.length; s++) {
    const value = raw.closed[s] as unknown;
    if (typeof value !== 'boolean') return null;
    if (value && (!initial.closesWhenEmpty[s] || shelves[s]!.layers.length > 1 || shelves[s]!.layers[0]!.some((slot) => slot !== null))) return null;
    closed.push(value);
  }
  // Fresh foods: the level's, in its order, each with no more moves left than it started with.
  if (!Array.isArray(raw.fresh) || raw.fresh.length !== initial.fresh.length) return null;
  const fresh: FreshState[] = [];
  for (let f = 0; f < initial.fresh.length; f++) {
    const value = raw.fresh[f] as unknown;
    const start = initial.fresh[f]!;
    if (!isRecord(value) || value.type !== start.type || typeof value.spoiled !== 'boolean') return null;
    const movesLeft = count(value.movesLeft);
    if (movesLeft === null || movesLeft > start.movesLeft || (value.spoiled && movesLeft !== 0)) return null;
    fresh.push({ type: start.type, movesLeft, spoiled: value.spoiled });
  }

  return {
    ...initial,
    shelves,
    tracks,
    triplesCleared,
    timeLeftMs,
    trackTimeMs,
    frozenMs,
    combo,
    blocker,
    clockStarted: raw.clockStarted,
    closed,
    fresh,
  };
}

function restoreCombo(raw: unknown, start: ComboState): ComboState | null {
  if (!isRecord(raw)) return null;
  const combo = count(raw.combo);
  const maxCombo = count(raw.maxCombo);
  const windowLeftMs = positive(raw.windowLeftMs);
  const score = positive(raw.score);
  if (combo === null || maxCombo === null || windowLeftMs === undefined || windowLeftMs === null || score === undefined || score === null) return null;
  return { ...start, combo, maxCombo, windowLeftMs: Math.min(windowLeftMs, start.windowMs), score };
}

/** The blocker as saved; undefined if out of shape (null is a valid "none left"). */
function restoreBlocker(raw: unknown, start: BlockerState | null, shelves: number): BlockerState | null | undefined {
  if (raw === null) return null;
  if (!start || !isRecord(raw) || !isRecord(raw.at) || !Number.isInteger(raw.rngState)) return undefined;
  const shelf = count(raw.at.shelf);
  const slot = count(raw.at.slot);
  if (shelf === null || slot === null || shelf >= shelves || slot >= SLOTS_PER_LAYER) return undefined;
  return { ...start, at: { shelf, slot }, rngState: raw.rngState as number };
}

function parseBoostersUsed(value: unknown): Record<BoosterId, number> {
  const used = isRecord(value) ? value : {};
  return Object.fromEntries(BOOSTER_IDS.map((id) => [id, count(used[id]) ?? 0])) as Record<BoosterId, number>;
}

const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

/** A finite number of 0 or more; null stays null (an untimed clock), anything else is undefined. */
function positive(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
