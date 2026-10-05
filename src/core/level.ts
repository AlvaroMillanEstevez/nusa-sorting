import { isBlocked } from './game';
import {
  COMBO_DEFAULTS,
  CONVEYOR_LIMITS,
  ROAMING_BLOCKER_DEFAULTS,
  type MechanicDefinition,
  type TrackDefinition,
} from './mechanics';
import {
  SLOTS_PER_LAYER,
  type BlockerState,
  type ComboState,
  type GameState,
  type Item,
  type ItemType,
  type Layer,
  type Shelf,
  type TrackState,
} from './types';

/**
 * A column of a column layout: fixed shelves stacked top to bottom, a vertical track of stacks, or a vertical
 * track of shelves (its shelves are listed on the track, not in a shelf column).
 */
export type ColumnDefinition =
  | { readonly kind: 'shelves'; readonly shelves: readonly number[] }
  | { readonly kind: 'track'; readonly track: number }
  | { readonly kind: 'shelfTrack'; readonly track: number };

/**
 * Up to three columns, left to right. Every shelf and every track of the level appears in exactly one column,
 * and track columns hold vertical tracks. A later column kind will be a vertical track of 3-slot shelves.
 */
export interface ColumnLayoutDefinition {
  readonly columns: readonly ColumnDefinition[];
}

export const MAX_COLUMNS = 3;

/** Level data: shelves[shelf][layer][slot], layer 0 is the front. null is an empty slot. */
export interface LevelDefinition {
  readonly id: string;
  /** Time to clear the level; omit for an untimed level. */
  readonly timeLimitSeconds?: number;
  readonly shelves: readonly (readonly (readonly (ItemType | null)[])[])[];
  /** Optional rules on top of the base game. Omitted or empty: the level plays exactly like the base game. */
  readonly mechanics?: readonly MechanicDefinition[];
  /** Column layout; omitted: shelves in an automatic grid with at most one horizontal track below. */
  readonly layout?: ColumnLayoutDefinition;
  /**
   * Theme of a special level: any level with a theme is special (the HUD says so). Themes will bring their own
   * decoration; for now a special level's twist comes from existing mechanics only.
   */
  readonly theme?: string;
}

/** Special levels are the ones with a theme. */
export function isSpecialLevel(level: LevelDefinition): boolean {
  return level.theme !== undefined;
}

export class LevelError extends Error {}

/** Validates a level definition and builds its initial state, giving every item a unique id. */
export function createGame(level: LevelDefinition): GameState {
  if (level.shelves.length === 0) throw new LevelError(`${level.id}: level has no shelves`);
  const { timeLimitSeconds } = level;
  if (timeLimitSeconds !== undefined && !(timeLimitSeconds > 0)) {
    throw new LevelError(`${level.id}: time limit must be positive`);
  }
  if (level.theme !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(level.theme)) {
    throw new LevelError(`${level.id}: theme must be a kebab-case id`);
  }

  const counts = new Map<ItemType, number>();
  let nextId = 1;

  const shelves: Shelf[] = level.shelves.map((layers, s) => {
    if (layers.length === 0) throw new LevelError(`${level.id}: shelf ${s} has no layers`);
    return {
      layers: layers.map((slots, l): Layer => {
        if (slots.length !== SLOTS_PER_LAYER) {
          throw new LevelError(`${level.id}: shelf ${s} layer ${l} must have ${SLOTS_PER_LAYER} slots`);
        }
        if (l > 0 && slots.every((slot) => slot === null)) {
          throw new LevelError(`${level.id}: shelf ${s} layer ${l} is an empty back layer`);
        }
        return slots.map((type) => {
          if (type === null) return null;
          counts.set(type, (counts.get(type) ?? 0) + 1);
          return { id: nextId++, type };
        });
      }),
    };
  });

  shelves.forEach((shelf, s) => {
    const front = shelf.layers[0]!;
    const first = front[0];
    if (first && front.every((slot) => slot?.type === first.type)) {
      throw new LevelError(`${level.id}: shelf ${s} starts with a complete triple`);
    }
    if (shelf.layers.length > 1 && front.every((slot) => slot === null)) {
      throw new LevelError(`${level.id}: shelf ${s} has an empty front layer with layers behind`);
    }
  });

  // Track items count for the multiple-of-3 rule. Their ids come after the shelves' (track by track, carrier by
  // carrier, top of each stack first), so shelf ids never change and levels 8-9 keep theirs.
  const trackItems = trackDefinitions(level).map((track) =>
    track.carriers.map((carrier) =>
      'shelf' in carrier
        ? carrier
        : carrier.map((type): Item => {
            counts.set(type, (counts.get(type) ?? 0) + 1);
            return { id: nextId++, type };
          }),
    ),
  );

  let totalItems = 0;
  for (const [type, count] of counts) {
    if (count % 3 !== 0) throw new LevelError(`${level.id}: item "${type}" appears ${count} times, not a multiple of 3`);
    totalItems += count;
  }

  const mechanics = parseMechanics(level, shelves, totalItems / 3, trackItems);
  checkLayout(level, shelves.length, mechanics.tracks);
  const state: GameState = {
    shelves,
    status: counts.size === 0 ? 'won' : 'playing',
    loseReason: null,
    timeLeftMs: timeLimitSeconds === undefined ? null : timeLimitSeconds * 1000,
    triplesCleared: 0,
    trackTimeMs: 0,
    held: null,
    clockStarted: false,
    ...mechanics,
  };
  if (isBlocked(state)) throw new LevelError(`${level.id}: level starts blocked`);
  return state;
}

