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

/**
 * Why a level was lost: the clock ran out, the board has no usable space left, or it is stuck (space is left but
 * no sequence of moves can ever clear a triple or bring a layer forward; see canProgress).
 */
export type LoseReason = 'timeUp' | 'blocked' | 'stuck';

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
 * next one moves up. On a track with speed 0 the carriers stay put: fixed one-slot stacks.
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

/** A conveyor: a loop of carriers moving at constant speed along one axis; with speed 0, a row of fixed stacks. */
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

/**
 * A food type on a countdown (the 'fresh' mechanic, "basi" when it spoils): every player move takes one off, and
 * at 0 every item of the type, wherever it is, spoils. Its triples still clear, but score nothing and break the
 * combo; cleared while fresh they score a small bonus.
 */
export interface FreshState {
  readonly type: ItemType;
  /** Player moves left before it spoils; it stops counting once the type is gone from the board. */
  readonly movesLeft: number;
  readonly spoiled: boolean;
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
  /**
   * False until the player's first interaction with the board (see startClock): until then no game time
   * passes, so the level can be studied before it starts. The timer, tracks and combo window all wait.
   */
  readonly clockStarted: boolean;
  /** Game time during which the clock stays still (the freeze booster); 0 when it runs. */
  readonly frozenMs: number;
  /**
   * Per shelf: true for a shelf that closes for good once it is empty (front empty, no layers behind); see the
   * 'closingShelves' mechanic. Fixed by the level.
   */
  readonly closesWhenEmpty: readonly boolean[];
  /** Per shelf: true once it has closed. A closed shelf is empty and takes nothing any more. */
  readonly closed: readonly boolean[];
  /** Food types on a countdown (see FreshState); empty without the 'fresh' mechanic. */
  readonly fresh: readonly FreshState[];
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
  /** The target shelf has closed for good (see GameState.closed). */
  | 'shelfClosed'
  | 'noTrack'
  | 'carrierEmpty'
  | 'alreadyHolding'
  | 'nothingHeld'
  | 'gameOver'
  /** Boosters: freezing an untimed clock, no visible item to target, no valid shuffle found. */
  | 'untimed'
  | 'noTarget'
  | 'noShuffle';

export type GameEvent =
  | { readonly kind: 'moved'; readonly itemId: number; readonly from: Position; readonly to: Position }
  | {
      readonly kind: 'tripleCleared';
      readonly shelf: number;
      readonly itemType: ItemType;
      readonly itemIds: readonly number[];
      /** Taken away by the "remove a triple" booster: it counts as a triple but scores nothing. */
      readonly byBooster?: true;
      /** Its type was on a countdown: still fresh (bonus points) or spoiled (no points, combo broken). */
      readonly freshness?: 'fresh' | 'spoiled';
    }
  /** A fresh food type ran out of moves: every item of it is spoiled now. */
  | { readonly kind: 'spoiled'; readonly itemType: ItemType }
  | { readonly kind: 'layerAdvanced'; readonly shelf: number; readonly remainingLayers: number }
  | { readonly kind: 'won' }
  | { readonly kind: 'clockFrozen'; readonly ms: number }
  | { readonly kind: 'shuffled' }
  | { readonly kind: 'timeAdded'; readonly ms: number }
  /** Points for the time left when a timed level is won, already added to the score. */
  | { readonly kind: 'timeBonus'; readonly seconds: number; readonly points: number; readonly score: number }
  | { readonly kind: 'lost'; readonly reason: LoseReason }
  | { readonly kind: 'comboChanged'; readonly combo: number; readonly windowMs: number }
  | { readonly kind: 'scoreChanged'; readonly score: number; readonly delta: number; readonly shelf: number }
  | { readonly kind: 'shelfUnlocked'; readonly shelf: number }
  /** A shelf that closes when empty has just emptied, and is closed for good. */
  | { readonly kind: 'shelfClosed'; readonly shelf: number }
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
