import { carrierOffset, createGame, type GameState, type LevelDefinition } from '../core';
import { computeBoardLayout, shelfLayoutCentred, trackPose, type BoardLayout, type ShelfLayout } from './boardLayout';
import { computeColumnLayout, type ColumnSpec } from './columnLayout';

/** Item size relative to its slot (shelves and tracks alike): items stand close together. */
export const ITEM_FILL = 0.95;

/** Smallest item, in CSS px, that is still comfortable to grab with a finger. */
export const MIN_ITEM_PX = 36;

/** A screen every level must fit, and the smallest item allowed on it. */
export interface CheckedScreen {
  readonly width: number;
  readonly height: number;
  readonly minItem: number;
  readonly name: string;
}

/**
 * Screens every level must fit: a phone in portrait, and the window CrazyGames shows games in on a computer
 * (its requirements cite 1080 x 607), both with items of at least MIN_ITEM_PX. A phone held sideways is rare,
 * so it may go a little smaller: 32 px still keeps five shelves per column within reach.
 */
export const CHECKED_SCREENS: readonly CheckedScreen[] = [
  { width: 390, height: 844, minItem: MIN_ITEM_PX, name: 'phone portrait' },
  { width: 1080, height: 607, minItem: MIN_ITEM_PX, name: 'desktop window' },
  { width: 844, height: 390, minItem: 32, name: 'phone landscape' },
];

/**
 * The board for a level on a screen: its column layout if it declares one, otherwise the automatic grid with
 * the (single, horizontal) track as a strip below.
 */
export function layoutForLevel(level: LevelDefinition, state: GameState, width: number, height: number): BoardLayout {
  // Score and combo are shown in every level.
  const withStatusRow = true;
  if (!level.layout) {
    return computeBoardLayout(width, height, level.shelves.length, 3, withStatusRow, state.tracks[0]?.carriers.length ?? 0);
  }
  const columns: ColumnSpec[] = level.layout.columns.map((column): ColumnSpec => {
    if (column.kind === 'shelves') return column;
    const track = state.tracks[column.track]!;
    if (column.kind === 'shelfTrack') {
      return { kind: 'shelfTrack', track: column.track, shelves: track.carriers.map((c) => (c.kind === 'shelf' ? c.shelf : -1)) };
    }
    return { kind: 'track', track: column.track, slots: track.carriers.length };
  });
  return computeColumnLayout(width, height, columns, level.shelves.length, state.tracks.length, withStatusRow);
}

export function itemSize(layout: BoardLayout): number {
  return layout.slotSize * ITEM_FILL;
}

/**
 * Rejects a level whose items would be smaller than allowed on any of the CHECKED_SCREENS.
 * Kept in the UI layer because it depends on how boards are drawn, not on the rules.
 */
export function validateLevelLayout(level: LevelDefinition): void {
  const state = createGame(level);
  for (const { width, height, minItem } of CHECKED_SCREENS) {
    const size = itemSize(layoutForLevel(level, state, width, height));
    if (size < minItem) {
      throw new Error(`${level.id}: items would be ${size.toFixed(1)} px on a ${width}x${height} screen (minimum ${minItem} px)`);
    }
  }
}

/** A board as it is right now: shelves riding tracks at their current place, and how visible each shelf is. */
export interface LiveBoard {
  readonly layout: BoardLayout;
  /** 1 for fixed shelves; moving shelves fade out at the ends of their track's loop. */
  readonly shelfAlpha: readonly number[];
  /** Which shelves ride a track. */
  readonly moving: readonly boolean[];
}

/**
 * Places the shelves riding tracks where they are at the state's track time (fixed shelves are untouched).
 * Pure: the scene calls it every frame and uses the result for drawing, hit tests and drop targets alike.
 */
export function liveBoard(layout: BoardLayout, state: GameState): LiveBoard {
  const shelfAlpha = layout.shelves.map(() => 1);
  const moving = layout.shelves.map(() => false);
  let shelves: ShelfLayout[] | null = null;
  state.tracks.forEach((track, t) => {
    const trackLayout = layout.tracks[t];
    if (!trackLayout) return;
    track.carriers.forEach((carrier, c) => {
      if (carrier.kind !== 'shelf') return;
      const pose = trackPose(trackLayout, carrierOffset(track, c, state.trackTimeMs));
      shelves ??= layout.shelves.slice();
      shelves[carrier.shelf] = shelfLayoutCentred(pose.x, pose.y, layout.slotSize);
      shelfAlpha[carrier.shelf] = pose.alpha;
      moving[carrier.shelf] = true;
    });
  });
  return { layout: shelves ? { ...layout, shelves } : layout, shelfAlpha, moving };
}
