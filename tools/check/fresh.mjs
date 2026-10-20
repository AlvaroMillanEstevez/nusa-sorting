// Fresh-food demos in simulated games (see fresh.ts). Usage: node tools/check/fresh.mjs [games]
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./fresh.ts', import.meta.url).pathname);
console.log(module.main(Number(process.argv[2] ?? 300)));
