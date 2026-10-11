/**
 * Development only: reads `?level=N` from a query string and returns the index of the level numbered N in
 * `numbers` (the play list's level numbers), or null if absent, malformed or not in the list. Only referenced
 * behind `import.meta.env.DEV`, so production builds drop it.
 */
export function parseLevelParam(search: string, numbers: readonly number[]): number | null {
  // ?demo=N opens demo level N, which the game numbers 100 + N (see addDemoLevels).
  const demo = new URLSearchParams(search).get('demo');
  if (demo !== null && /^\d+$/.test(demo)) {
    const index = numbers.indexOf(100 + Number(demo));
    if (index !== -1) return index;
  }
  const raw = new URLSearchParams(search).get('level');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const index = numbers.indexOf(Number(raw));
  return index === -1 ? null : index;
}

/**
 * Development only: reads `?arrangement=K` and returns K if the level has an arrangement K (0 is the level as
 * written), or null. Every attempt then plays that arrangement.
 */
export function parseArrangementParam(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get('arrangement');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const index = Number(raw);
  return index < count ? index : null;
}
