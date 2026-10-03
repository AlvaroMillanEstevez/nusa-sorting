/**
 * Development only: reads `?level=N` (1-based) from a query string and returns the level index,
 * or null if absent or out of range. Only referenced behind `import.meta.env.DEV`, so production
 * builds drop it.
 */
export function parseLevelParam(search: string, levelCount: number): number | null {
  const raw = new URLSearchParams(search).get('level');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const index = Number(raw) - 1;
  return index >= 0 && index < levelCount ? index : null;
}
