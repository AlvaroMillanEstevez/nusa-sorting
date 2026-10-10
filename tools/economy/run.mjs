// Runs the economy balance check (TypeScript) through Vite. Usage: npm run economy
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./simulate.ts', import.meta.url).pathname);
console.log(module.main());
