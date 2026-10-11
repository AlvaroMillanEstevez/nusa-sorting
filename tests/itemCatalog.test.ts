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
  unlockLevel,
  VARIANTS,
} from '../src/data/itemCatalog';
import { THEMES } from '../src/data/themes';
import { levels as gameLevels } from '../src/data/levels';
import { demoLevels } from './fixtures/demo-levels';

const levels = [...gameLevels, ...demoLevels];

const ids = ITEM_KINDS.map((k) => k.id);

describe('item catalogue', () => {
  it('has 26 food kinds and 55 cultural objects, with stable kebab-case ids and names in English and Indonesian', () => {
    expect(ITEM_KINDS).toHaveLength(81);
    expect(new Set(ids).size).toBe(81);
    expect(ITEM_KINDS.filter((k) => k.category === 'cultural')).toHaveLength(55);
    for (const kind of ITEM_KINDS) {
      expect(kind.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(kind.name.en.length).toBeGreaterThan(0);
      expect(kind.name.id.length).toBeGreaterThan(0);
      expect(['dish', 'snack', 'sweet', 'drink', 'fruit', 'other', 'cultural']).toContain(kind.category);
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

describe('cultural objects', () => {
  it('belong to a theme, and first appear in its level; food is there from level 1', () => {
    const perTheme = (theme: string) => ITEM_KINDS.filter((k) => k.theme === theme).map((k) => k.id);
    expect(perTheme('budaya-jawa')).toEqual(['blangkon', 'batik', 'wayang-kulit', 'kendang', 'gong', 'caping', 'kipas']);
    expect(perTheme('17-agustus')).toEqual(['bendera', 'karung', 'kelereng', 'panjat-pinang', 'peci', 'terompet']);
    expect(perTheme('pasar-malam')).toEqual(['lampion', 'arum-manis', 'balon', 'topeng', 'kembang-api', 'bianglala']);
    expect(perTheme('laut-nusantara')).toEqual(['pinisi', 'kerang', 'bintang-laut', 'jaring', 'layangan', 'kelapa']);
    expect(perTheme('olahraga')).toEqual(['kok', 'raket', 'sepak-takraw', 'sepatu', 'piala', 'peluit']);
    expect(perTheme('permainan-tradisional')).toEqual(['gasing', 'congklak', 'egrang', 'yoyo', 'bekel', 'lompat-tali']);
    expect(perTheme('rempah-maluku')).toEqual(['cengkeh', 'pala', 'kayu-manis', 'lada', 'cobek', 'karung-rempah']);
    expect(perTheme('sawah')).toEqual(['padi', 'cangkul', 'orang-orangan', 'kerbau', 'bakul', 'gubuk']);
    expect(perTheme('fauna-nusantara')).toEqual(['komodo', 'orangutan', 'rangkong', 'penyu', 'cendrawasih', 'tarsius']);
    // The closing festival brings no objects of its own.
    expect(perTheme('festival-nusantara')).toEqual([]);
    for (const kind of ITEM_KINDS) {
      expect(kind.category === 'cultural', kind.id).toBe(kind.theme !== undefined);
      const theme = THEMES.find((t) => t.id === kind.theme);
      expect(unlockLevel(kind), kind.id).toBe(theme ? theme.level : 1);
    }
  });

  it('keeps the whole coconut apart from the coconut drink', () => {
    expect(areConfusable('kelapa', 'es-kelapa-muda')).toBe(true);
  });
});

describe('variants as item types', () => {
  it('gives every kind three variants, each its own item type', () => {
    expect(VARIANTS).toEqual(['original', 'alt1', 'alt2']);
    expect(ALL_ITEM_TYPES).toHaveLength(243);
    expect(new Set(ALL_ITEM_TYPES).size).toBe(243);
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
