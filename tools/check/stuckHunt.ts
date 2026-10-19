import { arrangementCount, bestTripleTarget, canProgress, continueAfterBlocked, continueByShuffling, createGame, removeTriple, shuffleBoard, freeFrontSlots, isShelfLocked, moveItem, pickFromTrack, dropHeld, stackOf, withArrangement, type GameEvent, type GameState, type MoveResult } from '../../src/core';
import { levels } from '../../src/data/levels';
import { applyMove, rng, validMoves, type Move } from '../simulator';

/**
 * Plays many games on every level and arrangement, half greedy and half at random, and whenever the rules end a
 * game as stuck, searches every move sequence from there for a way to clear a triple or bring a layer forward.
 * A way found is a false stuck (canProgress must never call a board stuck that has one). Internal tool.
 */

const progress = (events: readonly GameEvent[]) => events.some((e) => e.kind === 'tripleCleared' || e.kind === 'layerAdvanced');

function key(s: GameState): string {
  const shelves = s.shelves
    .map((shelf, i) => {
      const front = shelf.layers[0]!.map((item) => item?.type ?? '.');
      return (s.blocker?.at.shelf === i ? front : front.sort()).join(',') + `|${shelf.layers.length}`;
    })
    .join('/');
  const tracks = s.tracks.map((t) => t.carriers.map((c) => stackOf(c).map((i) => i.type).join(',')).join(';')).join('#');
  return `${shelves}#${tracks}#${s.closed.map((c) => (c ? 'x' : '.')).join('')}`;
}

