import { describe, expect, it } from 'vitest';
import { areConfusable, parseItemType, unlockLevel } from '../src/data/itemCatalog';
import {
  COMBO_DEFAULTS,
  createGame,
  firstIncomplete,
  isSpecialLevel,
  stackOf,
  typesNotOneTriple,
  validateLevel,
  type GameState,
  type LevelDefinition,
} from '../src/core';
import { levels, upcomingLevels } from '../src/data/levels';
import { ITEM_KINDS } from '../src/data/itemCatalog';
import { generateLevel, ruleFailures } from '../tools/levelgen/generate';
import { recipeFor } from '../tools/levelgen/recipes';
import { typesFor } from '../tools/levelgen/plan';
import { simulate } from '../tools/simulator';
import { demoLevels } from './fixtures/demo-levels';

const kindsOf = (level: LevelDefinition): Set<string> => {
  const state = createGame(level);
  const types = [
    ...state.shelves.flatMap((s) => s.layers.flat().flatMap((i) => (i ? [i.type] : []))),
    ...state.tracks.flatMap((t) => t.carriers.flatMap((c) => stackOf(c).map((i) => i.type))),
  ];
  return new Set(types);
};
const columnsOf = (level: LevelDefinition) => level.layout?.columns.map((c) => c.kind) ?? ['grid'];
const backLayers = (level: LevelDefinition) => level.shelves.filter((s) => s.length > 1).length;
const deepest = (level: LevelDefinition) => Math.max(...level.shelves.map((s) => s.length));
const mechanic = <K extends string>(level: LevelDefinition, kind: K) => level.mechanics?.find((m) => m.kind === kind);
const lockCounts = (state: GameState) => state.unlockAt.filter((at) => at !== null) as number[];

/** Every level made so far, with its number: levels 1-10 and the themed levels made ahead of their turn. */
const numbered = [...levels.map((level, i) => ({ number: i + 1, level })), ...upcomingLevels];

// Simulated once per level, as the generator does for its report (200 games, seed 1).
const stats = new Map(numbered.map(({ level }) => [level.id, simulate(createGame(level))]));

describe.each(numbered.map(({ number, level }) => [number, level] as const))('level %i', (number, level) => {
  const recipe = recipeFor(number);

  it('is the level its recipe describes', () => {
    expect(level.id).toBe(recipe.id);
    expect(isSpecialLevel(level)).toBe(recipe.theme !== undefined);
    expect(level.timeLimitSeconds).toBeGreaterThan(0);
  });

  it('is exactly what its recipe generates (board and time), so regenerating never changes a shipped board', () => {
    expect(recipe.candidate).toBeDefined();
    expect(generateLevel(recipe).level).toEqual(level);
  }, 120_000);

  it('meets every rule for generated levels', () => {
    // Valid, items big enough on a phone, no defeat in the first two moves, triples not buried too deep, enough
    // triples in reach at the start, and solvable without combos.
    expect(() => validateLevel(level)).not.toThrow();
    expect(ruleFailures(level, recipe)).toEqual([]);
  }, 60_000);

  it('holds exactly one triple of each of its planned types, none locked yet, no look-alikes or variants', () => {
    expect(typesNotOneTriple(createGame(level))).toEqual([]);
    const types = kindsOf(level);
    expect([...types].sort()).toEqual([...typesFor(recipe)].sort());
    const kinds = [...types].map((t) => parseItemType(t)!);
    for (const { kind } of kinds) expect(unlockLevel(kind), kind.id).toBeLessThanOrEqual(number);
    expect(kinds.every((k) => k.variant === 'original')).toBe(true);
    for (const a of kinds) for (const b of kinds) expect(areConfusable(a.kind.id, b.kind.id), `${a.kind.id} ${b.kind.id}`).toBe(false);
  });

  it("lands in its recipe's win band for the simulated player", () => {
    const s = stats.get(level.id)!;
    expect(s.winRate).toBeGreaterThanOrEqual(recipe.winBand[0]);
    expect(s.winRate).toBeLessThanOrEqual(recipe.winBand[1]);
    expect(s.timeUpRate).toBeGreaterThanOrEqual(recipe.time.timeUp[0]);
    expect(s.timeUpRate).toBeLessThanOrEqual(recipe.time.timeUp[1]);
  });
});

