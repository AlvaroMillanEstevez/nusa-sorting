/**
 * Development only: reads `?level=N` from a query string and returns the index of the level numbered N in
 * `numbers` (the play list's level numbers), or null if absent, malformed or not in the list. Only referenced
 * behind `import.meta.env.DEV`, so production builds drop it.
 */
export function parseLevelParam(search: string, numbers: readonly number[]): number | null {
  const raw = new URLSearchParams(search).get('level');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const index = numbers.indexOf(Number(raw));
  return index === -1 ? null : index;
}
