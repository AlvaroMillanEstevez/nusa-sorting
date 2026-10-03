import type { Rect } from './boardLayout';

export interface LevelGrid {
  /** Fixed bar at the top (title and back button); the grid scrolls under it. */
  readonly header: Rect;
  /** Tile rects in content coordinates: y is measured from the top of the scrolling area. */
  readonly tiles: readonly Rect[];
  readonly cols: number;
  readonly tileSize: number;
  /** Height of the visible scrolling area. */
  readonly viewHeight: number;
  readonly contentHeight: number;
  /** Largest scroll offset; 0 when everything fits. */
  readonly maxScroll: number;
}

const MARGIN = 16;
const GAP = 12;
/** Comfortable finger target. */
const MIN_TILE = 72;
const MAX_TILE = 120;
const MAX_COLS = 8;

/** Lays out `count` level tiles in as many columns as fit the width; extra rows scroll vertically. */
export function computeLevelGrid(width: number, height: number, count: number): LevelGrid {
  const headerHeight = Math.round(Math.min(80, Math.max(56, height * 0.1)));
  const header: Rect = { x: 0, y: 0, width, height: headerHeight };
  const usable = Math.max(1, width - MARGIN * 2);
  const cols = Math.max(1, Math.min(MAX_COLS, Math.floor((usable + GAP) / (MIN_TILE + GAP))));
  const tileSize = Math.min(MAX_TILE, (usable - (cols - 1) * GAP) / cols);
  const gridWidth = cols * tileSize + (cols - 1) * GAP;
  const left = (width - gridWidth) / 2;

  const tiles: Rect[] = Array.from({ length: count }, (_, i) => ({
    x: left + (i % cols) * (tileSize + GAP),
    y: MARGIN + Math.floor(i / cols) * (tileSize + GAP),
    width: tileSize,
    height: tileSize,
  }));
  const rows = Math.ceil(count / cols);
  const contentHeight = MARGIN * 2 + rows * tileSize + Math.max(0, rows - 1) * GAP;
  const viewHeight = Math.max(1, height - headerHeight);
  return { header, tiles, cols, tileSize, viewHeight, contentHeight, maxScroll: Math.max(0, contentHeight - viewHeight) };
}

export function clampScroll(grid: LevelGrid, scroll: number): number {
  return Math.min(grid.maxScroll, Math.max(0, scroll));
}

/** Scroll offset that brings a tile roughly to the middle of the view. */
export function scrollToShow(grid: LevelGrid, index: number): number {
  const tile = grid.tiles[index];
  if (!tile) return 0;
  return clampScroll(grid, tile.y + tile.height / 2 - grid.viewHeight / 2);
}

/** Index of the tile under a screen point for the given scroll, or null (header and gaps included). */
export function tileAt(grid: LevelGrid, x: number, y: number, scroll: number): number | null {
  if (y < grid.header.height) return null;
  const contentY = y - grid.header.height + scroll;
  const index = grid.tiles.findIndex(
    (t) => x >= t.x && x <= t.x + t.width && contentY >= t.y && contentY <= t.y + t.height,
  );
  return index === -1 ? null : index;
}
