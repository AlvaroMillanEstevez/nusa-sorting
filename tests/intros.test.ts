import { describe, expect, it } from 'vitest';
import { createGame, levelIntros, unseenIntros, type LevelDefinition } from '../src/core';

const plain: LevelDefinition = { id: 'plain', shelves: [[['A', 'A', null]], [['A', 'B', 'B']], [['B', null, null]]] };

describe('mechanic intros', () => {
  it('finds none in a plain level', () => {
    expect(levelIntros(createGame(plain))).toEqual([]);
  });

  it('lists what a level shows, in a fixed order', () => {
    const level: LevelDefinition = {
      id: 'busy',
      shelves: [
        [
          ['A', 'A', null],
          ['C', 'C', 'C'],
        ],
        [['A', 'B', 'B']],
        [['B', null, null]],
        [[null, null, null]],
      ],
      mechanics: [
        { kind: 'lockedShelves', shelves: [{ shelf: 1, triplesRequired: 1 }] },
        { kind: 'roamingBlocker', start: { shelf: 3, slot: 0 }, seed: 1 },
        { kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 0.5, carriers: [['D', 'D'], ['D']] }] },
      ],
    };
    expect(levelIntros(createGame(level))).toEqual(['backLayers', 'lockedShelves', 'roamingBlocker', 'stackTracks']);
  });

  it('recognises shelves riding a track', () => {
    const level: LevelDefinition = {
      ...plain,
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'vertical', speed: 0.3, carriers: [{ shelf: 2 }] }] }],
      layout: { columns: [{ kind: 'shelves', shelves: [0, 1] }, { kind: 'shelfTrack', track: 0 }] },
    };
    expect(levelIntros(createGame(level))).toEqual(['shelfTracks']);
  });

  it('leaves out the ones already seen', () => {
    const layered: LevelDefinition = { id: 'layered', shelves: [[['A', 'A', null], ['B', 'B', 'B']], [['A', null, null]]] };
    expect(unseenIntros(createGame(layered), [])).toEqual(['backLayers']);
    expect(unseenIntros(createGame(layered), ['backLayers', 'unknown-id'])).toEqual([]);
  });
});
