/** One step of mulberry32: returns a value in [0, 1) and the next generator state. Pure and deterministic. */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(next ^ (next >>> 15), 1 | next);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: next };
}
