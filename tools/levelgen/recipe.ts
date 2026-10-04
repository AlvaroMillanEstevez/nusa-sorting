/**
 * What the level generator is asked for. A recipe and a seed always give the same level.
 */

/** A column of a column layout: fixed shelves, a vertical track of stacks, or nothing else for now. */
export type ColumnRecipe =
  | { readonly kind: 'shelves'; readonly count: number }
  | { readonly kind: 'track'; readonly speed: number; readonly carriers: number };

export interface TrackRecipe {
  readonly speed: number;
  readonly carriers: number;
}

export interface StackRecipe {
  /** Items per non-empty stack, inclusive range. */
  readonly depth: readonly [number, number];
  /** Carriers left empty on each track. */
  readonly empty: number;
}

export interface LevelRecipe {
  /** Position in the game (1-based) and the level's id. */
  readonly number: number;
  readonly id: string;
  /** One line on what the level is for, written into the level file. */
  readonly purpose: string;
  readonly seed: number;

  /** 'grid': the automatic layout (with an optional horizontal belt below); otherwise columns, left to right. */
  readonly layout: 'grid' | readonly ColumnRecipe[];
  /** Number of shelves for the grid layout (column layouts count theirs). */
  readonly shelves?: number;
  /** A horizontal belt of stacks under the grid. */
  readonly belt?: TrackRecipe;
  /** Stacks on every track of the level. */
  readonly stacks?: StackRecipe;

  /**
   * Item types in the level, one triple each: the first `types` of the generator's type order (types.ts), so
   * the level holds exactly 3 × types items.
   */
  readonly types: number;
  /** Shelves with layers behind the front one, and how many layers in all each of them has. */
  readonly backLayers: { readonly shelves: number; readonly layers: readonly [number, number] };
  /** Empty front slots at the start, across the board. Back layers take any other empty slots needed. */
  readonly emptyFront: number;
  /** Locked shelves: triples needed to open each one. */
  readonly locked?: readonly number[];
  /** Combo multipliers, when they differ from the defaults. */
  readonly comboMultipliers?: readonly number[];
  /** Special levels carry a theme. */
  readonly theme?: string;

  /** The item completing a triple is at most this many layers deeper than the first of the three. */
  readonly maxDepth: number;
  /** Triples completable at the start with what is in view and the layer behind it. */
  readonly minStartTriples: number;
  /** Share of simulated games won, inclusive range. */
  readonly winBand: readonly [number, number];
  /**
   * How the time limit is set: the limit that gives a win rate in the band, never less than `slack` times the
   * time 90% of the simulator's wins need. `timeUp` bounds the share of games lost to the clock.
   */
  readonly time: { readonly slack: number; readonly timeUp: readonly [number, number] };
}
