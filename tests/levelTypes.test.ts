import { describe, expect, it } from 'vitest';
import { areConfusable, ITEM_KINDS, parseItemType, STARTER_KINDS } from '../src/data/itemCatalog';
import { chooseTypes, KIND_ORDER, planTypes, ROTATION } from '../tools/levelgen/types';

const kindOf = (type: string) => parseItemType(type)!.kind;
const themed = (theme: string) => ITEM_KINDS.filter((k) => k.theme === theme).map((k) => k.id);

describe('choosing a level’s item types', () => {
  it('prefers the starter set when nothing has been used yet', () => {
    expect(KIND_ORDER.slice(0, STARTER_KINDS.length)).toEqual(STARTER_KINDS);
    expect(chooseTypes(1, 6, new Map())).toEqual(STARTER_KINDS.slice(0, 6));
  });

  it('never uses a cultural object before its theme’s level, and uses them all in that level', () => {
    for (const type of chooseTypes(4, 26, new Map())) expect(kindOf(type).theme).toBeUndefined();
    const five = chooseTypes(5, 12, new Map());
    expect(five.slice(0, 7)).toEqual(themed('budaya-jawa'));
    expect(five.some((t) => kindOf(t).theme === '17-agustus')).toBe(false);
  });

  it('lets kinds rest: those used in the last levels come after the ones that were not', () => {
    const history = new Map([[1, STARTER_KINDS.slice(0, 6)]]);
    const two = chooseTypes(2, 6, history);
    for (const type of two.slice(0, 4)) expect(STARTER_KINDS.slice(0, 6)).not.toContain(type);
    // More than `rest` levels later a kind is as due as one never used (rest 1: level 3 after level 1).
    expect(chooseTypes(3, 6, history, { ...ROTATION, rest: 1 })).toEqual(STARTER_KINDS.slice(0, 6));
  });

  it('shows a theme’s objects more often in the levels after its own', () => {
    const levels = [5, 6, 7, 8, 9].map((number) => ({ number, types: 10 }));
    const count = (plan: Map<number, string[]>) =>
      [6, 7, 8, 9].reduce((sum, n) => sum + plan.get(n)!.filter((t) => kindOf(t).theme === 'budaya-jawa').length, 0);
    const featured = count(planTypes(levels));
    const plain = count(planTypes(levels, { ...ROTATION, featureBonus: 0 }));
    expect(featured).toBeGreaterThan(plain);
  });

  it('keeps look-alikes apart while it can, and uses colour variants only when every unlocked kind is in', () => {
    const many = chooseTypes(1, 22, new Map());
    for (const a of many) for (const b of many) expect(areConfusable(a, b), `${a} ${b}`).toBe(false);
    const food = ITEM_KINDS.filter((k) => !k.theme).length;
    const all = chooseTypes(1, food, new Map());
    expect(all.every((t) => parseItemType(t)?.variant === 'original')).toBe(true);
    const more = chooseTypes(1, food + 2, new Map());
    expect(more.slice(food).every((t) => parseItemType(t)?.variant === 'alt1')).toBe(true);
    expect(() => chooseTypes(1, food * 3 + 1, new Map())).toThrow();
  });

  it('keeps the types a level pins, and plans the rest around them', () => {
    const plan = planTypes([
      { number: 1, types: 3, fixedTypes: ['salak', 'cabai', 'jamu'] },
      { number: 2, types: 3 },
    ]);
    expect(plan.get(1)).toEqual(['salak', 'cabai', 'jamu']);
    expect(plan.get(2)).toEqual(STARTER_KINDS.slice(0, 3));
  });
});
