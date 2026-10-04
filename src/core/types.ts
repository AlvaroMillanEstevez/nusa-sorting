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

/** Combo and score tracking. */
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

/** Which way a track runs. Positive speeds move right (horizontal) or down (vertical). */
export type TrackOrientation = 'horizontal' | 'vertical';

/**
 * A pick-only slot on a track holding a stack of items; only the top one (stack[0]) can be taken, then the
 * next one moves up.
 */
export interface StackCarrier {
  readonly kind: 'stack';
  /** Top first; empty when the slot has nothing left. */
  readonly stack: readonly Item[];
}

/**
 * A 3-slot shelf riding the track. It is one of the level's shelves (state.shelves[shelf]), so it follows every
 * shelf rule: take, drop and reorder in its front layer, triples, layers, locks, the roaming blocker and the
 * blocked defeat. The track only decides where it is drawn.
 */
export interface ShelfCarrier {
  readonly kind: 'shelf';
  readonly shelf: number;
}

export type Carrier = StackCarrier | ShelfCarrier;

/** A conveyor: a loop of carriers moving at constant speed along one axis. */
export interface TrackState {
  readonly orientation: TrackOrientation;
  /** Carriers per second; the sign is the direction. */
  readonly speed: number;
  /** Carrier identity is fixed; where each one is drawn depends on the game time (see carrierOffset). */
  readonly carriers: readonly Carrier[];
}

/** A carrier on a track. */
export interface CarrierRef {
  readonly track: number;
  readonly carrier: number;
}

/** An item taken from a track and not placed yet. Its carrier keeps moving, showing what is left under it. */
export interface HeldTrackItem {
  readonly item: Item;
  readonly from: CarrierRef;
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
  /** Combo and score: a base rule of every level (the 'combo' mechanic only tunes window and multipliers). */
  readonly combo: ComboState;
  readonly blocker: BlockerState | null;
  /** Conveyor tracks; empty in levels without one. */
  readonly tracks: readonly TrackState[];
  /** Game time the tracks have run, in ms; it only advances while playing. */
  readonly trackTimeMs: number;
  /** Item taken from a track and not yet placed. */
  readonly held: HeldTrackItem | null;
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
  | 'noTrack'
  | 'carrierEmpty'
  | 'alreadyHolding'
  | 'nothingHeld'
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
  | { readonly kind: 'blockerRemoved'; readonly at: SlotRef }
  | { readonly kind: 'beltItemTaken'; readonly itemId: number; readonly from: CarrierRef }
  | { readonly kind: 'beltItemReturned'; readonly itemId: number; readonly to: CarrierRef }
  | { readonly kind: 'beltItemPlaced'; readonly itemId: number; readonly from: CarrierRef; readonly to: Position };

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: InvalidMoveReason };

export interface TickResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
