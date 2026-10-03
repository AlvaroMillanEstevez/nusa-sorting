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

export interface GameState {
  readonly shelves: readonly Shelf[];
  readonly status: GameStatus;
  /** Set only when status is 'lost'. */
  readonly loseReason: LoseReason | null;
  /** Remaining time, or null if the level has no time limit. */
  readonly timeLeftMs: number | null;
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
  | { readonly kind: 'lost'; readonly reason: LoseReason };

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: InvalidMoveReason };

export interface TickResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}
