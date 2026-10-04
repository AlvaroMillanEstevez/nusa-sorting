import { createGame, type GameState, type LevelDefinition } from '../core';
import { computeBoardLayout, type BoardLayout } from './boardLayout';
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
  const withStatusRow = state.combo !== null;
  if (!level.layout) {
    return computeBoardLayout(width, height, level.shelves.length, 3, withStatusRow, state.tracks[0]?.carriers.length ?? 0);
  }
  const columns: ColumnSpec[] = level.layout.columns.map((column) =>
    column.kind === 'shelves'
      ? column
      : { kind: 'track', track: column.track, slots: state.tracks[column.track]!.carriers.length },
  );
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
