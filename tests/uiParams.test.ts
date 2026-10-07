import { describe, expect, it } from 'vitest';
import { parseSlotAspect, wantsUikit } from '../src/dev/uiParams';

describe('interface development parameters', () => {
  it('opens the kit with ?uikit', () => {
    expect(wantsUikit('?uikit')).toBe(true);
    expect(wantsUikit('?level=3')).toBe(false);
  });

  it('reads a slot aspect from 1 to 1.6, and nothing else', () => {
    expect(parseSlotAspect('?slotAspect=1.2')).toBe(1.2);
    expect(parseSlotAspect('?slotAspect=1')).toBe(1);
    for (const bad of ['?slotAspect=0.8', '?slotAspect=2', '?slotAspect=', '?slotAspect=tall', '']) expect(parseSlotAspect(bad)).toBeNull();
  });
});
