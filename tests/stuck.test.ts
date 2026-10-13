import { describe, expect, it } from 'vitest';
import {
  canProgress,
  continueAfterBlocked,
  continueByShuffling,
  createGame,
  dropHeld,
  freeFrontSlots,
  isBlocked,
  isShelfLocked,
  isStuck,
  moveItem,
  pickFromTrack,
  stackOf,
  type GameEvent,
  type GameState,
  type LevelDefinition,
  type MechanicDefinition,
  type MoveResult,
} from '../src/core';
import { levels } from '../src/data/levels';
import { CASUAL, playGreedy, rng } from '../tools/simulator';
import { hunt } from '../tools/check/stuckHunt';

/**
 * Brute force, independent of canProgress: tries every sequence of moves (between shelves and from tracks) and
 * says whether one clears a triple or brings a layer forward. Equivalent boards are seen once (front order does
 * not matter on a shelf without the blocker). Null if it gives up (too many boards).
 */
function bruteForce(start: GameState, limit = 6000): boolean | null {
  const progress = (events: readonly GameEvent[]) => events.some((e) => e.kind === 'tripleCleared' || e.kind === 'layerAdvanced');
  const key = (s: GameState) =>
    s.shelves
      .map((shelf, i) => {
        const front = shelf.layers[0]!.map((item) => item?.type ?? '.');
        return (s.blocker?.at.shelf === i ? front : front.sort()).join(',') + `|${shelf.layers.length}`;
      })
      .join('/') +
    '#' +
    s.tracks.map((t) => t.carriers.map((c) => stackOf(c).length).join(',')).join(';');
  // Moves are checked by the game itself; a "stuck" verdict from it is ignored so the search goes on.
  const reopen = (s: GameState) => (s.status === 'lost' && s.loseReason === 'stuck' ? { ...s, status: 'playing' as const, loseReason: null } : s);
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    if (seen.size > limit) return null;
    const state = queue.shift()!;
    const targets = state.shelves.flatMap((_, t) => freeFrontSlots(state, t).map((slot) => ({ shelf: t, layer: 0, slot })));
    const results: MoveResult[] = [];
    state.shelves.forEach((shelf, s) => {
      if (isShelfLocked(state, s)) return;
      shelf.layers[0]!.forEach((item, slot) => {
        if (item) for (const to of targets) results.push(moveItem(state, { shelf: s, layer: 0, slot }, to));
      });
    });
    state.tracks.forEach((track, t) =>
      track.carriers.forEach((_, c) => {
        const picked = pickFromTrack(state, { track: t, carrier: c });
        if (picked.ok) for (const to of targets) results.push(dropHeld(picked.state, to));
      }),
    );
    for (const result of results) {
      if (!result.ok) continue;
      if (progress(result.events)) return true;
      const next = reopen(result.state);
      if (next.status !== 'playing') continue;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return false;
}

/** A small random level: 3-5 shelves with back layers, sometimes a blocker, a locked shelf or a track of stacks. */
function randomLevel(random: () => number, id: number): LevelDefinition | null {
  const pick = (n: number) => Math.floor(random() * n);
  const shelfCount = 3 + pick(2);
  const layers = Array.from({ length: shelfCount }, () => 1 + pick(2));
  const stacks = random() < 0.4 ? Array.from({ length: 1 + pick(2) }, () => 1 + pick(3)) : [];
  const slots = layers.reduce((n, l) => n + l * 3, 0) + stacks.reduce((n, d) => n + d, 0);
  const empties = 1 + pick(4);
  const items = Math.floor((slots - empties) / 3) * 3;
  const kinds = Array.from({ length: items / 3 }, (_, i) => `k${i}`);
  const bag = kinds.flatMap((k) => [k, k, k]).sort(() => random() - 0.5);
  // Empty slots go to the fronts only (back layers are full, as in real levels).
  let holes = slots - items;
  const shelves = layers.map((count) => Array.from({ length: count }, () => [null, null, null] as (string | null)[]));
  const stackItems = stacks.map((depth) => Array.from({ length: depth }, () => bag.pop()!));
  const fronts = shelves.flatMap((_, s) => [0, 1, 2].map((slot) => ({ s, slot })));
  const emptyFronts = new Set<string>();
  while (holes > 0) {
    const f = fronts[pick(fronts.length)]!;
    if (emptyFronts.has(`${f.s}:${f.slot}`)) continue;
    emptyFronts.add(`${f.s}:${f.slot}`);
    holes--;
  }
  shelves.forEach((shelf, s) => shelf.forEach((layer, l) => layer.forEach((_, slot) => {
    if (l === 0 && emptyFronts.has(`${s}:${slot}`)) return;
    layer[slot] = bag.pop() ?? null;
  })));
  if (bag.length > 0) return null;
  const mechanics: MechanicDefinition[] = [];
  const empty = [...emptyFronts][0];
  if (empty && random() < 0.3) {
    const [s, slot] = empty.split(':').map(Number);
    mechanics.push({ kind: 'roamingBlocker', start: { shelf: s!, slot: slot! }, seed: 7, removeAtCombo: 9 });
  }
  if (random() < 0.25) mechanics.push({ kind: 'lockedShelves', shelves: [{ shelf: pick(shelfCount), triplesRequired: 1 }] });
  if (stackItems.length > 0) mechanics.push({ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 1, carriers: stackItems }] });
  return { id: `random-${id}`, shelves, mechanics };
}

