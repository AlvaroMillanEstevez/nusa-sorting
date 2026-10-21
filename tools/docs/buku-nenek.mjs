// Writes docs/buku-nenek.md from src/data/bukuNenek.ts (see bukuNenek.ts). Usage: node tools/docs/buku-nenek.mjs
import { writeFileSync } from 'node:fs';
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./bukuNenek.ts', import.meta.url).pathname);
writeFileSync(new URL('../../docs/buku-nenek.md', import.meta.url), module.main());
console.log('wrote docs/buku-nenek.md');
