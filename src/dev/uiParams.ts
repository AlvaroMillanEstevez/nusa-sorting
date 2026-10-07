/** Development only: `?uikit` opens the interface kit and its two visual directions instead of the game. */
export function wantsUikit(search: string): boolean {
  return new URLSearchParams(search).has('uikit');
}

/**
 * Development only: `?slotAspect=1.2` makes slots that much taller than wide in any level (1 to 1.6), with items
 * resting on the base. Anything else: null (square slots).
 */
export function parseSlotAspect(search: string): number | null {
  const raw = new URLSearchParams(search).get('slotAspect');
  const value = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 1 && value <= 1.6 ? value : null;
}