/** Plays random valid moves, without letting the game declare a stuck board lost. */
function wander(state: GameState, random: () => number, moves: number): GameState {
  for (let i = 0; i < moves && state.status === 'playing'; i++) {
    const targets = state.shelves.flatMap((_, t) => freeFrontSlots(state, t).map((slot) => ({ shelf: t, layer: 0, slot })));
    const sources = state.shelves.flatMap((shelf, s) =>
      isShelfLocked(state, s) ? [] : shelf.layers[0]!.flatMap((item, slot) => (item ? [{ shelf: s, layer: 0, slot }] : [])),
    );
    if (targets.length === 0 || sources.length === 0) break;
    const result = moveItem(state, sources[Math.floor(random() * sources.length)]!, targets[Math.floor(random() * targets.length)]!);
    if (result.ok) state = result.state.loseReason === 'stuck' ? { ...result.state, status: 'playing', loseReason: null } : result.state;
  }
  return state;
}

/** Level 12 as Koke left it: two free slots and the blocker, every kind short of three in view. */
const level12Stuck: LevelDefinition = {
  id: 'nusa-012-stuck',
  timeLimitSeconds: 130,
  shelves: [
    [[null, 'sate', 'rendang']],
    [['sate', 'rendang', 'mie-goreng'], ['batik', 'wayang-kulit', 'peci']],
    [['peci', 'durian', 'nasi-goreng'], ['kendang', 'cabai', 'kendang']],
    [[null, 'panjat-pinang', 'mie-goreng'], ['manggis', 'cabai', 'terompet']],
    [['nasi-goreng', 'wayang-kulit', 'blangkon'], ['ketupat', 'panjat-pinang', 'sate']],
    [['terompet', 'durian', 'batik'], ['nasi-goreng', 'peci', 'cabai']],
    [['ketupat', 'wayang-kulit', 'batik'], ['rendang', 'gado-gado', 'mie-goreng'], ['gado-gado', 'blangkon', 'durian']],
    [['terompet', 'panjat-pinang', 'blangkon'], ['ketupat', 'gado-gado', 'manggis']],
    [['manggis', null, 'kendang']],
  ],
  mechanics: [{ kind: 'roamingBlocker', start: { shelf: 8, slot: 1 }, seed: 945465, removeAtCombo: 4 }],
};

