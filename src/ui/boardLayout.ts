export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ShelfLayout {
  readonly rect: Rect;
  /** Centers of the front-layer slots. */
  readonly slots: readonly Point[];
  /** Centers of the back-layer slots (peeking above the front). */
  readonly backSlots: readonly Point[];
}

export interface BoardLayout {
  /** Size of one slot in px; items are drawn slightly smaller. */
  readonly slotSize: number;
  readonly hud: Rect;
  readonly shelves: readonly ShelfLayout[];
}

// Shelf geometry in units of slotSize.
const SIDE_PAD = 0.15;
const BACK_PEEK = 0.4;
const PLANK = 0.2;
const GAP = 0.35;
const MARGIN = 16;
const MAX_SLOT_SIZE = 110;

export const SHELF_WIDTH_UNITS = (slotsPerLayer: number) => slotsPerLayer + SIDE_PAD * 2;
export const SHELF_HEIGHT_UNITS = BACK_PEEK + 1 + PLANK;
/** Back-layer items are drawn at this fraction of the front-layer size. */
export const BACK_SCALE = 0.8;

export function hudHeight(height: number): number {
  return Math.round(Math.min(72, Math.max(44, height * 0.08)));
}

/**
 * Lays out shelves in the grid (columns × rows) that gives the largest slots for the viewport,
 * so it works in both portrait and landscape. Incomplete last rows are centered.
 */
export function computeBoardLayout(width: number, height: number, shelfCount: number, slotsPerLayer = 3): BoardLayout {
  const hud: Rect = { x: 0, y: 0, width, height: hudHeight(height) };
  const area: Rect = {
    x: MARGIN,
    y: hud.height + MARGIN,
    width: Math.max(1, width - MARGIN * 2),
    height: Math.max(1, height - hud.height - MARGIN * 2),
  };
  const shelfW = SHELF_WIDTH_UNITS(slotsPerLayer);
  const shelfH = SHELF_HEIGHT_UNITS;

  let best = { cols: 1, rows: shelfCount, size: 0 };
  for (let cols = 1; cols <= Math.max(1, shelfCount); cols++) {
    const rows = Math.ceil(shelfCount / cols);
    const size = Math.min(
      area.width / (cols * shelfW + (cols - 1) * GAP),
      area.height / (rows * shelfH + (rows - 1) * GAP),
    );
    if (size > best.size) best = { cols, rows, size };
  }

  const s = Math.min(MAX_SLOT_SIZE, best.size);
  const gridH = best.rows * shelfH * s + (best.rows - 1) * GAP * s;
  const top = area.y + (area.height - gridH) / 2;

  const shelves: ShelfLayout[] = [];
  for (let i = 0; i < shelfCount; i++) {
    const row = Math.floor(i / best.cols);
    const col = i % best.cols;
    const inRow = Math.min(best.cols, shelfCount - row * best.cols);
    const rowW = inRow * shelfW * s + (inRow - 1) * GAP * s;
    const left = area.x + (area.width - rowW) / 2;

    const rect: Rect = {
      x: left + col * (shelfW + GAP) * s,
      y: top + row * (shelfH + GAP) * s,
      width: shelfW * s,
      height: shelfH * s,
    };
    const frontY = rect.y + (BACK_PEEK + 0.5) * s;
    const xs = Array.from({ length: slotsPerLayer }, (_, j) => rect.x + (SIDE_PAD + j + 0.5) * s);
    shelves.push({
      rect,
      slots: xs.map((x) => ({ x, y: frontY })),
      backSlots: xs.map((x) => ({ x, y: frontY - BACK_PEEK * s })),
    });
  }

  return { slotSize: s, hud, shelves };
}

/** Index of the shelf containing the point (with half a gap of tolerance), or -1. */
export function shelfAt(layout: BoardLayout, x: number, y: number): number {
  const tolerance = (GAP * layout.slotSize) / 2;
  return layout.shelves.findIndex(
    ({ rect }) =>
      x >= rect.x - tolerance &&
      x <= rect.x + rect.width + tolerance &&
      y >= rect.y - tolerance &&
      y <= rect.y + rect.height + tolerance,
  );
}

/** Index of the slot whose column is horizontally closest to x. */
export function nearestSlot(shelf: ShelfLayout, x: number): number {
  let best = 0;
  shelf.slots.forEach((slot, i) => {
    if (Math.abs(slot.x - x) < Math.abs(shelf.slots[best]!.x - x)) best = i;
  });
  return best;
}

/** Free slot closest to x, or undefined if none of the candidates is free. */
export function nearestFreeSlot(shelf: ShelfLayout, freeSlots: readonly number[], x: number): number | undefined {
  let best: number | undefined;
  for (const i of freeSlots) {
    const slot = shelf.slots[i];
    if (!slot) continue;
    if (best === undefined || Math.abs(slot.x - x) < Math.abs(shelf.slots[best]!.x - x)) best = i;
  }
  return best;
}
