import { describe, expect, it } from 'vitest';
import { createGame, moveItem } from '../src/core';
import {
  ALL_ITEM_TYPES,
  areConfusable,
  CONFUSABLE_GROUPS,
  ITEM_KINDS,
  itemTypeId,
  parseItemType,
  STARTER_KINDS,
  VARIANTS,
} from '../src/data/itemCatalog';
import { levels as gameLevels } from '../src/data/levels';
import { demoLevels } from './fixtures/demo-levels';

const levels = [...gameLevels, ...demoLevels];

const ids = ITEM_KINDS.map((k) => k.id);

describe('item catalogue', () => {
  it('has the 26 kinds, with stable kebab-case ids and names in English and Indonesian', () => {
    expect(ITEM_KINDS).toHaveLength(26);
    expect(new Set(ids).size).toBe(26);
    for (const kind of ITEM_KINDS) {
      expect(kind.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(kind.name.en.length).toBeGreaterThan(0);
      expect(kind.name.id.length).toBeGreaterThan(0);
      expect(['dish', 'snack', 'sweet', 'drink', 'fruit', 'other']).toContain(kind.category);
    }
  });

  it('marks ten starter kinds, none of them confusable with another', () => {
    expect(STARTER_KINDS).toHaveLength(10);
    expect(new Set(STARTER_KINDS).size).toBe(10);
    for (const id of STARTER_KINDS) expect(ids).toContain(id);
    for (const a of STARTER_KINDS) for (const b of STARTER_KINDS) expect(areConfusable(a, b)).toBe(false);
  });

  it('lists confusable groups of real kinds', () => {
    for (const group of CONFUSABLE_GROUPS) for (const id of group) expect(ids).toContain(id);
    expect(areConfusable('tempe', 'tahu-goreng')).toBe(true);
    expect(areConfusable('klepon', 'dadar-gulung')).toBe(true);
    expect(areConfusable('tempe', 'tempe')).toBe(false);
    expect(areConfusable('sate', 'durian')).toBe(false);
  });
});

describe('variants as item types', () => {
  it('gives every kind three variants, each its own item type', () => {
    expect(VARIANTS).toEqual(['original', 'alt1', 'alt2']);
    expect(ALL_ITEM_TYPES).toHaveLength(78);
    expect(new Set(ALL_ITEM_TYPES).size).toBe(78);
    expect(itemTypeId('tempe')).toBe('tempe');
    expect(itemTypeId('tempe', 'alt1')).toBe('tempe:alt1');
  });

  it('reads type ids back, and rejects anything outside the catalogue', () => {
    expect(parseItemType('tempe:alt2')).toMatchObject({ kind: { id: 'tempe' }, variant: 'alt2' });
    expect(parseItemType('sate')).toMatchObject({ kind: { id: 'sate' }, variant: 'original' });
    for (const bad of ['apple', 'tempe:blue', 'tempe:original', 'tempe:alt1:x', '']) expect(parseItemType(bad)).toBeNull();
  });

  it('never lets two variants of a kind make a triple together', () => {
    const state = createGame({
      id: 'variants',
      shelves: [[['tempe', 'tempe', null]], [['tempe:alt1', 'tempe', 'tempe:alt1']], [['tempe:alt1', null, null]]],
    });
    // An alt1 tempe next to two original ones: no triple.
    const mixed = moveItem(state, { shelf: 1, layer: 0, slot: 0 }, { shelf: 0, layer: 0, slot: 2 });
    expect(mixed.ok && mixed.events.some((e) => e.kind === 'tripleCleared')).toBe(false);
    // The original one completes it.
    const same = moveItem(state, { shelf: 1, layer: 0, slot: 1 }, { shelf: 0, layer: 0, slot: 2 });
    expect(same.ok && same.events.some((e) => e.kind === 'tripleCleared')).toBe(true);
  });
});

describe('levels use catalogue ids', () => {
  it('refers only to item types from the catalogue', () => {
    for (const level of levels) {
      const state = createGame(level);
      const types = [
        ...state.shelves.flatMap((s) => s.layers.flat().flatMap((i) => (i ? [i.type] : []))),
        ...state.tracks.flatMap((t) => t.carriers.flatMap((c) => (c.kind === 'stack' ? c.stack.map((i) => i.type) : []))),
      ];
      for (const type of types) expect(parseItemType(type), `${level.id}: ${type}`).not.toBeNull();
    }
  });
});
