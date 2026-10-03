import { isBlocked } from './game';
import { SLOTS_PER_LAYER, type GameState, type ItemType, type Layer, type Shelf } from './types';

/** Level data: shelves[shelf][layer][slot], layer 0 is the front. null is an empty slot. */
export interface LevelDefinition {
  readonly id: string;
  /** Time to clear the level; omit for an untimed level. */
  readonly timeLimitSeconds?: number;
  readonly shelves: readonly (readonly (readonly (ItemType | null)[])[])[];
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

  for (const [type, count] of counts) {
    if (count % 3 !== 0) throw new LevelError(`${level.id}: item "${type}" appears ${count} times, not a multiple of 3`);
  }

  const state: GameState = {
    shelves,
    status: counts.size === 0 ? 'won' : 'playing',
    loseReason: null,
    timeLeftMs: timeLimitSeconds === undefined ? null : timeLimitSeconds * 1000,
  };
  if (isBlocked(state)) throw new LevelError(`${level.id}: level starts blocked`);
  return state;
}
