import { carrierOffset, createGame, type GameState, type LevelDefinition } from '../core';
import { computeBoardLayout, shelfLayoutCentred, trackPose, type BoardLayout, type ShelfLayout } from './boardLayout';
import { computeColumnLayout, type ColumnSpec } from './columnLayout';

/** Item size relative to its slot (shelves and tracks alike). */
export const ITEM_FILL = 0.86;

/** Smallest item, in CSS px, that is still comfortable to grab with a finger. */
export const MIN_ITEM_PX = 36;

/** Screens every level must fit with items of at least MIN_ITEM_PX: a phone in portrait and in landscape. */
export const CHECKED_SCREENS: readonly (readonly [number, number])[] = [
  [390, 844],
  [844, 390],
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
 * Rejects a level whose items would be smaller than MIN_ITEM_PX on a phone in portrait or landscape.
 * Kept in the UI layer because it depends on how boards are drawn, not on the rules.
 */
export function validateLevelLayout(level: LevelDefinition): void {
  const state = createGame(level);
  for (const [width, height] of CHECKED_SCREENS) {
    const size = itemSize(layoutForLevel(level, state, width, height));
    if (size < MIN_ITEM_PX) {
      throw new Error(
        `${level.id}: items would be ${size.toFixed(1)} px on a ${width}x${height} screen (minimum ${MIN_ITEM_PX} px)`,
      );
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
