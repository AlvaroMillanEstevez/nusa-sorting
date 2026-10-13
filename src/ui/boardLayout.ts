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
  /**
   * Where items are placed: the centre of a square item standing on the shelf's base (the slot's centre when
   * slots are square). Back layers sit right under the front items, at the same points.
   */
  readonly slots: readonly Point[];
  /** Height of each slot in px: the slot size times the slot aspect (see setSlotAspect). */
  readonly slotHeight: number;
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

/**
 * A track on screen, horizontal or vertical. Carrier offset o (in carriers) is drawn at loopStart + o * pitch
 * along the track's axis; `cross` is the position on the other axis (the line the carriers ride on).
 */
export interface TrackLayout {
  readonly orientation: 'horizontal' | 'vertical';
  /** The track's area, used for touch: the whole loop and the rail around it. */
  readonly rect: Rect;
  readonly loopStart: number;
  readonly pitch: number;
  readonly slots: number;
  readonly cross: number;
  /** The shelves' slot size: items and plates on the track are drawn this big, whatever the pitch. */
  readonly slotSize: number;
}

export interface BoardLayout {
  /** Size of one slot in px; items are drawn slightly smaller. */
  readonly slotSize: number;
  /** Whole HUD area (both rows when there is a status row). */
  readonly hud: Rect;
  /** Height of the main HUD row (level, clock, buttons). */
  readonly hudRowHeight: number;
  /** Where score and combo go: a second HUD row, or the main row itself when `statusInline`. */
  readonly statusRow: Rect | null;
  /** True in landscape, where score and combo share the main HUD row so the board keeps its height. */
  readonly statusInline: boolean;
  /** Conveyor strip below the shelves in the automatic layout, or null. */
  readonly belt: BeltLayout | null;
  /** Every track of the level on screen, in the level's track order. */
  readonly tracks: readonly TrackLayout[];
  readonly shelves: readonly ShelfLayout[];
  /**
   * On wide screens (see levelLayout's wideLayout): the HUD in a column left of the board, the boosters in one
   * right of it, and the stall's awning across the top (its height is `hud.height`). Absent elsewhere.
   */
  readonly side?: { readonly hud: Rect; readonly boosters: Rect };
}

// Shelf geometry in units of slotSize: a thin frame at the sides and top, the front board below the slots.
export const SIDE_PAD = 0.05;
export const TOP_PAD = 0.08;
export const PLANK = 0.18;
/** Between shelves: room for the brackets under each board. */
export const GAP = 0.24;
export const MARGIN = 16;
export const MAX_SLOT_SIZE = 110;

export const SHELF_WIDTH_UNITS = (slotsPerLayer: number) => slotsPerLayer + SIDE_PAD * 2;

/**
 * Slot height over slot width. Slots are taller than wide: items stand on the shelf's base like real goods,
 * and items tall by nature use the extra height (see itemFit). Tracks keep the same room around each item.
 */
export const SLOT_ASPECT = 1.2;

let aspect = SLOT_ASPECT;

/** Changes the slot aspect (1 to 1.6): development only (?slotAspect) and tests. */
export function setSlotAspect(value: number): void {
  aspect = Math.max(1, Math.min(1.6, value));
}

export function slotAspect(): number {
  return aspect;
}

/** A shelf's height in slot sizes: the frame on top, a slot and the front board. */
export const shelfHeightUnits = (): number => TOP_PAD + aspect + PLANK;
/**
 * The layer behind the front sits exactly under it, a little smaller so the front item covers it. Where the
 * front slot is empty it shows as a dark silhouette of its shape (ui/art/itemPixels), so players can plan.
 */
export const BACK_SCALE = 0.94;
export const SILHOUETTE_ALPHA = 0.9;

export function hudHeight(height: number): number {
  return Math.round(Math.min(72, Math.max(44, height * 0.08)));
}

/**
 * Lays out shelves in the grid (columns × rows) that gives the largest slots for the viewport,
 * so it works in both portrait and landscape. Incomplete last rows are centered.
 */
/** The status row (score and combo) is this fraction of the main HUD row. */
export const STATUS_ROW = 0.75;