/** True if some sequence of moves makes progress, false if none does, null if it gave up. */
export function bruteForce(start: GameState, limit: number): boolean | null {
  const reopen = (s: GameState) => (s.status === 'lost' && (s.loseReason === 'stuck' || s.loseReason === 'blocked') ? { ...s, status: 'playing' as const, loseReason: null } : s);
  const seen = new Set([key(start)]);
  const queue = [reopen(start)];
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

/**
 * An independent answer to "can this board still make progress?", by search rather than by counting: any
 * arrangement of the front items is reachable once a usable slot is free, so a state is the multiset of usable
 * front items, the free slots and how much of each stack has been taken; from it a triple is possible if some kind
 * has three copies and a shelf can hold them, a layer can come forward if a shelf with layers behind can be
 * emptied, and otherwise any stack's top can be taken into a free slot.
 */
export function searchProgress(state: GameState): boolean {
  const open = (s: number) => !isShelfLocked(state, s) && !state.closed[s];
  let free = 0;
  const counts = new Map<string, number>();
  let holdShelf = false;
  let emptyable = false;
  state.shelves.forEach((shelf, s) => {
    if (!open(s)) return;
    const blocked = state.blocker?.at.shelf === s ? state.blocker.at.slot : null;
    shelf.layers[0]!.forEach((item, i) => {
      if (i === blocked) return;
      if (item) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
      else free++;
    });
    // Where the blocker stands a triple never fits and the layer behind waits (it only moves after a triple).
    if (blocked === null) {
      holdShelf = true;
      if (shelf.layers.length > 1) emptyable = true;
    }
  });
  if (free === 0) return false;
  if (emptyable && free >= 3) return true;
  if (!holdShelf) return false;
  const stacks = state.tracks.flatMap((track, t) =>
    track.carriers.map((carrier, c) => {
      const stack = stackOf(carrier).map((i) => i.type);
      return state.held && state.held.from.track === t && state.held.from.carrier === c ? [state.held.item.type, ...stack] : stack;
    }),
  );
  const seen = new Set<string>();
  const visit = (taken: number[], have: Map<string, number>, room: number): boolean => {
    for (const n of have.values()) if (n >= 3) return true;
    if (room === 0) return false;
    const k = taken.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    for (let i = 0; i < stacks.length; i++) {
      const next = stacks[i]![taken[i]!];
      if (next === undefined) continue;
      const more = new Map(have);
      more.set(next, (more.get(next) ?? 0) + 1);
      const t2 = taken.slice();
      t2[i]!++;
      if (visit(t2, more, room - 1)) return true;
    }
    return false;
  };
  return visit(stacks.map(() => 0), counts, free);
}

export interface Found {
  level: string;
  arrangement: number;
  run: number;
  state: GameState;
}

/** Hunts false stucks; returns them, with how many stuck endings were checked and how many searches gave up. */
export function hunt(runsPerArrangement = 6, limit = 60_000, only?: string, verbose = false): { found: Found[]; disagree: Found[]; checked: number; gaveUp: number; games: number } {
  const found: Found[] = [];
  let checked = 0;
  let gaveUp = 0;
  let games = 0;
  let moveCount = 0;
  let compared = 0;
  const disagree: Found[] = [];
  const endings: Record<string, number> = {};
  for (const written of levels) {
    if (only && written.id !== only) continue;
    for (let a = 0; a < arrangementCount(written); a++) {
      const level = withArrangement(written, a);
      for (let run = 0; run < runsPerArrangement; run++) {
        games++;
        const random = rng(1000 * a + run + 1);
        const greedy = run % 2 === 0;
        let state = createGame(level);
        let m = 0;
        for (; m < 2000 && state.status === 'playing'; m++) {
          const moves = validMoves(state).filter(([from, to]) => !('shelf' in from) || from.shelf !== to.shelf);
          if (moves.length === 0) break;
          // A sensible but imperfect player: clears or pairs when it sees how, avoids filling the board, and
          // otherwise (or now and then anyway) moves at random.
          const scored = moves.map((mv) => {
            const r = applyMove(state, mv);
            if (!r.ok) return { mv, score: -1 };
            if (progress(r.events)) return { mv, score: 3 };
            if (r.state.status === 'lost') return { mv, score: 0 };
            const [, to] = mv;
            const type = 'shelf' in mv[0] ? state.shelves[mv[0].shelf]!.layers[0]![mv[0].slot]!.type : stackOf(state.tracks[mv[0].track]!.carriers[mv[0].carrier]!)[0]!.type;
            const pairs = state.shelves[to.shelf]!.layers[0]!.some((it) => it?.type === type);
            return { mv, score: pairs ? 2 : 1 };
          });
          const careful = greedy ? 0.85 : 0.6;
          const best = Math.max(...scored.map((x) => x.score));
          const pool = random() < careful ? scored.filter((x) => x.score === best) : scored.filter((x) => x.score >= 1 || best < 1);
          const move: Move = (pool.length ? pool : scored)[Math.floor(random() * (pool.length ? pool.length : scored.length))]!.mv;
          // Now and then a booster, as players use them.
          const roll = random();
          const result = roll < 0.03 && bestTripleTarget(state) ? removeTriple(state, bestTripleTarget(state)!) : roll < 0.05 ? shuffleBoard(state, random) : applyMove(state, move);
          if (!result.ok) continue;
          state = result.state;
          compared++;
          // Every state in play: the rules' answer against the search's.
          const probe = state.status === 'lost' && state.loseReason === 'stuck' ? { ...state, status: 'playing' as const, loseReason: null } : state;
          if (probe.status === 'playing' && canProgress(probe) !== searchProgress(probe)) disagree.push({ level: written.id, arrangement: a, run, state: probe });
          // After a loss to space or a stuck board, sometimes continue (as the game offers).
          if (state.status === 'lost' && (state.loseReason === 'blocked' || state.loseReason === 'stuck') && random() < 0.5) {
            const reason = state.loseReason;
            const cont = random() < 0.5 ? continueAfterBlocked(state) : continueByShuffling(state, random);
            if (reason === 'stuck') checked++;
            if (reason === 'stuck') {
              const truth = bruteForce(state, limit);
              if (truth === null) gaveUp++;
              if (truth === true) found.push({ level: written.id, arrangement: a, run, state });
            }
            if (cont.ok) {
              state = cont.state;
              continue;
            }
          }
          if (state.status === 'lost' && state.loseReason === 'stuck') {
            checked++;
            const truth = bruteForce(state, limit);
            if (truth === null) gaveUp++;
            if (truth === true) found.push({ level: written.id, arrangement: a, run, state });
            if (verbose && freeOf(state) >= 3) console.log(written.id, a, run, explain(state));
          }
        }
        endings[`${state.status}${state.loseReason ? ':' + state.loseReason : ''}`] = (endings[`${state.status}${state.loseReason ? ':' + state.loseReason : ''}`] ?? 0) + 1;
        moveCount += m;
      }
    }
  }
  if (verbose) {
    console.log(endings, 'moves', moveCount, 'states compared', compared, 'disagreements', disagree.length);
    for (const d of disagree.slice(0, 3)) console.log('DISAGREE', d.level, d.arrangement, d.run, canProgress(d.state), searchProgress(d.state), JSON.stringify(summary(d.state)));
  }
  return { found, disagree, checked, gaveUp, games };
}

/** Why a stuck board is stuck: free slots, and for each kind with copies in view where the missing ones are. */
export function explain(s: GameState): string {
  let free = 0;
  const where = new Map<string, string[]>();
  const add = (type: string, at: string) => where.set(type, [...(where.get(type) ?? []), at]);
  s.shelves.forEach((shelf, i) => {
    const usable = !isShelfLocked(s, i) && !s.closed[i];
    shelf.layers.forEach((layer, l) =>
      layer.forEach((item, slot) => {
        if (!item) {
          if (l === 0 && usable && !(s.blocker?.at.shelf === i && s.blocker.at.slot === slot)) free++;
          return;
        }
        add(item.type, l === 0 && usable ? 'front' : `${isShelfLocked(s, i) ? 'locked' : 'shelf'}${i}L${l}${s.blocker?.at.shelf === i ? '(blocker)' : ''}`);
      }),
    );
  });
  s.tracks.forEach((t) => t.carriers.forEach((c, ci) => stackOf(c).forEach((item, d) => add(item.type, `stack${ci}d${d}`))));
  const kinds = [...where.entries()].map(([k, v]) => `${k}[${v.join(' ')}]`);
  return `free ${free}, triples left ${[...where.values()].reduce((n, v) => n + v.length, 0) / 3}, cleared ${s.triplesCleared}: ${kinds.join('; ')}`;
}

/** Usable free slots of a board. */
function freeOf(s: GameState): number {
  return s.shelves.reduce((n, _, i) => n + freeFrontSlots(s, i).length, 0);
}

export function main(args: readonly string[]): string {
  const { found, disagree, checked, gaveUp, games } = hunt(Number(args[0] ?? 6), Number(args[1] ?? 60_000), args[2] || undefined, args.includes('--explain'));
  const lines = [`${games} games, ${checked} stuck endings searched, ${gaveUp} searches gave up, ${found.length} false stucks, ${disagree.length} states where the rules and the search disagree`];
  for (const f of found.slice(0, 5)) lines.push(`${f.level} arrangement ${f.arrangement} run ${f.run}: ${JSON.stringify(summary(f.state))}`);
  return lines.join('\n');
}

/** A readable board: fronts and back layers by shelf (L locked, C closed, B the blocker), stacks top first. */
export function summary(s: GameState): unknown {
  return {
    shelves: s.shelves.map((shelf, i) => {
      const tags = `${isShelfLocked(s, i) ? 'L' : ''}${s.closed[i] ? 'C' : ''}${s.closesWhenEmpty[i] ? '(closes)' : ''}${s.blocker?.at.shelf === i ? `B${s.blocker.at.slot}` : ''}`;
      return `${i}${tags}: ` + shelf.layers.map((l) => l.map((it) => it?.type ?? '.').join(',')).join(' | ');
    }),
    stacks: s.tracks.map((t) => t.carriers.map((c) => stackOf(c).map((it) => it.type).join(','))),
    triplesCleared: s.triplesCleared,
    unlockAt: s.unlockAt,
  };
}
