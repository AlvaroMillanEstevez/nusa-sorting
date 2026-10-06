import { generateArrangements, generateLevel, isPinned, MIN_NEW_ARRANGEMENTS, winRange, type WithArrangements } from './generate';
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

  const generated: WithArrangements[] = recipes.map((recipe) => {
    const started = Date.now();
    const levelSeed = seed ?? recipe.seed;
    let result = generateLevel(recipe, levelSeed);
    const searching = !isPinned(recipe, levelSeed);
    let arrangements = generateArrangements(result.level, recipe, result.seed, searching);
    while (searching && arrangements.length + 1 < MIN_NEW_ARRANGEMENTS) {
      console.log(`  ${recipe.id}: candidate ${result.attempt} has only ${arrangements.length + 1} arrangements, searching on`);
      result = generateLevel(recipe, levelSeed, 4000, result.attempt + 1);
      arrangements = generateArrangements(result.level, recipe, result.seed, true);
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${recipe.id}: candidate ${result.attempt}, ${arrangements.length + 1} arrangements, in ${seconds} s`);
    return { ...result, level: { ...result.level, arrangements: arrangements.map((a) => a.arrangement) }, arrangements };
  });
  const files = generated.map((g) => ({ path: `src/data/levels/${g.level.id}.ts`, content: levelSource(g) }));
  return { files, summary: summaryTable(generated) };
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** One line per level: its shape and the simulator's figures. */
export function summaryTable(levels: readonly WithArrangements[]): string {
  return levels
    .map((generated) => {
      const { level, stats, itemPx, recipe } = generated;
      const [low, high] = winRange(generated);
      const kinds = new Set([...level.shelves.flat(2), ...(level.mechanics ?? []).flatMap((m) => (m.kind === 'tracks' ? m.tracks.flatMap((t) => t.carriers.flat()) : []))].filter((k) => typeof k === 'string'));
      const layers = Math.max(...level.shelves.map((s) => s.length));
      return [
        `L${recipe.number} ${constName(level.id)}`,
        `${level.shelves.length} shelves`,
        `layers≤${layers}`,
        `${kinds.size} kinds`,
        `${level.timeLimitSeconds}s`,
        `win ${pct(stats.winRate)} blocked ${pct(stats.blockedRate)} timeUp ${pct(stats.timeUpRate)}`,
        `${generated.arrangements.length + 1} arrangements, win ${pct(low)}-${pct(high)}`,
        `items ${itemPx.portrait}/${itemPx.landscape}px`,
      ].join(' | ');
    })
    .join('\n');
}
