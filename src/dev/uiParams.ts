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

/**
 * Development only: `?safeArea=47,0,34,0` pretends the screen has these safe-area insets (top, right, bottom,
 * left, in CSS px), to see how the game keeps clear of a notch without a phone. Anything else: null.
 */
export function parseSafeArea(search: string): { top: number; right: number; bottom: number; left: number } | null {
  const raw = new URLSearchParams(search).get('safeArea');
  if (!raw) return null;
  const parts = raw.split(',').map((v) => Number(v.trim()));
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v) || v < 0 || v > 200)) return null;
  const [top, right, bottom, left] = parts as [number, number, number, number];
  return { top, right, bottom, left };
}

/** Development only: `?lang=id` (or `en`) shows the game in that language whatever the browser's. */
export function parseLang(search: string): 'en' | 'id' | null {
  const lang = new URLSearchParams(search).get('lang');
  return lang === 'en' || lang === 'id' ? lang : null;
}

/** Panels `?show=` can open over a level, to review them without playing it. */
export type ShowParam = 'pause' | 'confirm' | 'won' | 'lost';

/** Development only: `?show=pause|confirm|won|lost` opens that panel when the level starts. */
export function parseShowParam(search: string): ShowParam | null {
  const value = new URLSearchParams(search).get('show');
  return value === 'pause' || value === 'confirm' || value === 'won' || value === 'lost' ? value : null;
}

/** Development only: `?home` opens the home screen whatever the save says. */
export function wantsHome(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('home') || params.has('arrival');
}

/**
 * Development only: `?arrival=N` opens the home screen as if level N had just been won with three stars (from
 * none), to review the arrival sequence. Returns N's index (N - 1), or null.
 */
export function parseArrivalParam(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get('arrival');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= count ? n - 1 : null;
}

/**
 * Development only: `?progress=N` marks the first N levels completed (with 3, 2 and 1 stars in turn) before the
 * game starts, to see the map further on. Returns N, or null.
 */
export function parseProgressParam(search: string, count: number): number | null {
  const raw = new URLSearchParams(search).get('progress');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Math.min(count, Number(raw));
}
