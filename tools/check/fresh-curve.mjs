// Fresh foods across the shipped levels (see freshCurve.ts). Usage:
//   node tools/check/fresh-curve.mjs [games] [path to an older checkout's src/data/levels/index.ts]
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./freshCurve.ts', import.meta.url).pathname);
const before = process.argv[3] ? (await runnerImport(process.argv[3])).module.levels : null;
console.log(module.main(Number(process.argv[2] ?? 200), before));