export function computeBoardLayout(
  width: number,
  height: number,
  shelfCount: number,
  slotsPerLayer = 3,
  withStatusRow = false,
  beltSlots = 0,
  noHud = false,
): BoardLayout {
  const { hud, hudRowHeight, statusRow, statusInline } = hudArea(width, height, withStatusRow, noHud);
  const shelfW = SHELF_WIDTH_UNITS(slotsPerLayer);
  const shelfH = shelfHeightUnits();
  const contentWidth = Math.max(1, width - MARGIN * 2);
  // Height for the shelves plus, with a belt, its strip and the margin above it.
  const contentHeight = Math.max(1, height - hud.height - MARGIN * 2 - (beltSlots > 0 ? MARGIN : 0));
  // The belt strip is sized in slots too, so belt items are exactly as big as shelf items.
  const beltUnits = beltSlots > 0 ? beltStripUnits() : 0;

  let best = { cols: 1, rows: shelfCount, size: 0 };
  for (let cols = 1; cols <= Math.max(1, shelfCount); cols++) {
    const rows = Math.ceil(shelfCount / cols);
    const size = Math.min(
      contentWidth / (cols * shelfW + (cols - 1) * GAP),
      contentHeight / (rows * shelfH + (rows - 1) * GAP + beltUnits),
    );
    if (size > best.size) best = { cols, rows, size };
  }

  // K belt slots must fit across the screen; the rollers sit over the loop's faded ends, not beside them.
  const beltWidthCap = beltSlots > 0 ? (width - BELT_SIDE_MARGIN * 2) / beltSlots : Number.POSITIVE_INFINITY;
  const s = Math.min(MAX_SLOT_SIZE, best.size, beltWidthCap);
  const belt = beltSlots > 0 ? layoutBelt(width, height, beltSlots, s) : null;
  // The belt takes its own strip at the bottom, near the thumbs, in every orientation.
  const area: Rect = {
    x: MARGIN,
    y: hud.height + MARGIN,
    width: contentWidth,
    height: Math.max(1, contentHeight - (belt ? belt.rect.height : 0)),
  };
  const gridH = best.rows * shelfH * s + (best.rows - 1) * GAP * s;
  const top = area.y + (area.height - gridH) / 2;

  const shelves: ShelfLayout[] = [];
  for (let i = 0; i < shelfCount; i++) {
    const row = Math.floor(i / best.cols);
    const col = i % best.cols;
    const inRow = Math.min(best.cols, shelfCount - row * best.cols);
    const rowW = inRow * shelfW * s + (inRow - 1) * GAP * s;
    const left = area.x + (area.width - rowW) / 2;

    shelves.push(shelfLayoutAt(left + col * (shelfW + GAP) * s, top + row * (shelfH + GAP) * s, s, slotsPerLayer));
  }

  return { slotSize: s, hud, hudRowHeight, statusRow, statusInline, belt, tracks: belt ? [trackFromBelt(belt)] : [], shelves };
}

/**
 * The HUD area: the main row, plus the score/combo status. In portrait the status gets its own row below; in
 * landscape (wider than tall) it shares the main row, since height is what limits the board there.
 */
export function hudArea(
  width: number,
  height: number,
  withStatusRow: boolean,
  noHud = false,
): { hud: Rect; hudRowHeight: number; statusRow: Rect | null; statusInline: boolean } {
  // A board laid out in an area of its own, with the HUD elsewhere (wide screens).
  if (noHud) return { hud: { x: 0, y: 0, width, height: 0 }, hudRowHeight: 0, statusRow: null, statusInline: true };
  const hudRowHeight = hudHeight(height);
  const statusInline = withStatusRow && width > height;
  const statusRow: Rect | null = !withStatusRow
    ? null
    : statusInline
      ? { x: 0, y: 0, width, height: hudRowHeight }
      : { x: 0, y: hudRowHeight, width, height: Math.round(hudRowHeight * STATUS_ROW) };
  const hud: Rect = { x: 0, y: 0, width, height: hudRowHeight + (statusRow && !statusInline ? statusRow.height : 0) };
  return { hud, hudRowHeight, statusRow, statusInline };
}

/** The automatic layout's horizontal strip as a generic track. */
export function trackFromBelt(belt: BeltLayout): TrackLayout {
  return { orientation: 'horizontal', rect: belt.rect, loopStart: belt.loopX, pitch: belt.pitch, slots: belt.slots, cross: belt.y, slotSize: belt.pitch };
}

/** Builds a shelf's slots from its top-left corner and the slot size (shared by every layout). */
export function shelfLayoutAt(x: number, y: number, s: number, slotsPerLayer = 3): ShelfLayout {
  const rect: Rect = { x, y, width: SHELF_WIDTH_UNITS(slotsPerLayer) * s, height: shelfHeightUnits() * s };
  // A square item resting on the base: the slot's centre when slots are square.
  const slotY = rect.y + (TOP_PAD + 0.5 + (aspect - 1)) * s;
  return {
    rect,
    slots: Array.from({ length: slotsPerLayer }, (_, j) => ({ x: rect.x + (SIDE_PAD + j + 0.5) * s, y: slotY })),
    slotHeight: aspect * s,
  };
}

/**
 * A slot's whole cell: a slot wide and the slot's height tall, standing on the shelf's base (for outlines of a
 * slot: drop targets, the tutorial).
 */
export function slotRect(shelf: ShelfLayout, slot: number, slotSize: number): Rect {
  const at = shelf.slots[slot]!;
  const base = at.y + slotSize / 2;
  return { x: at.x - slotSize / 2, y: base - shelf.slotHeight, width: slotSize, height: shelf.slotHeight };
}

/** A shelf whose centre is at (cx, cy): how shelves riding a track are placed. */
export function shelfLayoutCentred(cx: number, cy: number, s: number, slotsPerLayer = 3): ShelfLayout {
  return shelfLayoutAt(cx - (SHELF_WIDTH_UNITS(slotsPerLayer) * s) / 2, cy - (shelfHeightUnits() * s) / 2, s, slotsPerLayer);
}

