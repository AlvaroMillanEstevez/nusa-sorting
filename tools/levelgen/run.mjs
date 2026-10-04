// Runs the level generator (TypeScript) through Vite, which the project already uses, and writes its files.
// Usage: npm run levelgen -- all | <level number> [--seed N]
import { writeFileSync } from 'node:fs';
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./main.ts', import.meta.url).pathname);
const { files, summary } = module.main(process.argv.slice(2));
for (const file of files) {
  writeFileSync(new URL(`../../${file.path}`, import.meta.url), file.content);
  console.log(`wrote ${file.path}`);
}
console.log(`\n${summary}`);
