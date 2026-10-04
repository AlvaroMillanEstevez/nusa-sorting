import {
  GAP,
  hudHeight,
  MARGIN,
  MAX_SLOT_SIZE,
  SHELF_HEIGHT_UNITS,
  SHELF_WIDTH_UNITS,
  shelfLayoutAt,
  STATUS_ROW,
  type BoardLayout,
  type Rect,
  type ShelfLayout,
  type TrackLayout,
} from './boardLayout';

/** A column as the layout needs it: shelves (by index, top to bottom), or a vertical track with K carriers. */
export type ColumnSpec =
  | { readonly kind: 'shelves'; readonly shelves: readonly number[] }
  | { readonly kind: 'track'; readonly track: number; readonly slots: number };

// Sizes in slots.
/** Width of a vertical track column: a carrier plus its rail. */
export const TRACK_COLUMN_UNITS = 1.2;
/** Space between columns. */
export const COLUMN_GAP_UNITS = 0.3;
/** Columns may run closer to the screen edges than the automatic grid. */
const SIDE_MARGIN = 8;

function columnWidthUnits(column: ColumnSpec): number {
  return column.kind === 'shelves' ? SHELF_WIDTH_UNITS(3) : TRACK_COLUMN_UNITS;
}

function columnHeightUnits(column: ColumnSpec): number {
  if (column.kind === 'track') return column.slots;
  const n = column.shelves.length;
  return n * SHELF_HEIGHT_UNITS + (n - 1) * GAP;
}

/**
 * Lays out up to three columns side by side, centred, with one slot size for every shelf and track so items
 * look the same everywhere. The slot size is the largest that fits the widest row and the tallest column.
 * Each column is centred vertically; a vertical track's loop is K slots tall.
 */
export function computeColumnLayout(
  width: number,
  height: number,
  columns: readonly ColumnSpec[],
  shelfCount: number,
  trackCount: number,
  withStatusRow = false,
): BoardLayout {
  const hudRowHeight = hudHeight(height);
  const statusRow: Rect | null = withStatusRow
    ? { x: 0, y: hudRowHeight, width, height: Math.round(hudRowHeight * STATUS_ROW) }
    : null;
  const hud: Rect = { x: 0, y: 0, width, height: hudRowHeight + (statusRow?.height ?? 0) };
  const areaTop = hud.height + MARGIN;
  const areaHeight = Math.max(1, height - hud.height - MARGIN * 2);

  const widthUnits = columns.reduce((sum, c) => sum + columnWidthUnits(c), 0) + (columns.length - 1) * COLUMN_GAP_UNITS;
  const heightUnits = Math.max(...columns.map(columnHeightUnits));
  const s = Math.min(MAX_SLOT_SIZE, (width - SIDE_MARGIN * 2) / widthUnits, areaHeight / heightUnits);

  const shelves: ShelfLayout[] = Array<ShelfLayout>(shelfCount);
  const tracks: TrackLayout[] = Array<TrackLayout>(trackCount);
  let x = (width - widthUnits * s) / 2;
  for (const column of columns) {
    const columnWidth = columnWidthUnits(column) * s;
    const top = areaTop + (areaHeight - columnHeightUnits(column) * s) / 2;
    if (column.kind === 'shelves') {
      column.shelves.forEach((shelf, i) => {
        shelves[shelf] = shelfLayoutAt(x, top + i * (SHELF_HEIGHT_UNITS + GAP) * s, s);
      });
    } else {
      const cross = x + columnWidth / 2;
      tracks[column.track] = {
        orientation: 'vertical',
        rect: { x, y: top, width: columnWidth, height: column.slots * s },
        loopStart: top,
        pitch: s,
        slots: column.slots,
        cross,
      };
    }
    x += columnWidth + COLUMN_GAP_UNITS * s;
  }
  return { slotSize: s, hud, hudRowHeight, statusRow, belt: null, tracks, shelves };
}
