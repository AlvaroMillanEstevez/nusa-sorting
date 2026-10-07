/** Formats remaining time as m:ss, rounding up so the clock shows 0:00 only when time is really out. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** A score with the thousands separator of the language: 12,450 in English, 12.450 in Indonesian. */
export function formatScore(score: number, locale: 'en' | 'id'): string {
  return score.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US');
}
