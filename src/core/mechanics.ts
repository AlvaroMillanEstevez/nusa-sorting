import type { SlotRef } from './types';

/**
 * Optional rules a level can switch on. A level without mechanics plays exactly like the base game.
 * Each kind may appear at most once per level.
 */
export type MechanicDefinition =
  | ComboMechanic
  | LockedShelvesMechanic
  | RoamingBlockerMechanic
  | ConveyorMechanic
  | TracksMechanic;

/** Every triple scores; triples cleared within the window of the previous one grow a combo multiplier. */
export interface ComboMechanic {
  readonly kind: 'combo';
  /** Seconds after a triple during which the next one extends the combo. Default 5. */
  readonly windowSeconds?: number;
  /** Base points per triple. Default 100. */
  readonly pointsPerTriple?: number;
  /** multipliers[n - 1] applies to the n-th triple of a chain; the last entry applies beyond. */
  readonly multipliers?: readonly number[];
}

/** Shelves that start locked and open after a number of triples counted from the level start. */
export interface LockedShelvesMechanic {
  readonly kind: 'lockedShelves';
  readonly shelves: readonly { readonly shelf: number; readonly triplesRequired: number }[];
}

/**
 * One empty front slot is blocked. After each triple it jumps to another empty slot, picked
 * deterministically from `seed`. Reaching `removeAtCombo` removes it. Requires the combo mechanic.
 */
export interface RoamingBlockerMechanic {
  readonly kind: 'roamingBlocker';
  readonly start: SlotRef;
  readonly seed: number;
  /** Default 7. */
  readonly removeAtCombo?: number;
}

/**
 * A horizontal conveyor belt: a loop of single slots moving at constant speed. Items can only be taken
 * from it, never put on it, and no triples form on it. The number of slots K is `slots.length`.
 */
export interface ConveyorMechanic {
  readonly kind: 'conveyor';
  /** Belt contents, one entry per slot (null = empty). These items count for the multiple-of-3 rule. */
  readonly slots: readonly (string | null)[];
  /** Belt slots per second; positive moves right, negative left. */
  readonly speed: number;
}

/**
 * One or more conveyor tracks, horizontal or vertical, each with its own speed and direction. Every carrier
 * is a pick-only slot holding a stack of items, top first. `conveyor` is the single-track shorthand used by
 * levels 8 and 9; a level uses one or the other.
 */
export interface TracksMechanic {
  readonly kind: 'tracks';
  readonly tracks: readonly TrackDefinition[];
}

export interface TrackDefinition {
  readonly orientation: 'horizontal' | 'vertical';
  /** Carriers per second; positive moves right or down, negative left or up. */
  readonly speed: number;
  /** One stack per carrier, top item first; [] is an empty carrier. K is `carriers.length`. */
  readonly carriers: readonly (readonly string[])[];
}

export const CONVEYOR_LIMITS = {
  maxSlots: 12,
  maxSpeed: 4,
  maxTracks: 4,
  maxStackDepth: 5,
} as const;

export const COMBO_DEFAULTS = {
  windowSeconds: 5,
  pointsPerTriple: 100,
  multipliers: [1, 1.5, 2, 2.5, 3, 4, 5],
} as const;

export const ROAMING_BLOCKER_DEFAULTS = {
  removeAtCombo: 7,
} as const;
