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

export interface BeltLayout {
  /** The whole strip, including its rollers. */
  readonly rect: Rect;
  /** Left end of the loop; belt offset o (in slots) is drawn at loopX + o * pitch. */
  readonly loopX: number;
  /** Distance between belt slots, in px. */
  readonly pitch: number;
  /** Number of belt slots K; the loop is K * pitch wide. */
  readonly slots: number;
  /** Vertical center of the items. */
  readonly y: number;
}

export interface BoardLayout {
  /** Size of one slot in px; items are drawn slightly smaller. */
  readonly slotSize: number;
  /** Whole HUD area (both rows when there is a status row). */
  readonly hud: Rect;
  /** Height of the main HUD row (level, clock, buttons). */
  readonly hudRowHeight: number;
  /** Second HUD row (score and combo), or null when the level has none. */
  readonly statusRow: Rect | null;
  /** Conveyor strip below the shelves, or null when the level has no belt. */
  readonly belt: BeltLayout | null;
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
/** The status row (score and combo) is this fraction of the main HUD row. */
const STATUS_ROW = 0.75;

export function computeBoardLayout(
  width: number,
  height: number,
  shelfCount: number,
  slotsPerLayer = 3,
  withStatusRow = false,
  beltSlots = 0,
): BoardLayout {
  const hudRowHeight = hudHeight(height);
  const statusRow: Rect | null = withStatusRow
    ? { x: 0, y: hudRowHeight, width, height: Math.round(hudRowHeight * STATUS_ROW) }
    : null;
  const hud: Rect = { x: 0, y: 0, width, height: hudRowHeight + (statusRow?.height ?? 0) };
  const belt = beltSlots > 0 ? layoutBelt(width, height, beltSlots) : null;
  // The belt takes its own strip at the bottom, near the thumbs, in every orientation.
  const beltSpace = belt ? belt.rect.height + MARGIN : 0;
  const area: Rect = {
    x: MARGIN,
    y: hud.height + MARGIN,
    width: Math.max(1, width - MARGIN * 2),
    height: Math.max(1, height - hud.height - MARGIN * 2 - beltSpace),
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

  return { slotSize: s, hud, hudRowHeight, statusRow, belt, shelves };
}

/** Strip height relative to the belt pitch (room for the rail and a lifted item). */
const BELT_STRIP = 1.3;

function layoutBelt(width: number, height: number, slots: number): BeltLayout {
  // Room for the rollers at both ends, half a pitch each.
  const pitch = Math.min(MAX_SLOT_SIZE, height * 0.1, (width - MARGIN * 2) / (slots + 1));
  const stripHeight = pitch * BELT_STRIP;
  const loopWidth = slots * pitch;
  const loopX = (width - loopWidth) / 2;
  const rect: Rect = {
    x: loopX - pitch / 2,
    y: height - MARGIN - stripHeight,
    width: loopWidth + pitch,
    height: stripHeight,
  };
  return { rect, loopX, pitch, slots, y: rect.y + stripHeight / 2 };
}

export interface BeltPose {
  x: number;
  y: number;
  /** 0 at the loop's ends, 1 once half a slot inside, so wrapping around is never visible. */
  alpha: number;
}

/** Where an item at belt `offset` (slots, in [0, K)) is drawn. Writes into `out` to avoid allocations per frame. */
export function beltPose(belt: BeltLayout, offset: number, out: BeltPose = { x: 0, y: 0, alpha: 0 }): BeltPose {
  out.x = belt.loopX + offset * belt.pitch;
  out.y = belt.y;
  const toEnd = Math.min(offset, belt.slots - offset);
  out.alpha = Math.max(0, Math.min(1, toEnd / 0.5));
  return out;
}

/**
 * The belt slot to pick for a press at (x, y), among slots holding items (`offsets[i]` is null when slot i
 * is empty). The touch area is generous: anywhere on the strip or half a pitch around it, nearest item
 * within one pitch horizontally. Items fading at the ends can still be taken.
 */
export function beltSlotAt(belt: BeltLayout, offsets: readonly (number | null)[], x: number, y: number): number | null {
  if (!isOnBelt(belt, x, y)) return null;
  let best: number | null = null;
  let bestDistance = belt.pitch;
  const pose: BeltPose = { x: 0, y: 0, alpha: 0 };
  offsets.forEach((offset, i) => {
    if (offset === null) return;
    const distance = Math.abs(beltPose(belt, offset, pose).x - x);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/** True when a point is on (or right around) the belt strip. */
export function isOnBelt(belt: BeltLayout, x: number, y: number): boolean {
  const slack = belt.pitch / 2;
  const { rect } = belt;
  return x >= rect.x - slack && x <= rect.x + rect.width + slack && y >= rect.y - slack && y <= rect.y + rect.height + slack;
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
