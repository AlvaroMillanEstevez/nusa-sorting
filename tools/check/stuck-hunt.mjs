// Hunts false "no moves left" verdicts in simulated games (see stuckHunt.ts). Usage:
//   node tools/check/stuck-hunt.mjs [runs per arrangement] [search limit] [level id or ''] [--explain]
// --explain prints every stuck ending with 3 or more free slots (the suspicious ones) and why it is stuck.
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./stuckHunt.ts', import.meta.url).pathname);
console.log(module.main(process.argv.slice(2)));