describe('stuck boards', () => {
  it('canProgress agrees with a brute-force search on hundreds of random boards and positions', () => {
    const random = rng(2026);
    let compared = 0;
    let stuck = 0;
    for (let i = 0; compared < 300 && i < 4000; i++) {
      const level = randomLevel(random, i);
      if (!level) continue;
      let state: GameState;
      try {
        state = createGame(level);
      } catch {
        continue;
      }
      state = wander(state, random, Math.floor(random() * 8));
      if (state.status !== 'playing' || isBlocked(state)) continue;
      const truth = bruteForce(state);
      if (truth === null) continue;
      expect(canProgress(state), level.id).toBe(truth);
      compared++;
      if (!truth) stuck++;
    }
    expect(compared).toBe(300);
    // Both answers come up often enough for the comparison to mean something.
    expect(stuck).toBeGreaterThan(30);
  }, 120_000);

  it('level 12: two free slots and the blocker, every kind short of three in view, is stuck; one more free slot or one more copy in view is not', () => {
    // Fronts: 9 shelves; shelf 8 holds the blocker in slot 1; shelves 0 and 3 have a free slot each.
    const state = createGame(level12Stuck);
    expect(isBlocked(state)).toBe(false);
    expect(isStuck(state)).toBe(true);

    // The same board with a third free slot: shelf 0 (no layers behind) gives up its 'rendang'... it then has
    // room to empty a front with a layer behind.
    const roomier: GameState = { ...state, shelves: state.shelves.map((shelf, s) => (s === 0 ? { layers: [[null, shelf.layers[0]![1]!, null]] } : shelf)) };
    expect(canProgress(roomier)).toBe(true);

    // Or a third 'sate' in view instead of the 'mie-goreng' on shelf 3.
    const sate = state.shelves[0]!.layers[0]![1]!;
    const thirdInView: GameState = {
      ...state,
      shelves: state.shelves.map((shelf, s) => (s === 3 ? { layers: [[null, shelf.layers[0]![1]!, { ...sate, id: 999 }], ...shelf.layers.slice(1)] } : shelf)),
    };
    expect(canProgress(thirdInView)).toBe(true);
  });

  it('a stack copy within reach of the free slots is a way out; one buried deeper is not', () => {
    // Every other kind needs two copies from the stacks, which never come cheaper than three items taken.
    const at = (depth: number): LevelDefinition => ({
      id: `stack-${depth}`,
      shelves: [[['a', 'b', null]], [['a', 'c', null]], [['d', 'e', 'f'], ['c', 'd', 'e']]],
      mechanics: [
        {
          kind: 'tracks',
          tracks: [
            {
              orientation: 'horizontal',
              speed: 1,
              carriers: [
                [...['c', 'd', 'e'].slice(0, depth), 'a', ...['c', 'd', 'e'].slice(depth)],
                ['b', 'f', 'b', 'f'],
              ],
            },
          ],
        },
      ],
    });
    // Two free slots: the third 'a' at depth 1 costs two items taken, the last of them the 'a' itself.
    for (const depth of [0, 1, 2, 3]) {
      const state = createGame(at(depth));
      expect(canProgress(state), `depth ${depth}`).toBe(depth <= 1);
      expect(bruteForce(state), `depth ${depth}`).toBe(depth <= 1);
    }
  });

  it('a locked shelf neither gives nor takes, and the blocker holds its slot: same verdict as the brute force', () => {
    const base: LevelDefinition = {
      id: 'locks',
      shelves: [[['a', 'b', null]], [['a', 'c', null]], [['b', 'c', 'd']]],
      mechanics: [{ kind: 'tracks', tracks: [{ orientation: 'horizontal', speed: 1, carriers: [['a', 'd', 'd', 'b', 'c']] }] }],
    };
    const variants: [string, MechanicDefinition[], boolean][] = [
      ['open', [], true],
      // Shelf 1 locked: its 'a' is out of reach and its free slot unusable.
      ['locked', [{ kind: 'lockedShelves', shelves: [{ shelf: 1, triplesRequired: 2 }] }], false],
      // The blocker on shelf 1's free slot: one free slot left, and no triple fits on shelf 1.
      ['blocker', [{ kind: 'roamingBlocker', start: { shelf: 1, slot: 2 }, seed: 3 }], true],
    ];
    for (const [name, extra, expected] of variants) {
      const state = createGame({ ...base, id: name, mechanics: [...base.mechanics!, ...extra] });
      expect(canProgress(state), name).toBe(expected);
      expect(bruteForce(state), name).toBe(expected);
    }
  });

  it('ends the level as lost, stuck, on the move that gets there; continuing by removing a triple or shuffling leaves a way on', () => {
    // Any move on that board keeps two free slots and leaves it stuck: the rules end the level there.
    const state = createGame(level12Stuck);
    const moved = moveItem(state, { shelf: 0, layer: 0, slot: 1 }, { shelf: 3, layer: 0, slot: 0 });
    expect(moved.ok && moved.state.loseReason).toBe('stuck');
    expect(moved.ok && moved.events.some((e) => e.kind === 'lost' && e.reason === 'stuck')).toBe(true);
    const lost = (moved as { state: GameState }).state;

    const removed = continueAfterBlocked(lost);
    expect(removed.ok && removed.state.status).toBe('playing');
    expect(removed.ok && canProgress(removed.state)).toBe(true);

    const shuffled = continueByShuffling(lost, rng(3));
    expect(shuffled.ok && shuffled.state.status).toBe('playing');
    expect(shuffled.ok && canProgress(shuffled.state)).toBe(true);
    // Not after running out of time.
    expect(continueByShuffling({ ...lost, loseReason: 'timeUp' }, rng(3)).ok).toBe(false);
  });

  it('happens in real play: the casual player reaches stuck boards in level 12, which the rules now end at once', () => {
    const level = levels[11]!;
    const random = rng(12);
    const outcomes = Array.from({ length: 60 }, () => playGreedy(createGame(level), random, CASUAL));
    expect(outcomes.some((o) => o.loseReason === 'stuck')).toBe(true);
  });

  it('never keeps the last way on behind the roaming blocker: alone in a front with layers behind, with nothing else to do, it jumps away', () => {
    // As Koke met it in the last levels: room everywhere, every kind's third copy behind the blocker.
    const level: LevelDefinition = {
      id: 'blocker-alone',
      shelves: [
        [['x', null, null], ['k', 'g', 'p'], ['x', 'x', null]],
        [['k', 'k', null]],
        [['g', 'g', null]],
        [['p', 'p', null]],
      ],
      mechanics: [{ kind: 'roamingBlocker', start: { shelf: 0, slot: 1 }, seed: 11, removeAtCombo: 9 }],
    };
    const state = createGame(level);
    expect(canProgress(state)).toBe(true);
    expect(bruteForce(state)).toBe(true);
    // Taking the last item from around the blocker: it jumps to another shelf and the layer behind comes forward.
    const moved = moveItem(state, { shelf: 0, layer: 0, slot: 0 }, { shelf: 1, layer: 0, slot: 2 });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.events.some((e) => e.kind === 'blockerMoved')).toBe(true);
    expect(moved.events.some((e) => e.kind === 'layerAdvanced' && e.shelf === 0)).toBe(true);
    expect(moved.state.blocker?.at.shelf).not.toBe(0);
    expect(moved.state.status).toBe('playing');
    expect(moved.state.shelves[0]!.layers[0]!.map((item) => item?.type)).toEqual(['k', 'g', 'p']);

    // While something else can still make progress (three 'y' to gather), the blocker holds its slot and the
    // layer waits, as always.
    const busy = createGame({ ...level, id: 'blocker-busy', shelves: [...level.shelves, [['y', 'y', null]], [['y', null, null]]] });
    const waited = moveItem(busy, { shelf: 0, layer: 0, slot: 0 }, { shelf: 1, layer: 0, slot: 2 });
    expect(waited.ok).toBe(true);
    if (!waited.ok) return;
    expect(waited.events.some((e) => e.kind === 'blockerMoved' || e.kind === 'layerAdvanced')).toBe(false);
    expect(waited.state.blocker?.at.shelf).toBe(0);
    expect(waited.state.status).toBe('playing');
  });

  it('in simulated games on every level and arrangement, never ends a board as stuck that has a way on', () => {
    // A sensible player and a random one, with boosters and continues now and then: at every state the rules'
    // verdict matches an independent search of the same reasoning (a search of every move sequence, as in the
    // random boards above, cannot finish on boards this big; tools/check/stuck-hunt.mjs runs both at length).
    const { disagree, checked, games } = hunt(2, 0);
    expect(games).toBeGreaterThan(700);
    expect(checked).toBeGreaterThan(50);
    expect(disagree.map((d) => `${d.level} #${d.arrangement}`)).toEqual([]);
  }, 300_000);

  it('is fast: well under a millisecond per check on the biggest levels', () => {
    const random = rng(5);
    const states: GameState[] = [];
    for (const level of levels) {
      let state = createGame(level);
      for (let i = 0; i < 20; i++) states.push((state = wander(state, random, 3)));
    }
    const start = performance.now();
    for (let round = 0; round < 20; round++) for (const state of states) canProgress(state);
    const perCheck = (performance.now() - start) / (20 * states.length);
    expect(perCheck).toBeLessThan(0.2);
  });
});
