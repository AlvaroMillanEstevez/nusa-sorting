import { describe, expect, it } from 'vitest';
import { createGame, type LevelDefinition } from '../src/core';
import { applyBeltOverrides, spreadEvenly } from '../src/dev/beltOverrides';

const level: LevelDefinition = {
  id: 'belt',
  shelves: [[['A', 'A', null]], [['B', 'B', null]]],
  mechanics: [{ kind: 'combo' }, { kind: 'conveyor', slots: ['A', null, 'B', null], speed: 0.5 }],
};
const beltOf = (l: LevelDefinition) => l.mechanics!.find((m) => m.kind === 'conveyor')!;

describe('applyBeltOverrides (dev only)', () => {
  it('changes speed and K while keeping the same items and other mechanics', () => {
    const tuned = applyBeltOverrides(level, '?level=8&beltSpeed=1.5&beltSlots=6');
    expect(beltOf(tuned)).toEqual({ kind: 'conveyor', speed: 1.5, slots: ['A', null, null, 'B', null, null] });
    expect(tuned.mechanics![0]).toEqual({ kind: 'combo' });
    expect(() => createGame(tuned)).not.toThrow();
  });

  it('allows a negative speed to reverse the belt', () => {
    expect(beltOf(applyBeltOverrides(level, '?beltSpeed=-1')).speed).toBe(-1);
  });

  it('leaves the level untouched without valid parameters or without a belt', () => {
    for (const search of ['', '?beltSpeed=abc', '?beltSpeed=0', '?beltSlots=1', '?beltSlots=2.5', '?beltSlots=4']) {
      expect(applyBeltOverrides(level, search)).toBe(level);
    }
    const plain: LevelDefinition = { id: 'plain', shelves: level.shelves };
    expect(applyBeltOverrides(plain, '?beltSpeed=2')).toBe(plain);
  });
});

describe('spreadEvenly', () => {
  it('spaces items out in order', () => {
    expect(spreadEvenly(['a', 'b', 'c'], 6)).toEqual(['a', null, 'b', null, 'c', null]);
    expect(spreadEvenly(['a', 'b'], 2)).toEqual(['a', 'b']);
  });
});