/** Where a carrier at `offset` (carriers, in [0, K)) is drawn on a track. Writes into `out` to avoid allocations. */
export function trackPose(track: TrackLayout, offset: number, out: BeltPose = { x: 0, y: 0, alpha: 0 }): BeltPose {
  const along = track.loopStart + offset * track.pitch;
  if (track.orientation === 'horizontal') {
    out.x = along;
    out.y = track.cross;
  } else {
    out.x = track.cross;
    out.y = along;
  }
  const toEnd = Math.min(offset, track.slots - offset);
  out.alpha = Math.max(0, Math.min(1, toEnd / 0.5));
  return out;
}

/** True when a point is on (or within half a pitch around) a track. */
export function isOnTrack(track: TrackLayout, x: number, y: number): boolean {
  const slack = track.pitch / 2;
  const { rect } = track;
  return x >= rect.x - slack && x <= rect.x + rect.width + slack && y >= rect.y - slack && y <= rect.y + rect.height + slack;
}

/**
 * The carrier to take from for a press at (x, y), among carriers with something on top (`offsets[i]` is null
 * for empty ones): anywhere on or around the track, the nearest one along it within one pitch.
 */
export function trackCarrierAt(track: TrackLayout, offsets: readonly (number | null)[], x: number, y: number): number | null {
  if (!isOnTrack(track, x, y)) return null;
  const along = track.orientation === 'horizontal' ? x : y;
  let best: number | null = null;
  let bestDistance = track.pitch;
  offsets.forEach((offset, i) => {
    if (offset === null) return;
    const distance = Math.abs(track.loopStart + offset * track.pitch - along);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/** Strip height in slots: a full-height slot plus room for the rail around it. */
export const beltStripUnits = (): number => aspect + 0.3;
/** The belt may run closer to the screen edges than the shelves. */
const BELT_SIDE_MARGIN = 8;

/** The belt pitch is the shelves' slot size, so items keep their size when they move between the two. */
function layoutBelt(width: number, height: number, slots: number, pitch: number): BeltLayout {
  const stripHeight = pitch * beltStripUnits();
  const loopWidth = slots * pitch;
  const loopX = (width - loopWidth) / 2;
  const rect: Rect = { x: loopX, y: height - MARGIN - stripHeight, width: loopWidth, height: stripHeight };
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

/**
 * Front slot under a point, from the layout alone: the slot's cell, a slot wide and as tall as its shelf plus
 * half the gap above and below (frame and board included, so a press near an item's edge still counts).
 * Uses where the slot is, never where its sprite is drawn, so items still moving can be grabbed at once.
 */
export function frontSlotAt(layout: BoardLayout, x: number, y: number): { shelf: number; slot: number } | null {
  const s = layout.slotSize;
  const slack = (GAP * s) / 2;
  for (let shelf = 0; shelf < layout.shelves.length; shelf++) {
    const { rect, slots } = layout.shelves[shelf]!;
    if (y < rect.y - slack || y > rect.y + rect.height + slack) continue;
    for (let slot = 0; slot < slots.length; slot++) {
      if (Math.abs(x - slots[slot]!.x) <= s / 2) return { shelf, slot };
    }
  }
  return null;
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

/** The smallest whole-pixel rectangle around `rects`, each grown by `margin`; null for none. */
export function boundsAround(rects: readonly Rect[], margin: number): Rect | null {
  if (rects.length === 0) return null;
  const x0 = Math.floor(Math.min(...rects.map((r) => r.x)) - margin);
  const y0 = Math.floor(Math.min(...rects.map((r) => r.y)) - margin);
  const x1 = Math.ceil(Math.max(...rects.map((r) => r.x + r.width)) + margin);
  const y1 = Math.ceil(Math.max(...rects.map((r) => r.y + r.height)) + margin);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The same layout moved by (dx, dy): for a board laid out in an area that does not start at the corner. */
export function translateLayout(layout: BoardLayout, dx: number, dy: number): BoardLayout {
  const rect = (r: Rect): Rect => ({ ...r, x: r.x + dx, y: r.y + dy });
  return {
    ...layout,
    hud: rect(layout.hud),
    statusRow: layout.statusRow && rect(layout.statusRow),
    belt: layout.belt && { ...layout.belt, rect: rect(layout.belt.rect), loopX: layout.belt.loopX + dx, y: layout.belt.y + dy },
    tracks: layout.tracks.map((track) =>
      track.orientation === 'horizontal'
        ? { ...track, rect: rect(track.rect), loopStart: track.loopStart + dx, cross: track.cross + dy }
        : { ...track, rect: rect(track.rect), loopStart: track.loopStart + dy, cross: track.cross + dx },
    ),
    shelves: layout.shelves.map((shelf) => ({ ...shelf, rect: rect(shelf.rect), slots: shelf.slots.map((p) => ({ x: p.x + dx, y: p.y + dy })) })),
  };
}
