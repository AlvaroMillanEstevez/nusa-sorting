import { describe, expect, it } from 'vitest';

// The project has no Node type definitions (it targets the browser); this test only needs these two calls.
const fsModule = 'node:fs';
const { readFileSync, statSync } = (await import(/* @vite-ignore */ fsModule)) as {
  readFileSync(path: string, encoding?: string): { subarray(a: number, b: number): { toString(enc: string): string } } & string;
  statSync(path: string): { size: number };
};

const DIR = 'src/assets/fonts';
const FONTS = ['nusa-display-600.woff2', 'nusa-text-500.woff2', 'nusa-text-700.woff2'];

describe('bundled interface fonts', () => {
  it('ships every cut as WOFF2 within a 40 KB budget in all', () => {
    let total = 0;
    for (const file of FONTS) {
      const bytes = readFileSync(`${DIR}/${file}`);
      expect(bytes.subarray(0, 4).toString('latin1'), file).toBe('wOF2');
      total += statSync(`${DIR}/${file}`).size;
    }
    expect(total).toBeLessThanOrEqual(40 * 1024);
  });

  it('ships the Open Font License of each family next to the fonts', () => {
    for (const license of ['OFL-Fredoka.txt', 'OFL-PlusJakartaSans.txt']) {
      expect(readFileSync(`${DIR}/${license}`, 'utf8')).toContain('SIL Open Font License, Version 1.1');
    }
  });
});
