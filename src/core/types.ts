/** Identifier of an item kind; three of the same kind in a front layer clear. */
export type ItemType = string;

export interface Item {
  readonly id: number;
  readonly type: ItemType;
}

export type Slot = Item | null;

/** Number of slots in every layer. */
export const SLOTS_PER_LAYER = 3;

export type Layer = readonly Slot[];

export interface Shelf {
  /** layers[0] is the front (interactive) layer; higher indices are further back. */
  readonly layers: readonly Layer[];
}

export type GameStatus = 'playing' | 'won' | 'lost';

export type LoseReason = 'timeUp' | 'blocked';

/** A front-layer slot. */
export interface SlotRef {
  readonly shelf: number;
  readonly slot: number;
}

/** Combo and score tracking; present only when the level has the combo mechanic. */
export interface ComboState {
  /** Triples cleared in the current chain; 0 when there is no chain. */
  readonly combo: number;
  /** Highest combo reached this level. */
  readonly maxCombo: number;
  /** Time left before the chain breaks; 0 when there is no chain. */
  readonly windowLeftMs: number;
  readonly windowMs: number;
  readonly pointsPerTriple: number;
  /** multipliers[n - 1] applies to the n-th triple of a chain; the last entry applies beyond the table. */
  readonly multipliers: readonly number[];
  readonly score: number;
}

/** A front slot that cannot receive items; present only with the roaming blocker mechanic. */
export interface BlockerState {
  readonly at: SlotRef;
  /** Seeded generator state used to pick the next slot deterministically. */
  readonly rngState: number;
  /** Reaching this combo removes the blocker for the rest of the level. */
  readonly removeAtCombo: number;
}

export interface GameState {
  readonly shelves: readonly Shelf[];
  readonly status: GameStatus;
  /** Set only when status is 'lost'. */
  readonly loseReason: LoseReason | null;
  /** Remaining time, or null if the level has no time limit. */
  readonly timeLeftMs: number | null;
  /** Triples cleared since the level started. */
  readonly triplesCleared: number;
  /** Per shelf: triples needed to unlock it, or null if it never was locked. Locked while triplesCleared < value. */
  readonly unlockAt: readonly (number | null)[];
  readonly combo: ComboState | null;
  readonly blocker: BlockerState | null;
}

export interface Position {
  readonly shelf: number;
  readonly layer: number;
  readonly slot: number;
}

export type InvalidMoveReason =
  | 'invalidPosition'
  | 'samePosition'
  | 'notFrontLayer'
  | 'sourceEmpty'
  | 'shelfFull'
  | 'targetOccupied'
  | 'shelfLocked'
  | 'slotBlocked'
  | 'gameOver';

export type GameEvent =
  | { readonly kind: 'moved'; readonly itemId: number; readonly from: Position; readonly to: Position }
  | {
      readonly kind: 'tripleCleared';
      readonly shelf: number;
      readonly itemType: ItemType;
      readonly itemIds: readonly number[];
    }
  | { readonly kind: 'layerAdvanced'; readonly shelf: number; readonly remainingLayers: number }
  | { readonly kind: 'won' }
  | { readonly kind: 'lost'; readonly reason: LoseReason }
  | { readonly kind: 'comboChanged'; readonly combo: number; readonly windowMs: number }
  | { readonly kind: 'scoreChanged'; readonly score: number; readonly delta: number; readonly shelf: number }
  | { readonly kind: 'shelfUnlocked'; readonly shelf: number }
  | { readonly kind: 'blockerMoved'; readonly from: SlotRef; readonly to: SlotRef }
  | { readonly kind: 'blockerRemoved'; readonly at: SlotRef };

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: InvalidMoveReason };

export interface TickResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