describe('the curve of levels 1-10', () => {
  const [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10] = levels as [LevelDefinition, ...LevelDefinition[]] & LevelDefinition[];
  const win = (level: LevelDefinition) => stats.get(level.id)!.winRate;

  it('has ten levels plus the themed ones made ahead, with new ids, none shared with the demo levels', () => {
    expect(levels).toHaveLength(10);
    const ids = numbered.map((entry) => entry.level.id);
    expect(new Set(ids).size).toBe(12);
    for (const demo of demoLevels) expect(ids).not.toContain(demo.id);
  });

  it('1: very simple: 6-8 kinds, few empty slots, nothing hidden, no mechanics', () => {
    expect(columnsOf(l1!)).toEqual(['grid']);
    expect(kindsOf(l1!).size).toBeGreaterThanOrEqual(6);
    expect(kindsOf(l1!).size).toBeLessThanOrEqual(8);
    expect(l1!.shelves.flat(2).filter((slot) => slot === null).length).toBeLessThanOrEqual(3);
    expect(backLayers(l1!)).toBe(0);
    expect(l1!.mechanics ?? []).toEqual([]);
  });

  it('2: more shelves and items, two columns, and back layers appear', () => {
    expect(columnsOf(l2!)).toEqual(['shelves', 'shelves']);
    expect(l2!.shelves.length).toBeGreaterThan(l1!.shelves.length);
    expect(l2!.shelves.flat(2).filter(Boolean).length).toBeGreaterThan(l1!.shelves.flat(2).filter(Boolean).length);
    expect(backLayers(l2!)).toBeGreaterThan(0);
  });

  it('3: three columns and the first locked shelf; 4: locks get more demanding', () => {
    expect(columnsOf(l3!)).toEqual(['shelves', 'shelves', 'shelves']);
    expect(lockCounts(createGame(l1!))).toEqual([]);
    expect(lockCounts(createGame(l2!))).toEqual([]);
    expect(lockCounts(createGame(l3!))).toHaveLength(1);
    const four = lockCounts(createGame(l4!));
    expect(four.length).toBeGreaterThan(1);
    expect(Math.max(...four)).toBeGreaterThan(Math.max(...lockCounts(createGame(l3!))));
  });

  const [l15, l20] = upcomingLevels.map((entry) => entry.level) as [LevelDefinition, LevelDefinition];
  const bringsItsObjects = (level: LevelDefinition) => {
    const kinds = kindsOf(level);
    for (const kind of ITEM_KINDS.filter((k) => k.theme === level.theme)) expect(kinds, kind.id).toContain(kind.id);
  };

  it('every fifth level is a themed level, bringing all its theme’s objects', () => {
    expect(levels.filter(isSpecialLevel).map((l) => l.theme)).toEqual(['budaya-jawa', '17-agustus']);
    expect(upcomingLevels.map((entry) => [entry.number, entry.level.theme])).toEqual([
      [15, 'pasar-malam'],
      [20, 'laut-nusantara'],
    ]);
    for (const level of [l5!, l10!, l15, l20]) bringsItsObjects(level);
  });

  it('5, Budaya Jawa: calm, with more layers than 4 and 6 and comfortable time', () => {
    expect(backLayers(l5!)).toBeGreaterThan(backLayers(l4!));
    expect(backLayers(l5!)).toBeGreaterThan(backLayers(l6!));
    const s = stats.get(l5!.id)!;
    expect(s.winRate).toBeGreaterThanOrEqual(0.8);
    expect(s.timeUpRate).toBeLessThanOrEqual(0.1);
    expect(mechanic(l5!, 'combo')).toBeUndefined();
  });

  it('10, 17 Agustus: a lomba against the clock, with combo multipliers doubled', () => {
    const combo = mechanic(l10!, 'combo');
    expect(combo?.kind === 'combo' && combo.multipliers).toEqual(COMBO_DEFAULTS.multipliers.map((m) => m * 2));
    // The clock, more than space, is what beats the simulated player.
    const s = stats.get(l10!.id)!;
    expect(s.timeUpRate).toBeGreaterThan(s.blockedRate);
  });

  it('6: one or two food kinds new since the regular levels before it', () => {
    const before = new Set(levels.slice(0, 4).flatMap((l) => [...kindsOf(l)]));
    const added = [...kindsOf(l6!)].filter((k) => !before.has(k));
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(added.length).toBeLessThanOrEqual(2);
  });

  it('7: more shelves and layers than 6', () => {
    expect(l7!.shelves.length).toBeGreaterThan(l6!.shelves.length);
    expect(backLayers(l7!)).toBeGreaterThan(backLayers(l6!));
    expect(deepest(l7!)).toBeGreaterThan(deepest(l6!));
  });

  it('8: the first belt, slow and carrying stacks', () => {
    for (const level of levels.slice(0, 7)) expect(createGame(level).tracks).toEqual([]);
    const tracks = createGame(l8!).tracks;
    expect(tracks).toHaveLength(1);
    expect(Math.abs(tracks[0]!.speed)).toBeLessThanOrEqual(0.4);
    expect(tracks[0]!.carriers.some((c) => stackOf(c).length > 1)).toBe(true);
  });

  it('9: a vertical belt, faster than in 8', () => {
    const track = createGame(l9!).tracks[0]!;
    expect(track.orientation).toBe('vertical');
    expect(Math.abs(track.speed)).toBeGreaterThan(Math.abs(createGame(l8!).tracks[0]!.speed));
  });

  it('15, Pasar malam: fast belts with many stacks', () => {
    const tracks = createGame(l15).tracks;
    expect(tracks.length).toBeGreaterThanOrEqual(2);
    for (const track of tracks) expect(Math.abs(track.speed)).toBeGreaterThan(Math.abs(createGame(l9!).tracks[0]!.speed));
    const stacks = tracks.flatMap((t) => t.carriers.map((c) => stackOf(c).length));
    expect(stacks.filter((n) => n >= 2).length).toBeGreaterThanOrEqual(8);
  });

  it('20, Laut Nusantara: shelves riding a track', () => {
    expect(columnsOf(l20)).toContain('shelfTrack');
    expect(createGame(l20).tracks.some((t) => t.carriers.every((c) => c.kind === 'shelf'))).toBe(true);
  });

  it('is a sawtooth: after something new or demanding comes an easier level', () => {
    expect(win(l1!)).toBeGreaterThan(win(l3!));
    expect(win(l5!)).toBeGreaterThan(win(l4!));
    expect(win(l6!)).toBeGreaterThan(win(l7!));
    expect(win(l8!)).toBeGreaterThan(win(l7!));
    expect(win(l8!)).toBeGreaterThan(win(l9!));
  });
});

describe('saved progress from the demo levels', () => {
  it('is ignored without errors: the game starts at level 1', () => {
    const old = { completed: demoLevels.map((l) => l.id), bestScores: { level004: 1200 } };
    expect(firstIncomplete(old, levels.map((l) => l.id))).toBe(0);
  });
});
