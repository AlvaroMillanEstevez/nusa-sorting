import type * as Phaser from 'phaser';
import art from '../../assets/art/art.json';
import { groupIslands, type MapLevel } from '../../ui/mapLayout';

/**
 * The map's illustrated islands (tools/art/build_game_art.py: assets/art/islands): one per themed level, named
 * after its theme, and one per run of plain levels, named after their numbers ("levels-06-09"). Each is downloaded
 * only when the map scrolls near it, one at a time; islands without a picture keep their drawn shape.
 */
const URLS = import.meta.glob('../../assets/art/islands/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface IslandInfo {
  readonly size: readonly [number, number];
  /** Where its jetty ends, as a share of the picture's width and height (the jetty is drawn top right). */
  readonly dock: readonly [number, number];
}

const INFO = (art as unknown as { islands: Record<string, IslandInfo> }).islands;

/** The picture's name for an island: its theme, or the numbers of its first and last levels. */
export function islandName(theme: string | null, numbers: readonly number[]): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return theme ?? `levels-${pad(numbers[0]!)}-${pad(numbers.at(-1)!)}`;
}

/** An island's picture measures, or undefined for an island without one. */
export function islandInfo(name: string): IslandInfo | undefined {
  return URLS[`../../assets/art/islands/${name}.webp`] ? INFO[name] : undefined;
}

export const islandKey = (name: string) => `island:${name}`;

const loading = new Map<string, Promise<void>>();
let queue: Promise<void> = Promise.resolve();

/**
 * Downloads an island's picture once (downloads run side by side) and decodes it after the ones already asked for,
 * so decoding never piles up in one frame while the map scrolls; then adds it as a texture. Resolves when ready.
 */
export function loadIsland(textures: Phaser.Textures.TextureManager, name: string): Promise<void> {
  let done = loading.get(name);
  if (!done) {
    const url = URLS[`../../assets/art/islands/${name}.webp`];
    if (!url) return Promise.resolve();
    const image = new Image();
    image.src = url;
    done = queue.then(async () => {
      try {
        await image.decode();
        if (!textures.exists(islandKey(name))) textures.addImage(islandKey(name), image);
      } catch {
        // Without it the island keeps its drawn shape.
      }
    });
    queue = done;
    loading.set(name, done);
  }
  return done;
}

/**
 * Starts downloading the islands around a level (its own, the one before and the two after) while the game boots,
 * so the map rarely opens on bare shallows. Nothing waits for them.
 */
export function prefetchIslandsAround(textures: Phaser.Textures.TextureManager, levels: readonly MapLevel[], numbers: readonly number[], levelIndex: number): void {
  const groups = groupIslands(levels);
  const at = groups.findIndex((group) => group.levels.includes(levelIndex));
  for (const group of [groups[at], groups[at + 1], groups[at - 1], groups[at + 2]]) {
    if (group) void loadIsland(textures, islandName(group.theme, group.levels.map((level) => numbers[level]!)));
  }
}
