import { generateLevel, type GeneratedLevel } from './generate';
import { constName, levelSource } from './format';
import { RECIPES, recipeFor } from './recipes';

export interface OutputFile {
  readonly path: string;
  readonly content: string;
}

export interface RunResult {
  readonly files: OutputFile[];
  readonly summary: string;
}

/**
 * `levelgen all` regenerates every level; `levelgen 3` one level; `levelgen 3 --seed 77` one level with
 * another seed. Returns the files to write (the runner writes them) and a summary to print.
 */
export function main(args: readonly string[]): RunResult {
  const seedFlag = args.indexOf('--seed');
  const seed = seedFlag === -1 ? undefined : Number(args[seedFlag + 1]);
  const targets = args.filter((a, i) => a !== '--seed' && (seedFlag === -1 || i !== seedFlag + 1));
  if (targets.length === 0) throw new Error('usage: levelgen all | <level number> [--seed N]');
  const recipes = targets.includes('all') ? RECIPES : targets.map((t) => recipeFor(Number(t)));
  if (seed !== undefined && (recipes.length !== 1 || !Number.isInteger(seed))) {
    throw new Error('--seed takes an integer and applies to one level at a time');
  }

  const generated: GeneratedLevel[] = recipes.map((recipe) => {
    const started = Date.now();
    const result = generateLevel(recipe, seed ?? recipe.seed);
    console.log(`${recipe.id}: candidate ${result.attempt} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    return result;
  });
  const files = generated.map((g) => ({ path: `src/data/levels/${g.level.id}.ts`, content: levelSource(g) }));
  return { files, summary: summaryTable(generated) };
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** One line per level: its shape and the simulator's figures. */
export function summaryTable(levels: readonly GeneratedLevel[]): string {
  return levels
    .map(({ level, stats, itemPx, recipe }) => {
      const kinds = new Set([...level.shelves.flat(2), ...(level.mechanics ?? []).flatMap((m) => (m.kind === 'tracks' ? m.tracks.flatMap((t) => t.carriers.flat()) : []))].filter((k) => typeof k === 'string'));
      const layers = Math.max(...level.shelves.map((s) => s.length));
      return [
        `L${recipe.number} ${constName(level.id)}`,
        `${level.shelves.length} shelves`,
        `layers≤${layers}`,
        `${kinds.size} kinds`,
        `${level.timeLimitSeconds}s`,
        `win ${pct(stats.winRate)} blocked ${pct(stats.blockedRate)} timeUp ${pct(stats.timeUpRate)}`,
        `items ${itemPx.portrait}/${itemPx.landscape}px`,
      ].join(' | ');
    })
    .join('\n');
}
