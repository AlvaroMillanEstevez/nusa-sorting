import { describe, expect, it } from 'vitest';
import { createGame, type LevelDefinition } from '../src/core';
import { levels } from '../src/data/levels';
import { computeBoardLayout, trackCarrierAt, trackPose, type Rect } from '../src/ui/boardLayout';
import { computeColumnLayout, type ColumnSpec } from '../src/ui/columnLayout';
import { CHECKED_SCREENS, itemSize, layoutForLevel, MIN_ITEM_PX, validateLevelLayout } from '../src/ui/levelLayout';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const shelvesCol = (...shelves: number[]): ColumnSpec => ({ kind: 'shelves', shelves });
const trackCol = (track: number, slots: number): ColumnSpec => ({ kind: 'track', track, slots });

const examples: [string, ColumnSpec[], number, number][] = [
  ['shelves | track | shelves', [shelvesCol(0, 1, 2), trackCol(0, 6), shelvesCol(3, 4, 5)], 6, 1],
  ['track | shelves | track', [trackCol(0, 6), shelvesCol(0, 1, 2), trackCol(1, 6)], 3, 2],
  ['shelves | shelves | track', [shelvesCol(0, 1, 2), shelvesCol(3, 4, 5), trackCol(0, 6)], 6, 1],
];

describe.each(examples)('column layout %s', (_name, columns, shelfCount, trackCount) => {
  describe.each(CHECKED_SCREENS.map(([w, h]) => [`${w}x${h}`, w, h] as const))('on %s', (_screen, width, height) => {
    const layout = computeColumnLayout(width, height, columns, shelfCount, trackCount);
    const rects = [...layout.shelves.map((s) => s.rect), ...layout.tracks.map((t) => t.rect)];

    it('places every shelf and track inside the screen, below the HUD, without overlaps', () => {
      expect(layout.shelves.filter(Boolean)).toHaveLength(shelfCount);
      expect(layout.tracks.filter(Boolean)).toHaveLength(trackCount);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width);
        expect(r.y).toBeGreaterThanOrEqual(layout.hud.height);
        expect(r.y + r.height).toBeLessThanOrEqual(height);
      }
      rects.forEach((a, i) => rects.forEach((b, j) => i < j && expect(overlaps(a, b)).toBe(false)));
    });

    it('keeps items big enough for a finger, the same size on tracks and shelves', () => {
      expect(itemSize(layout)).toBeGreaterThanOrEqual(MIN_ITEM_PX);
      for (const track of layout.tracks) {
        expect(track.pitch).toBe(layout.slotSize);
        expect(track.rect.height).toBeCloseTo(track.slots * track.pitch);
      }
    });

    it('keeps columns in order from left to right', () => {
      const lefts = columns.map((c) => (c.kind === 'track' ? layout.tracks[c.track]!.rect.x : layout.shelves[c.shelves[0]!]!.rect.x));
      expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
    });
  });
});

describe('vertical tracks on screen', () => {
  const layout = computeColumnLayout(390, 844, [shelvesCol(0), trackCol(0, 6), shelvesCol(1)], 2, 1);
  const track = layout.tracks[0]!;

  it('moves carriers along y and wraps without a visible jump', () => {
    expect(trackPose(track, 0).y).toBe(track.loopStart);
    expect(trackPose(track, 2).x).toBe(track.cross);
    expect(trackPose(track, 2.5).y - trackPose(track, 2).y).toBeCloseTo(track.pitch / 2);
    expect(trackPose(track, 6 - 1e-6).alpha).toBeCloseTo(0);
    expect(trackPose(track, 0).alpha).toBe(0);
    expect(trackPose(track, 3).alpha).toBe(1);
  });

  it('picks the nearest carrier along the track, with room for a finger around it', () => {
    const offsets = [1, null, 3.5, null, null, null];
    const y = (o: number) => trackPose(track, o).y;
    expect(trackCarrierAt(track, offsets, track.cross, y(1))).toBe(0);
    expect(trackCarrierAt(track, offsets, track.rect.x - track.pitch * 0.4, y(3.5) + 5)).toBe(2);
    expect(trackCarrierAt(track, offsets, track.cross, y(5.5))).toBeNull();
    expect(trackCarrierAt(track, offsets, track.rect.x - track.pitch, y(1))).toBeNull();
  });
});

describe('layouts per level', () => {
  it('uses the automatic grid, unchanged, for levels without a column layout', () => {
    for (const level of levels.filter((l) => !l.layout)) {
      const state = createGame(level);
      const auto = computeBoardLayout(390, 844, level.shelves.length, 3, state.combo !== null, state.tracks[0]?.carriers.length ?? 0);
      expect(layoutForLevel(level, state, 390, 844)).toEqual(auto);
    }
  });

  it('accepts every shipped level and rejects layouts that make items too small', () => {
    for (const level of levels) expect(() => validateLevelLayout(level)).not.toThrow();
    const cramped: LevelDefinition = {
      id: 'cramped',
      shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]],
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 1, carriers: [['C', 'C', 'C'], ...Array<string[]>(11).fill([])] }] }],
      layout: { columns: [{ kind: 'shelves', shelves: [0, 1, 2] }, { kind: 'track', track: 0 }] },
    };
    expect(() => validateLevelLayout(cramped)).toThrow(/px on a 844x390 screen \(minimum 36 px\)/);
  });
});
