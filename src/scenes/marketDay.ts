import { pasaranOn } from '../core';
import type { Pasaran } from '../data/pasaran';
import { parsePasaranParam } from '../dev/uiParams';

/** Today's market day on the device's calendar (in development, `?pasaran=` can set another). */
export function todaysPasaran(): Pasaran {
  const forced = import.meta.env.DEV ? parsePasaranParam(window.location.search) : null;
  return forced ?? pasaranOn(new Date());
}
