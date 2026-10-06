import { arrangementCount, createGame, withArrangement, type LevelDefinition } from '../../src/core';
import { CASUAL, EXPERT, freeSlots, simulate, type SimulationStats } from '../simulator';

const pct = (share: number) => `${Math.round(share * 100)}%`;
const range = (values: readonly number[], show: (v: number) => string) => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return show(low) === show(high) ? show(low) : `${show(low)}-${show(high)}`;
};

/** Items in a level: on its shelves and in its track stacks. */
export function itemCount(level: LevelDefinition): number {
  const state = createGame(level);
  const onShelves = state.shelves.reduce((sum, s) => sum + s.layers.flat().filter(Boolean).length, 0);
  const onTracks = state.tracks.reduce((sum, t) => sum + t.carriers.reduce((n, c) => n + (c.kind === 'stack' ? c.stack.length : 0), 0), 0);
  return onShelves + onTracks;
}

/**
 * One line per level on how full its board is: free slots at the start, free slots on average during the
 * simulated games, space pressure (share of moves with two free slots or fewer) and the simulated results of
 * the casual player, then the expert's wins and pressure, over all its arrangements (a range where they differ).
 */
export function spaceReport(levels: readonly LevelDefinition[]): string {
  const header = 'level | items | free at start | mean free | pressure | casual win | blocked | time up | expert win | expert pressure';
  const lines = levels.map((level, i) => {
    const arranged = Array.from({ length: arrangementCount(level) }, (_, k) => withArrangement(level, k));
    const stats: SimulationStats[] = arranged.map((l) => simulate(createGame(l), 200, 1, CASUAL));
    const expert: SimulationStats[] = arranged.map((l) => simulate(createGame(l), 200, 1, EXPERT));
    return [
      `L${i + 1}`,
      itemCount(level),
      range(arranged.map((l) => freeSlots(createGame(l))), String),
      range(stats.map((s) => s.avgFree), (v) => v.toFixed(1)),
      range(stats.map((s) => s.pressure), pct),
      range(stats.map((s) => s.winRate), pct),
      range(stats.map((s) => s.blockedRate), pct),
      range(stats.map((s) => s.timeUpRate), pct),
      range(expert.map((s) => s.winRate), pct),
      range(expert.map((s) => s.pressure), pct),
    ].join(' | ');
  });
  return [header, ...lines].join('\n');
}
