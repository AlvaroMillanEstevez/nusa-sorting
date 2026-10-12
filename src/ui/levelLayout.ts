import { carrierOffset, createGame, type GameState, type LevelDefinition } from '../core';
import { computeBoardLayout, MARGIN, shelfLayoutCentred, trackPose, translateLayout, type BoardLayout, type Rect, type ShelfLayout } from './boardLayout';
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
/**
 * The booster bar's room: a strip along the bottom in portrait (where height is to spare) or down the right side
 * in landscape (where width is). Boards are laid out in what is left.
 */
export const BOOSTER_BAR = 72;

/** Where the booster bar goes on a screen, below the HUD. */
export function boosterBarRect(width: number, height: number, hudHeight: number): Rect {
  return width > height
    ? { x: width - BOOSTER_BAR, y: hudHeight, width: BOOSTER_BAR, height: height - hudHeight }
    : { x: 0, y: height - BOOSTER_BAR, width, height: BOOSTER_BAR };
}

/**
 * Wide screens: desktop windows (CrazyGames shows games at 16:9) and tablets held sideways, but not phones held
 * sideways, which are too short for it. There the HUD goes in a column left of the board and the boosters in one
 * right of it, under the warung's awning, and the board takes the whole height below the awning.
 */
export const WIDE_ASPECT = 1.45;
const WIDE_MIN_HEIGHT = 440;
export const isWide = (width: number, height: number): boolean => width / height >= WIDE_ASPECT && height >= WIDE_MIN_HEIGHT;
/** The awning across the top of a wide screen. */
export const awningHeight = (height: number): number => Math.round(height * 0.075);
/** The HUD's column on a wide screen. */
const sideColumn = (width: number): number => Math.round(Math.min(200, Math.max(156, width * 0.17)));
/** Between the board and the side columns. */
const SIDE_GAP = 20;
/**
 * The wooden signs the side columns hang on, as tall as the HUD's four rows (pause and clock, score, combo,
 * special badge) and the boosters' three tiles. Hung a little below the awning.
 */
export const SIDE_SIGN_HEIGHT = 276;
const SIGN_DROP = 16;
/** The boosters' sign: wider than the bar, so the tiles sit on wood. */
const BOOSTER_SIGN = 92;

function wideLayout(level: LevelDefinition, state: GameState, width: number, height: number): BoardLayout {
  const column = sideColumn(width);
  const right = BOOSTER_SIGN;
  const top = awningHeight(height);
  // The board between the columns, below the awning; then the columns close in on it from both sides.
  const areaX = column + SIDE_GAP;
  const areaW = width - areaX - right - SIDE_GAP;
  const inArea = layoutInArea(level, state, areaW, height - top, true);
  const board = translateLayout(inArea, areaX, top);
  const bounds = boardRect(board);
  const left = bounds ? bounds.x : areaX;
  const end = bounds ? bounds.x + bounds.width : areaX + areaW;
  const hudX = Math.max(MARGIN, left - SIDE_GAP - column);
  const signY = top + SIGN_DROP;
  const hudRect = { x: hudX, y: signY, width: column, height: SIDE_SIGN_HEIGHT };
  const boosters = { x: Math.min(width - MARGIN - BOOSTER_SIGN, end + SIDE_GAP), y: signY, width: BOOSTER_SIGN, height: SIDE_SIGN_HEIGHT };
  return { ...board, hud: { x: 0, y: 0, width, height: top }, hudRowHeight: top, statusRow: null, statusInline: true, side: { hud: hudRect, boosters } };
}

/** The area the shelves, tracks and belt of a layout cover, or null if there are none. */
function boardRect(layout: BoardLayout): Rect | null {
  const rects = [...layout.shelves.map((s) => s.rect), ...layout.tracks.map((t) => t.rect), ...(layout.belt ? [layout.belt.rect] : [])];
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
}

export function layoutForLevel(level: LevelDefinition, state: GameState, width: number, height: number): BoardLayout {
  if (isWide(width, height)) return wideLayout(level, state, width, height);
  // The board keeps clear of the booster bar; the HUD still spans the whole width.
  const landscape = width > height;
  const board = layoutInArea(level, state, landscape ? width - BOOSTER_BAR : width, landscape ? height : height - BOOSTER_BAR);
  if (!landscape) return board;
  return { ...board, hud: { ...board.hud, width }, statusRow: board.statusRow && { ...board.statusRow, width } };
}

function layoutInArea(level: LevelDefinition, state: GameState, width: number, height: number, noHud = false): BoardLayout {
  // Score and combo are shown in every level.
  const withStatusRow = true;
  if (!level.layout) {
    return computeBoardLayout(width, height, level.shelves.length, 3, withStatusRow, state.tracks[0]?.carriers.length ?? 0, noHud);
  }
  const columns: ColumnSpec[] = level.layout.columns.map((column): ColumnSpec => {
    if (column.kind === 'shelves') return column;
    const track = state.tracks[column.track]!;
    if (column.kind === 'shelfTrack') {
      return { kind: 'shelfTrack', track: column.track, shelves: track.carriers.map((c) => (c.kind === 'shelf' ? c.shelf : -1)) };
    }
    return { kind: 'track', track: column.track, slots: track.carriers.length };
  });
  return computeColumnLayout(width, height, columns, level.shelves.length, state.tracks.length, withStatusRow, noHud);
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
