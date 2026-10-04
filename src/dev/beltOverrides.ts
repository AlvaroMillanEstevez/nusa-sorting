import type { LevelDefinition, MechanicDefinition } from '../core';

/**
 * Development only: lets Koke tune the conveyor while playing, via the query string.
 * - `beltSpeed=1.5` replaces the belt speed (slots per second; negative moves left). With several tracks it
 *   sets how fast all of them run, each keeping its direction.
 * - `beltSlots=10` changes K of the single classic belt, keeping the same items spread evenly with empty
 *   slots in between.
 *   Values smaller than the number of belt items are ignored.
 * Returns the level unchanged when it has no belt or the parameters are absent or malformed.
 */
export function applyBeltOverrides(level: LevelDefinition, search: string): LevelDefinition {
  const params = new URLSearchParams(search);
  const speedParam = Number(params.get('beltSpeed') ?? Number.NaN);
  const newSpeed = Number.isFinite(speedParam) && speedParam !== 0 ? speedParam : null;

  // Several tracks: ?beltSpeed sets how fast every track runs, each keeping its own direction.
  const tracks = level.mechanics?.find((m) => m.kind === 'tracks');
  if (tracks) {
    if (newSpeed === null) return level;
    const tuned: MechanicDefinition = {
      ...tracks,
      tracks: tracks.tracks.map((track) => ({ ...track, speed: Math.sign(track.speed) * Math.abs(newSpeed) })),
    };
    return { ...level, mechanics: level.mechanics!.map((m) => (m === tracks ? tuned : m)) };
  }

  const belt = level.mechanics?.find((m) => m.kind === 'conveyor');
  if (!belt) return level;

  let { speed, slots } = belt;
  if (newSpeed !== null) speed = newSpeed;

  const slotsParam = Number(params.get('beltSlots') ?? Number.NaN);
  const items = slots.filter((slot) => slot !== null);
  if (Number.isInteger(slotsParam) && slotsParam >= items.length && slotsParam !== slots.length) {
    slots = spreadEvenly(items, slotsParam);
  }
  if (speed === belt.speed && slots === belt.slots) return level;

  const mechanics = level.mechanics!.map((m): MechanicDefinition => (m === belt ? { ...belt, speed, slots } : m));
  return { ...level, mechanics };
}

/** Places `items` in `size` slots, as evenly spaced as possible, in their original order. */
export function spreadEvenly<T>(items: readonly T[], size: number): (T | null)[] {
  const slots: (T | null)[] = Array<T | null>(size).fill(null);
  items.forEach((item, i) => {
    slots[Math.floor((i * size) / items.length)] = item;
  });
  return slots;
}