type MechanicState = Pick<GameState, 'unlockAt' | 'combo' | 'blocker' | 'tracks'>;

/** Tracks as declared: the legacy single 'conveyor' becomes one horizontal track of one-item stacks. */
function trackDefinitions(level: LevelDefinition): readonly TrackDefinition[] {
  const tracks: TrackDefinition[] = [];
  for (const mechanic of level.mechanics ?? []) {
    if (mechanic.kind === 'conveyor') {
      tracks.push({
        orientation: 'horizontal',
        speed: mechanic.speed,
        carriers: mechanic.slots.map((type) => (type === null ? [] : [type])),
      });
    } else if (mechanic.kind === 'tracks') {
      tracks.push(...mechanic.tracks);
    }
  }
  return tracks;
}

/** Validates the level's mechanics against its board and builds their initial state. */
function parseMechanics(
  level: LevelDefinition,
  shelves: readonly Shelf[],
  totalTriples: number,
  trackItems: readonly (readonly (readonly Item[] | { readonly shelf: number })[])[],
): MechanicState {
  const fail = (message: string): never => {
    throw new LevelError(`${level.id}: ${message}`);
  };
  const list = level.mechanics ?? [];
  const kinds = new Set(list.map((m) => m.kind));
  if (kinds.size !== list.length) fail('each mechanic may appear only once');

  const unlockAt: (number | null)[] = shelves.map(() => null);
  // Combo and score are a base rule of every level; the 'combo' mechanic only tunes them.
  let combo: ComboState = newCombo(COMBO_DEFAULTS.windowSeconds, COMBO_DEFAULTS.pointsPerTriple, COMBO_DEFAULTS.multipliers);
  let blocker: BlockerState | null = null;
  const tracks: TrackState[] = [];
  const checkSpeed = (speed: number, what: string) => {
    if (!Number.isFinite(speed) || speed === 0 || Math.abs(speed) > CONVEYOR_LIMITS.maxSpeed) {
      fail(`${what} speed must be non-zero and at most ${CONVEYOR_LIMITS.maxSpeed} slots per second`);
    }
  };
  if (kinds.has('conveyor') && kinds.has('tracks')) fail('use either conveyor or tracks, not both');

  for (const mechanic of list) {
    switch (mechanic.kind) {
      case 'combo': {
        const windowSeconds = mechanic.windowSeconds ?? COMBO_DEFAULTS.windowSeconds;
        const pointsPerTriple = mechanic.pointsPerTriple ?? COMBO_DEFAULTS.pointsPerTriple;
        const multipliers = mechanic.multipliers ?? COMBO_DEFAULTS.multipliers;
        if (!(windowSeconds > 0)) fail('combo window must be positive');
        if (!(pointsPerTriple > 0)) fail('points per triple must be positive');
        if (multipliers.length === 0 || multipliers.some((m) => !(m > 0))) {
          fail('combo multipliers must be a non-empty list of positive numbers');
        }
        combo = newCombo(windowSeconds, pointsPerTriple, multipliers);
        break;
      }
      case 'lockedShelves': {
        if (mechanic.shelves.length === 0) fail('lockedShelves needs at least one shelf');
        for (const { shelf, triplesRequired } of mechanic.shelves) {
          if (!Number.isInteger(shelf) || shelf < 0 || shelf >= shelves.length) fail(`locked shelf ${shelf} does not exist`);
          if (unlockAt[shelf] !== null) fail(`shelf ${shelf} is locked twice`);
          if (!Number.isInteger(triplesRequired) || triplesRequired < 1 || triplesRequired > totalTriples) {
            fail(`shelf ${shelf} needs between 1 and ${totalTriples} triples to unlock`);
          }
          unlockAt[shelf] = triplesRequired;
        }
        break;
      }
      case 'roamingBlocker': {
        const { start, seed } = mechanic;
        const removeAtCombo = mechanic.removeAtCombo ?? ROAMING_BLOCKER_DEFAULTS.removeAtCombo;
        if (!Number.isInteger(seed)) fail('blocker seed must be an integer');
        if (!Number.isInteger(removeAtCombo) || removeAtCombo < 2) fail('blocker removeAtCombo must be at least 2');
        const front = shelves[start.shelf]?.layers[0];
        if (!front || !Number.isInteger(start.slot) || start.slot < 0 || start.slot >= front.length) {
          fail('blocker starts outside the board');
        }
        if (front![start.slot] !== null) fail('blocker must start on an empty slot');
        blocker = { at: { shelf: start.shelf, slot: start.slot }, rngState: seed, removeAtCombo };
        break;
      }
      case 'conveyor': {
        const stacks = (trackItems[0] ?? []) as readonly (readonly Item[])[];
        if (stacks.length < 1 || stacks.length > CONVEYOR_LIMITS.maxSlots) {
          fail(`conveyor needs between 1 and ${CONVEYOR_LIMITS.maxSlots} slots`);
        }
        if (stacks.every((stack) => stack.length === 0)) fail('conveyor needs at least one item');
        checkSpeed(mechanic.speed, 'conveyor');
        tracks.push(toTrack('horizontal', mechanic.speed, stacks));
        break;
      }
      case 'tracks': {
        const count = mechanic.tracks.length;
        if (count < 1 || count > CONVEYOR_LIMITS.maxTracks) fail(`tracks needs between 1 and ${CONVEYOR_LIMITS.maxTracks} tracks`);
        mechanic.tracks.forEach((definition, t) => {
          const carriers = trackItems[t] ?? [];
          if (definition.orientation !== 'horizontal' && definition.orientation !== 'vertical') {
            fail(`track ${t} must be horizontal or vertical`);
          }
          if (carriers.length < 1 || carriers.length > CONVEYOR_LIMITS.maxSlots) {
            fail(`track ${t} needs between 1 and ${CONVEYOR_LIMITS.maxSlots} carriers`);
          }
          const shelfCarriers = carriers.filter((c): c is { readonly shelf: number } => 'shelf' in c);
          if (shelfCarriers.length > 0 && shelfCarriers.length !== carriers.length) {
            fail(`track ${t} must carry only stacks or only shelves`);
          }
          if (shelfCarriers.length > 0) {
            if (definition.orientation !== 'vertical') fail(`track ${t} carries shelves, so it must be vertical`);
            for (const { shelf } of shelfCarriers) {
              if (!Number.isInteger(shelf) || shelf < 0 || shelf >= shelves.length) fail(`track ${t} carries shelf ${shelf}, which does not exist`);
            }
          } else if ((carriers as readonly (readonly Item[])[]).some((stack) => stack.length > CONVEYOR_LIMITS.maxStackDepth)) {
            fail(`track ${t} stacks hold at most ${CONVEYOR_LIMITS.maxStackDepth} items`);
          }
          checkSpeed(definition.speed, `track ${t}`);
          tracks.push(toTrack(definition.orientation, definition.speed, carriers));
        });
        const useful = tracks.some((track) => track.carriers.some((c) => c.kind === 'shelf' || c.stack.length > 0));
        if (!useful) fail('tracks need at least one item');
        break;
      }
    }
  }

  if (blocker && unlockAt[blocker.at.shelf] !== null) fail('blocker cannot start on a locked shelf');
  if (unlockAt.every((value) => value !== null)) fail('at least one shelf must start unlocked');
  return { unlockAt, combo, blocker, tracks };
}

