import { describe, expect, it } from 'vitest';
import { createGame, tick, type LevelDefinition } from '../src/core';
import { levels } from '../src/data/levels';
import { computeBoardLayout, trackCarrierAt, trackPose, type Rect } from '../src/ui/boardLayout';
import { computeColumnLayout, type ColumnSpec } from '../src/ui/columnLayout';
import { CHECKED_SCREENS, itemSize, layoutForLevel, liveBoard, MIN_ITEM_PX, validateLevelLayout } from '../src/ui/levelLayout';

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
      // The rollers at both ends of a vertical track (half a slot each) stay clear of the HUD and the screen edge.
      for (const t of layout.tracks) {
        expect(t.rect.y - t.pitch / 2).toBeGreaterThanOrEqual(layout.hud.height);
        expect(t.rect.y + t.rect.height + t.pitch / 2).toBeLessThanOrEqual(height);
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

describe('shelf track columns', () => {
  const shelfTrackCol = (track: number, ...shelves: number[]): ColumnSpec => ({ kind: 'shelfTrack', track, shelves });
  const configs: [string, ColumnSpec[], number, number][] = [
    ['shelves | shelf track', [shelvesCol(0, 1, 2), shelfTrackCol(0, 3, 4, 5)], 6, 1],
    ['track | shelf track | shelves', [trackCol(0, 6), shelfTrackCol(1, 0, 1, 2), shelvesCol(3, 4, 5)], 6, 2],
  ];

  describe.each(configs)('%s', (_name, columns, shelfCount, trackCount) => {
    it.each(CHECKED_SCREENS.map(([w, h]) => [`${w}x${h}`, w, h] as const))('fits %s with finger-sized items', (_s, w, h) => {
      const layout = computeColumnLayout(w, h, columns, shelfCount, trackCount, true);
      expect(itemSize(layout)).toBeGreaterThanOrEqual(MIN_ITEM_PX);
      const track = layout.tracks.find((t) => t.pitch > layout.slotSize)!;
      // The loop of shelves, with half a slot at each end, stays below the HUD and on screen.
      expect(track.rect.y - layout.slotSize / 2).toBeGreaterThanOrEqual(layout.hud.height);
      expect(track.rect.y + track.rect.height + layout.slotSize / 2).toBeLessThanOrEqual(h);
      expect(track.rect.x + track.rect.width).toBeLessThanOrEqual(w);
    });
  });

  it('fits fixed shelves | a shelf track | fixed shelves on a 390 px phone with items of at least 36 px', () => {
    const wide = computeColumnLayout(390, 844, [shelvesCol(0, 1, 2), shelfTrackCol(0, 3, 4, 5), shelvesCol(6, 7, 8)], 9, 1, true);
    expect(itemSize(wide)).toBeGreaterThanOrEqual(MIN_ITEM_PX);
    // Its columns do not overlap and stay on screen.
    const [left, , right] = [wide.shelves[0]!, wide.shelves[3]!, wide.shelves[6]!];
    expect(left.rect.x).toBeGreaterThanOrEqual(0);
    expect(left.rect.x + left.rect.width).toBeLessThan(wide.tracks[0]!.rect.x);
    expect(wide.tracks[0]!.rect.x + wide.tracks[0]!.rect.width).toBeLessThan(right.rect.x);
    expect(right.rect.x + right.rect.width).toBeLessThanOrEqual(390);
  });
});

describe('live board: shelves riding tracks', () => {
  const level: LevelDefinition = {
    id: 'live',
    shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]], [[null, null, null]], [[null, null, null]]],
    mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.5, carriers: [{ shelf: 2 }, { shelf: 3 }, { shelf: 4 }] }] }],
    layout: { columns: [{ kind: 'shelves', shelves: [0, 1] }, { kind: 'shelfTrack', track: 0 }] },
  };

  it('moves carried shelves with game time and leaves fixed ones alone', () => {
    const state = createGame(level);
    const base = layoutForLevel(level, state, 390, 844);
    const now = liveBoard(base, state);
    const later = liveBoard(base, tick(state, 1000).state);
    const track = base.tracks[0]!;
    expect(later.layout.shelves[0]).toEqual(base.shelves[0]);
    expect(later.moving).toEqual([false, false, true, true, true]);
    // 0.5 carriers per second, one carrier = one pitch.
    expect(later.layout.shelves[3]!.rect.y - now.layout.shelves[3]!.rect.y).toBeCloseTo(track.pitch / 2);
    expect(later.layout.shelves[3]!.slots[1]!.y - now.layout.shelves[3]!.slots[1]!.y).toBeCloseTo(track.pitch / 2);
  });

  it('wraps carried shelves around and fades them at the ends of the loop', () => {
    const state = createGame(level);
    const base = layoutForLevel(level, state, 390, 844);
    expect(liveBoard(base, state).shelfAlpha[2]).toBe(0);
    expect(liveBoard(base, state).shelfAlpha[3]).toBe(1);
    // After a full loop (3 carriers at 0.5/s = 6 s) everything is back where it started.
    const loop = liveBoard(base, tick(state, 6000).state);
    expect(loop.layout.shelves[3]!.rect.y).toBeCloseTo(liveBoard(base, state).layout.shelves[3]!.rect.y);
  });

  it('returns the layout as is for boards without shelf tracks', () => {
    const plain = levels[0]!;
    const state = createGame(plain);
    const base = layoutForLevel(plain, state, 390, 844);
    expect(liveBoard(base, state).layout).toBe(base);
  });
});
