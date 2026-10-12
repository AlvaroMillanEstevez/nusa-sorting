import {
  GAP,
  hudArea,
  shelfLayoutCentred,
  MARGIN,
  MAX_SLOT_SIZE,
  shelfHeightUnits,
  slotAspect,
  SHELF_WIDTH_UNITS,
  shelfLayoutAt,
  type BoardLayout,
  type ShelfLayout,
  type TrackLayout,
} from './boardLayout';

/** A column as the layout needs it: shelves (by index, top to bottom), or a vertical track with K carriers. */
export type ColumnSpec =
  | { readonly kind: 'shelves'; readonly shelves: readonly number[] }
  | { readonly kind: 'track'; readonly track: number; readonly slots: number }
  /** A vertical track of shelves; `shelves` are the carried shelves in carrier order. */
  | { readonly kind: 'shelfTrack'; readonly track: number; readonly shelves: readonly number[] };

// Sizes in slots.
/** Width of a vertical track column: a carrier plus its rail. */
export const TRACK_COLUMN_UNITS = 1.2;
/** Space between columns: wide enough for a shelf track's bamboo pole. */
export const COLUMN_GAP_UNITS = 0.22;
/** Columns may run closer to the screen edges than the automatic grid. */
const SIDE_MARGIN = 8;


/** Room at each end of a vertical track for its roller (half a slot). */
const ROLLER_UNITS = 0.5;
/** Distance between shelves riding a track, in slots: a shelf and the gap to the next one. */
export const shelfTrackPitchUnits = (): number => shelfHeightUnits() + GAP;

function columnWidthUnitsOf(column: ColumnSpec): number {
  return column.kind === 'track' ? TRACK_COLUMN_UNITS : SHELF_WIDTH_UNITS(3);
}

function columnHeightUnits(column: ColumnSpec): number {
  if (column.kind === 'track') return column.slots * slotAspect() + ROLLER_UNITS * 2;
  if (column.kind === 'shelfTrack') return column.shelves.length * shelfTrackPitchUnits() + ROLLER_UNITS * 2;
  const n = column.shelves.length;
  return n * shelfHeightUnits() + (n - 1) * GAP;
}

/**
 * Lays out up to three columns side by side, centred, with one slot size for every shelf and track so items
 * look the same everywhere. The slot size is the largest that fits the widest row and the tallest column.
 * Each column is centred vertically; a vertical track's loop is K slots tall, plus half a slot at each end for
 * its rollers.
 */
export function computeColumnLayout(
  width: number,
  height: number,
  columns: readonly ColumnSpec[],
  shelfCount: number,
  trackCount: number,
  withStatusRow = false,
  noHud = false,
): BoardLayout {
  const { hud, hudRowHeight, statusRow, statusInline } = hudArea(width, height, withStatusRow, noHud);
  const areaTop = hud.height + MARGIN;
  const areaHeight = Math.max(1, height - hud.height - MARGIN * 2);

  const widthUnits = columns.reduce((sum, c) => sum + columnWidthUnitsOf(c), 0) + (columns.length - 1) * COLUMN_GAP_UNITS;
  const heightUnits = Math.max(...columns.map(columnHeightUnits));
  const s = Math.min(MAX_SLOT_SIZE, (width - SIDE_MARGIN * 2) / widthUnits, areaHeight / heightUnits);

  const shelves: ShelfLayout[] = Array<ShelfLayout>(shelfCount);
  const tracks: TrackLayout[] = Array<TrackLayout>(trackCount);
  let x = (width - widthUnits * s) / 2;
  for (const column of columns) {
    const columnWidth = columnWidthUnitsOf(column) * s;
    const top = areaTop + (areaHeight - columnHeightUnits(column) * s) / 2;
    if (column.kind === 'shelves') {
      column.shelves.forEach((shelf, i) => {
        shelves[shelf] = shelfLayoutAt(x, top + i * (shelfHeightUnits() + GAP) * s, s);
      });
    } else if (column.kind === 'shelfTrack') {
      // Shelves ride the track centred on it; layout.shelves holds where each is at time 0 (its carrier index).
      const pitch = shelfTrackPitchUnits() * s;
      const loopStart = top + ROLLER_UNITS * s;
      const cross = x + columnWidth / 2;
      tracks[column.track] = {
        orientation: 'vertical',
        rect: { x, y: loopStart, width: columnWidth, height: column.shelves.length * pitch },
        loopStart,
        pitch,
        slots: column.shelves.length,
        cross,
        slotSize: s,
      };
      column.shelves.forEach((shelf, c) => {
        shelves[shelf] = shelfLayoutCentred(cross, loopStart + c * pitch, s);
      });
    } else {
      const cross = x + columnWidth / 2;
      const loopStart = top + ROLLER_UNITS * s;
      // Carriers are a slot's height apart, so tall items standing on them never reach the next one.
      const pitch = s * slotAspect();
      tracks[column.track] = {
        orientation: 'vertical',
        rect: { x, y: loopStart, width: columnWidth, height: column.slots * pitch },
        loopStart,
        pitch,
        slots: column.slots,
        cross,
        slotSize: s,
      };
    }
    x += columnWidth + COLUMN_GAP_UNITS * s;
  }
  return { slotSize: s, hud, hudRowHeight, statusRow, statusInline, belt: null, tracks, shelves };
}