function newCombo(windowSeconds: number, pointsPerTriple: number, multipliers: readonly number[]): ComboState {
  return { combo: 0, maxCombo: 0, windowLeftMs: 0, windowMs: windowSeconds * 1000, pointsPerTriple, multipliers, score: 0 };
}

function toTrack(
  orientation: TrackState['orientation'],
  speed: number,
  carriers: readonly (readonly Item[] | { readonly shelf: number })[],
): TrackState {
  return {
    orientation,
    speed,
    carriers: carriers.map((c) => ('shelf' in c ? { kind: 'shelf', shelf: c.shelf } : { kind: 'stack', stack: c })),
  };
}

/** Whether a track carries shelves (rather than stacks). */
export function carriesShelves(track: TrackState): boolean {
  return track.carriers.some((c) => c.kind === 'shelf');
}

/**
 * Structure of the board's arrangement. Without a column layout there may be one horizontal track at most
 * (drawn as a strip below the shelves). With one, every shelf and every track is placed in exactly one of up
 * to three columns, and tracks in columns must be vertical. Whether items end up big enough for a finger is
 * checked by the UI layout validator.
 */
function checkLayout(level: LevelDefinition, shelfCount: number, tracks: readonly TrackState[]): void {
  const fail = (message: string): never => {
    throw new LevelError(`${level.id}: ${message}`);
  };
  const layout = level.layout;
  if (!layout) {
    if (tracks.length > 1 || tracks.some((track) => track.orientation !== 'horizontal')) {
      fail('several tracks or vertical tracks need a column layout');
    }
    return;
  }
  if (layout.columns.length < 1 || layout.columns.length > MAX_COLUMNS) fail(`layout needs 1 to ${MAX_COLUMNS} columns`);
  const shelfUses = Array<number>(shelfCount).fill(0);
  const trackUses = Array<number>(tracks.length).fill(0);
  for (const column of layout.columns) {
    if (column.kind === 'shelves') {
      if (column.shelves.length === 0) fail('a shelf column needs at least one shelf');
      for (const shelf of column.shelves) {
        if (!Number.isInteger(shelf) || shelf < 0 || shelf >= shelfCount) fail(`layout uses shelf ${shelf}, which does not exist`);
        shelfUses[shelf]!++;
      }
    } else {
      const track = tracks[column.track];
      if (!track) fail(`layout uses track ${column.track}, which does not exist`);
      if (track!.orientation !== 'vertical') fail(`track ${column.track} is in a column, so it must be vertical`);
      const ofShelves = carriesShelves(track!);
      if (column.kind === 'track' && ofShelves) fail(`track ${column.track} carries shelves: use a shelfTrack column`);
      if (column.kind === 'shelfTrack' && !ofShelves) fail(`track ${column.track} carries stacks: use a track column`);
      trackUses[column.track]!++;
      // The shelves a track carries are placed by it.
      for (const carrier of track!.carriers) if (carrier.kind === 'shelf') shelfUses[carrier.shelf]!++;
    }
  }
  shelfUses.forEach((uses, shelf) => {
    if (uses !== 1) fail(`shelf ${shelf} must appear in exactly one column or shelf track (found ${uses})`);
  });
  trackUses.forEach((uses, track) => {
    if (uses !== 1) fail(`track ${track} must appear in exactly one column (found ${uses})`);
  });
}
