/**
 * Measures every arrangement of the given levels against its recipe's bands (casual wins, time-ups, space pressure,
 * expert wins), as tests/levelArrangements.test.ts checks them, printing each as soon as it is measured.
 * Usage: node tools/check/bands.mjs 12 17 23
 */
import { arrangementCount, withArrangement } from '../../src/core';
import { levels } from '../../src/data/levels';
import { levelStats } from '../levelgen/generate';
import { recipeFor } from '../levelgen/recipes';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const band = ([a, b]: readonly [number, number]) => `${pct(a)}-${pct(b)}`;
export function main(numbers: number[]): void {
  for (const n of numbers) {
    const level = levels[n - 1]!;
    const recipe = recipeFor(n);
    for (let i = 0; i < arrangementCount(level); i++) {
      const s = levelStats(withArrangement(level, i));
      const inBand = (v: number, [a, b]: readonly [number, number]) => v >= a - 1e-9 && v <= b + 1e-9;
      const ok = inBand(s.casual.winRate, recipe.winBand) && inBand(s.casual.timeUpRate, recipe.time.timeUp) && (!recipe.pressure || inBand(s.casual.pressure, recipe.pressure)) && (!recipe.expertBand || inBand(s.expert.winRate, recipe.expertBand));
      console.log(`L${n} #${i}: casual ${pct(s.casual.winRate)} [${band(recipe.winBand)}] timeUp ${pct(s.casual.timeUpRate)} pressure ${pct(s.casual.pressure)}${recipe.pressure ? ` [${band(recipe.pressure)}]` : ''} expert ${pct(s.expert.winRate)}${recipe.expertBand ? ` [${band(recipe.expertBand)}]` : ''} ${ok ? 'ok' : 'OUT'}`);
    }
  }
}
