// Measures levels' arrangements against their bands (see bands.ts). Usage: node tools/check/bands.mjs 12 17 23
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./bands.ts', import.meta.url).pathname);
module.main(process.argv.slice(2).map(Number));
