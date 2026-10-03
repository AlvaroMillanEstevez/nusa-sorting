import { isBlocked } from './game';
import { COMBO_DEFAULTS, ROAMING_BLOCKER_DEFAULTS, type MechanicDefinition } from './mechanics';
import {
  SLOTS_PER_LAYER,
  type BlockerState,
  type ComboState,
  type GameState,
  type ItemType,
  type Layer,
  type Shelf,
} from './types';

/** Level data: shelves[shelf][layer][slot], layer 0 is the front. null is an empty slot. */
export interface LevelDefinition {
  readonly id: string;
  /** Time to clear the level; omit for an untimed level. */
  readonly timeLimitSeconds?: number;
  readonly shelves: readonly (readonly (readonly (ItemType | null)[])[])[];
  /** Optional rules on top of the base game. Omitted or empty: the level plays exactly like the base game. */
  readonly mechanics?: readonly MechanicDefinition[];
}

export class LevelError extends Error {}

/** Validates a level definition and builds its initial state, giving every item a unique id. */
export function createGame(level: LevelDefinition): GameState {
  if (level.shelves.length === 0) throw new LevelError(`${level.id}: level has no shelves`);
  const { timeLimitSeconds } = level;
  if (timeLimitSeconds !== undefined && !(timeLimitSeconds > 0)) {
    throw new LevelError(`${level.id}: time limit must be positive`);
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

  let totalItems = 0;
  for (const [type, count] of counts) {
    if (count % 3 !== 0) throw new LevelError(`${level.id}: item "${type}" appears ${count} times, not a multiple of 3`);
    totalItems += count;
  }

  const mechanics = parseMechanics(level, shelves, totalItems / 3);
  const state: GameState = {
    shelves,
    status: counts.size === 0 ? 'won' : 'playing',
    loseReason: null,
    timeLeftMs: timeLimitSeconds === undefined ? null : timeLimitSeconds * 1000,
    triplesCleared: 0,
    ...mechanics,
  };
  if (isBlocked(state)) throw new LevelError(`${level.id}: level starts blocked`);
  return state;
}

type MechanicState = Pick<GameState, 'unlockAt' | 'combo' | 'blocker'>;

/** Validates the level's mechanics against its board and builds their initial state. */
function parseMechanics(level: LevelDefinition, shelves: readonly Shelf[], totalTriples: number): MechanicState {
  const fail = (message: string): never => {
    throw new LevelError(`${level.id}: ${message}`);
  };
  const list = level.mechanics ?? [];
  const kinds = new Set(list.map((m) => m.kind));
  if (kinds.size !== list.length) fail('each mechanic may appear only once');

  const unlockAt: (number | null)[] = shelves.map(() => null);
  let combo: ComboState | null = null;
  let blocker: BlockerState | null = null;

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
        combo = {
          combo: 0,
          maxCombo: 0,
          windowLeftMs: 0,
          windowMs: windowSeconds * 1000,
          pointsPerTriple,
          multipliers,
          score: 0,
        };
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
    }
  }

  if (blocker) {
    if (!combo) fail('roamingBlocker requires the combo mechanic (it is removed by reaching a combo)');
    if (unlockAt[blocker.at.shelf] !== null) fail('blocker cannot start on a locked shelf');
  }
  if (unlockAt.every((value) => value !== null)) fail('at least one shelf must start unlocked');
  return { unlockAt, combo, blocker };
}
