import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/data/themes';
import { levels } from '../src/data/levels';
import { computeMapLayout, groupIslands, LOCKED_AHEAD, MAX_MAP_WIDTH, revealedLevels, revealedTop } from '../src/ui/mapLayout';

describe('level map', () => {
  const layout = computeMapLayout(levels, 390);

  it('gives each themed level an island of its own and groups the others by up to four', () => {
    const groups = groupIslands(levels);
    for (const group of groups) {
      if (group.theme) expect(group.levels).toHaveLength(1);
      else expect(group.levels.length).toBeLessThanOrEqual(4);
    }
    expect(groups.flatMap((g) => g.levels)).toEqual(levels.map((_, i) => i));
    expect(groups.filter((g) => g.theme).map((g) => g.theme)).toEqual(['budaya-jawa', '17-agustus', 'pasar-malam', 'laut-nusantara']);
  });

  it('climbs from level 1 at the bottom, each level above the one before', () => {
    expect(layout.nodes).toHaveLength(levels.length);
    for (let i = 1; i < layout.nodes.length; i++) expect(layout.nodes[i]!.y).toBeLessThan(layout.nodes[i - 1]!.y);
    for (const node of layout.nodes) {
      expect(node.y).toBeGreaterThan(0);
      expect(node.y).toBeLessThan(layout.height);
    }
  });

  it('puts every level inside its island, and islands apart from each other and within the map', () => {
    for (const node of layout.nodes) {
      const island = layout.islands[node.island]!;
      const d = ((node.x - island.cx) / island.rx) ** 2 + ((node.y - island.cy) / island.ry) ** 2;
      expect(d, `level ${node.level + 1}`).toBeLessThan(0.75);
    }
    for (const island of layout.islands) {
      expect(island.cx - island.rx).toBeGreaterThanOrEqual(0);
      expect(island.cx + island.rx).toBeLessThanOrEqual(layout.width);
    }
    for (let i = 1; i < layout.islands.length; i++) {
      const [a, b] = [layout.islands[i - 1]!, layout.islands[i]!];
      expect(b.cy + b.ry).toBeLessThan(a.cy - a.ry);
    }
  });

  it('stays a column on wide screens', () => {
    expect(computeMapLayout(levels, 1080).width).toBe(MAX_MAP_WIDTH);
  });

  it('shows the levels played, the next one and two locked ones, and keeps the rest of the sea unexplored', () => {
    expect(revealedLevels(24, 0)).toBe(1 + LOCKED_AHEAD);
    expect(revealedLevels(24, 6)).toBe(9);
    expect(revealedLevels(24, 23)).toBe(24);
    expect(revealedLevels(24, null)).toBe(24);
    // The scroll stops above the last island with a revealed level, not at the top of the whole map.
    expect(revealedTop(layout, 3)).toBeGreaterThan(revealedTop(layout, 24));
  });
});

describe('the islands of the themes still to come', () => {
  it('gives every theme up to level 50 an island of its own on the one path, in order', () => {
    const levels = Array.from({ length: 50 }, (_, i) => ({ theme: THEMES.find((theme) => theme.level === i + 1)?.id }));
    const layout = computeMapLayout(levels, 390);
    const themed = layout.islands.filter((island) => island.theme !== null);
    expect(themed.map((island) => island.theme)).toEqual(THEMES.map((theme) => theme.id));
    for (const island of themed) expect(island.levels).toEqual([THEMES.find((theme) => theme.id === island.theme)!.level - 1]);
    // Each island above the one before it (the map is climbed upwards).
    layout.islands.slice(1).forEach((island, i) => expect(island.cy).toBeLessThan(layout.islands[i]!.cy));
  });
});
