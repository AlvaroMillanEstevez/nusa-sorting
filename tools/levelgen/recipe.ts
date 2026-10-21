/**
 * What the level generator is asked for. A recipe and a seed always give the same level.
 */

/** A column of a column layout: fixed shelves, a vertical track of stacks, or nothing else for now. */
export type ColumnRecipe =
  | { readonly kind: 'shelves'; readonly count: number }
  /** A vertical track of stacks; with speed 0, a column of fixed stacks (see `fixedStacks`). */
  | { readonly kind: 'track'; readonly speed: number; readonly carriers: number }
  /** A vertical track of `count` shelves riding it, ordinary shelves of the level in every other way. */
  | { readonly kind: 'shelfTrack'; readonly speed: number; readonly count: number };

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
  /**
   * The candidate of the seed's sequence the shipped level uses, once chosen: the generator then rebuilds that
   * board and only sets its time, so tuning times never changes a board players have seen. Without it, the
   * generator searches from the first candidate.
   */
  readonly candidate?: number;

  /** 'grid': the automatic layout (with an optional horizontal belt below); otherwise columns, left to right. */
  readonly layout: 'grid' | readonly ColumnRecipe[];
  /** Number of shelves for the grid layout (column layouts count theirs). */
  readonly shelves?: number;
  /** A horizontal belt of stacks under the grid. */
  readonly belt?: TrackRecipe;
  /** Stacks on every moving track of the level. */
  readonly stacks?: StackRecipe;
  /** Stacks on tracks of speed 0 (fixed stacks), which may be deeper; `stacks` when not given. */
  readonly fixedStacks?: StackRecipe;
  /** Fixed shelves (not locked, not riding a track) that close for good once emptied. */
  readonly closing?: number;
  /**
   * Fresh foods ("basi", the 'fresh' mechanic), among the level's foods (never cultural objects): one countdown per
   * food, as a share of a typical game's moves (TYPICAL_MOVES_PER_ITEM × items). With `inFront`, they are foods with
   * at least that many copies in a front from the start (3: all in view); without it, any foods, which may start
   * behind other items or in stacks (and maybe spoil unseen). They are added to the board and time found without
   * them, which they never change; `pick` pins which pick of them (see withFresh) the pinned candidate keeps.
   */
  readonly fresh?: { readonly shares: readonly number[]; readonly inFront?: 2 | 3; readonly pick?: number };
  /** Band for the share of fresh triples the casual player clears spoiled. */
  readonly spoiled?: readonly [number, number];

  /**
   * Item types in the level, one triple each: the first `types` of the generator's type order (types.ts), so
   * the level holds exactly 3 × types items.
   */
  readonly types: number;
  /**
   * The exact types, in order, for levels players have already approved: they keep their boards whatever the
   * rotation would choose now. Otherwise the rotation picks them (types.ts).
   */
  readonly fixedTypes?: readonly string[];
  /**
   * Shelves with layers behind the front one, and how many layers in all each of them has. With `total`, the
   * level has exactly that many hidden layers, spread at random over those shelves within the range, so its
   * capacity (and how full its back layers are) is exact.
   */
  readonly backLayers: { readonly shelves: number; readonly layers: readonly [number, number]; readonly total?: number };
  /** Empty front slots at the start, across the board. Back layers take any other empty slots needed. */
  readonly emptyFront: number;
  /** Locked shelves: triples needed to open each one. */
  readonly locked?: readonly number[];
  /**
   * A roaming blocker on one of the empty front slots of an unlocked shelf; a combo of `removeAtCombo`
   * removes it.
   */
  readonly blocker?: { readonly removeAtCombo: number };
  /** Combo multipliers, when they differ from the defaults. */
  readonly comboMultipliers?: readonly number[];
  /** Special levels carry a theme. */
  readonly theme?: string;

  /** The item completing a triple is at most this many layers deeper than the first of the three. */
  readonly maxDepth: number;
  /** Triples completable at the start with what is in view and the layer behind it. */
  readonly minStartTriples: number;
  /**
   * The level shows the first-triple tutorial: every arrangement must have a move from one shelf to another that
   * completes a triple at once, for the tutorial to point at.
   */
  readonly tutorial?: boolean;
  /**
   * Share of games the casual simulated player wins, inclusive range: the level is fair and can be won without
   * help (tools/simulator.ts, CASUAL).
   */
  readonly winBand: readonly [number, number];
  /** Share of games the expert simulated player wins, inclusive range: the level is not trivial (EXPERT). */
  readonly expertBand?: readonly [number, number];
  /**
   * Space pressure for the casual player, inclusive range: the share of its moves made with two free slots or
   * fewer, so that where to put an item is often a real decision.
   */
  readonly pressure?: readonly [number, number];
  /**
   * How the time limit is set: the limit that gives a win rate in the band, never less than `slack` times the
   * time 90% of the simulator's wins need, and never more than four minutes (MAX_TIME). `timeUp` bounds the share
   * of games lost to the clock. `fixed` sets the limit outright (special levels that keep their time); the win
   * band is then only checked. `typical` sets the limit from the board together with a few reshuffles of it, so
   * it suits the level's arrangements rather than one lucky board (see generateArrangements).
   */
  readonly time: {
    readonly slack: number;
    readonly timeUp: readonly [number, number];
    readonly fixed?: number;
    readonly typical?: boolean;
    /**
     * Seconds the limit moves in, 5 by default. A race against the clock (level 10) has a narrow window between
     * too short and too easy, so it uses finer steps.
     */
    readonly step?: number;
  };
}
