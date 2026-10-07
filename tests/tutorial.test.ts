import { describe, expect, it } from 'vitest';
import { arrangementCount, completesFirstTriple, createGame, withArrangement, moveItem, tripleMoves, tutorialMove, type LevelDefinition } from '../src/core';
import { levels } from '../src/data/levels';
import { ruleFailures } from '../tools/levelgen/generate';
import { front } from './helpers';

describe('first-triple tutorial', () => {
  /** S0 [A A .]   S1 [B B .]   S2 [C . A]   S3 [B C C] */
  const level: LevelDefinition = {
    id: 'tutorial',
    shelves: [[['A', 'A', null]], [['B', 'B', null]], [['C', null, 'A']], [['B', 'C', 'C']]],
  };

  it('finds every shelf-to-shelf move that clears a triple', () => {
    expect(tripleMoves(createGame(level))).toEqual([
      { from: front(2, 2), to: front(0, 2) },
      { from: front(3, 0), to: front(1, 2) },
    ]);
  });

  it('points at the shortest hop, and at nothing when no single move clears a triple', () => {
    expect(tutorialMove(createGame(level))).toEqual({ from: front(2, 2), to: front(0, 2) });
    const none: LevelDefinition = { id: 'none', shelves: [[['A', 'B', null]], [['A', 'B', null]], [['A', 'B', null]]] };
    expect(tutorialMove(createGame(none))).toBeNull();
  });

  it('is completed by any move that clears a triple, and not by others', () => {
    const state = createGame(level);
    const plain = moveItem(state, front(2, 0), front(0, 2));
    const triple = moveItem(state, front(3, 0), front(1, 2));
    expect(plain.ok && completesFirstTriple(plain.events)).toBe(false);
    expect(triple.ok && completesFirstTriple(triple.events)).toBe(true);
  });

  it('has a move to show on level 1, as written (arrangement 0) and in every other arrangement', () => {
    const level1 = levels[0]!;
    for (let i = 0; i < arrangementCount(level1); i++) {
      expect(tutorialMove(createGame(withArrangement(level1, i))), `arrangement ${i}`).not.toBeNull();
    }
  });

  it('is a generator rule for levels with the tutorial', () => {
    const none: LevelDefinition = { id: 'none', shelves: [[['A', 'B', null]], [['A', 'B', null]], [['A', 'B', null]]] };
    const rules = { maxDepth: 0, minStartTriples: 0 };
    expect(ruleFailures(none, { ...rules, tutorial: true })).toContain('no single move completes a triple for the tutorial');
    expect(ruleFailures(none, rules)).not.toContain('no single move completes a triple for the tutorial');
    expect(ruleFailures(level, { ...rules, tutorial: true })).not.toContain('no single move completes a triple for the tutorial');
  });
});
