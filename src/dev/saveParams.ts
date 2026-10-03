/** Development only: `?resetSave` wipes saved progress and settings before the game starts. */
export function wantsSaveReset(search: string): boolean {
  return new URLSearchParams(search).has('resetSave');
}
