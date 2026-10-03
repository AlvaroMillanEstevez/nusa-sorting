import type { SlotRef } from './types';

/**
 * Optional rules a level can switch on. A level without mechanics plays exactly like the base game.
 * Each kind may appear at most once per level.
 */
export type MechanicDefinition = ComboMechanic | LockedShelvesMechanic | RoamingBlockerMechanic;

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

export const COMBO_DEFAULTS = {
  windowSeconds: 5,
  pointsPerTriple: 100,
  multipliers: [1, 1.5, 2, 2.5, 3, 4, 5],
} as const;

export const ROAMING_BLOCKER_DEFAULTS = {
  removeAtCombo: 7,
} as const;
