/**
 * The level map: islands in an ocean, like the Indonesian archipelago, with a path through every level. Pure
 * geometry, in map pixels: y grows downwards and level 1 is at the bottom, so the map is climbed upwards.
 *
 * Each themed level is an island of its own; the levels between two themed levels share islands of up to
 * four. Islands alternate left and right of the middle, so the path winds across the water between them.
 */

export interface MapIsland {
  readonly index: number;
  /** A themed level's island carries its theme; the others are plain. */
  readonly theme: string | null;
  readonly cx: number;
  readonly cy: number;
  /** Half-width and half-height of the island's shape. */
  readonly rx: number;
  readonly ry: number;
  /** Indices (in play order) of the levels on it. */
  readonly levels: readonly number[];
}

export interface MapNode {
  readonly level: number;
  readonly island: number;
  readonly x: number;
  readonly y: number;
}

export interface MapLayout {
  readonly width: number;
  readonly height: number;
  /** One map unit: a tenth of the width. Sizes on the map are multiples of it. */
  readonly unit: number;
  readonly islands: readonly MapIsland[];
  readonly nodes: readonly MapNode[];
}

/** A level as the map needs it. */
export interface MapLevel {
  readonly theme?: string | undefined;
}

/** Most levels on one plain island. */
export const LEVELS_PER_ISLAND = 4;
/** The map is never wider than this, so on a computer it stays a column in the middle of the ocean. */
export const MAX_MAP_WIDTH = 560;
/** Locked levels shown ahead of the first one not completed; the rest of the sea stays unexplored. */
export const LOCKED_AHEAD = 2;

/** Groups levels into islands: a themed level alone, plain levels in runs of up to LEVELS_PER_ISLAND. */
export function groupIslands(levels: readonly MapLevel[]): { theme: string | null; levels: number[] }[] {
  const groups: { theme: string | null; levels: number[] }[] = [];
  levels.forEach((level, i) => {
    if (level.theme) {
      groups.push({ theme: level.theme, levels: [i] });
      return;
    }
    const last = groups.at(-1);
    if (last && !last.theme && last.levels.length < LEVELS_PER_ISLAND) last.levels.push(i);
    else groups.push({ theme: null, levels: [i] });
  });
  return groups;
}

/** Lays the map out for a screen `screenWidth` wide. */
export function computeMapLayout(levels: readonly MapLevel[], screenWidth: number): MapLayout {
  const width = Math.min(screenWidth, MAX_MAP_WIDTH);
  const u = width / 10;
  const groups = groupIslands(levels);
  const step = 1.9 * u;
  const gap = 2.4 * u;
  const bottomMargin = 3.2 * u;
  const topMargin = 3 * u;

  // Built from the bottom up (y negative), then shifted so the map starts at 0.
  const islands: MapIsland[] = [];
  const nodes: MapNode[] = [];
  let bottom = -bottomMargin;
  groups.forEach((group, index) => {
    const themed = group.theme !== null;
    const n = group.levels.length;
    const ry = themed ? 2.1 * u : ((n - 1) * step) / 2 + 1.5 * u;
    const rx = themed ? 2.6 * u : 3.1 * u;
    // Alternate sides; the first island sits a little left of the middle.
    const cx = width / 2 + (index % 2 === 0 ? -1 : 1) * 1.4 * u;
    const cy = bottom - ry;
    islands.push({ index, theme: group.theme, cx, cy, rx, ry, levels: group.levels });
    group.levels.forEach((level, k) => {
      // Up the island in a gentle zigzag; a themed island's level sits a little low, under its sign.
      const y = themed ? cy + 0.35 * u : cy + ry - 1.5 * u - k * step;
      const x = themed ? cx : cx + (k % 2 === 0 ? -1 : 1) * 1.2 * u;
      nodes.push({ level, island: index, x, y });
    });
    bottom = cy - ry - gap;
  });
  const height = -bottom - gap + topMargin;
  const shift = (y: number) => y + height;
  return {
    width,
    height,
    unit: u,
    islands: islands.map((island) => ({ ...island, cy: shift(island.cy) })),
    nodes: nodes.map((node) => ({ ...node, y: shift(node.y) })),
  };
}

/**
 * How many levels the map shows: every level up to the first one not completed, plus LOCKED_AHEAD locked ones
 * after it (all of them once everything is completed). `firstIncomplete` is null when all are completed.
 */
export function revealedLevels(count: number, firstIncomplete: number | null): number {
  return firstIncomplete === null ? count : Math.min(count, firstIncomplete + 1 + LOCKED_AHEAD);
}

/** The highest map y the player may scroll to: a little above the topmost island with a revealed level. */
export function revealedTop(layout: MapLayout, revealed: number): number {
  const shown = layout.islands.filter((island) => island.levels.some((level) => level < revealed));
  const top = Math.min(...shown.map((island) => island.cy - island.ry));
  return Math.max(0, top - 2.2 * layout.unit);
}
