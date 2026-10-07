/**
 * Development only: `?slotAspect=1.2` makes slots that much taller than wide in any level (1 to 1.6), with items
 * resting on the base. Anything else: null (square slots).
 */
export function parseSlotAspect(search: string): number | null {
  const raw = new URLSearchParams(search).get('slotAspect');
  const value = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 1 && value <= 1.6 ? value : null;
}

/** Development only: `?art=v3` draws the kinds that have a v3 icon (sate, es teh manis, rambutan) in that style. */
export function wantsArtV3(search: string): boolean {
  return new URLSearchParams(search).get('art') === 'v3';
}
