import type { LevelDefinition, MechanicDefinition } from '../core';

/**
 * Development only: lets Koke tune the conveyor while playing, via the query string.
 * - `beltSpeed=1.5` replaces the belt speed (slots per second; negative moves left).
 * - `beltSlots=10` changes K, keeping the same items spread evenly with empty slots in between.
 *   Values smaller than the number of belt items are ignored.
 * Returns the level unchanged when it has no belt or the parameters are absent or malformed.
 */
export function applyBeltOverrides(level: LevelDefinition, search: string): LevelDefinition {
  const params = new URLSearchParams(search);
  const belt = level.mechanics?.find((m) => m.kind === 'conveyor');
  if (!belt) return level;

  let { speed, slots } = belt;
  const speedParam = Number(params.get('beltSpeed') ?? Number.NaN);
  if (Number.isFinite(speedParam) && speedParam !== 0) speed = speedParam;

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
