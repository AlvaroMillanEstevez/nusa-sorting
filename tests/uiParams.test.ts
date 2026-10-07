import { describe, expect, it } from 'vitest';
import { parseSlotAspect, wantsArtV3 } from '../src/dev/uiParams';

describe('interface development parameters', () => {
  it('reads a slot aspect from 1 to 1.6, and nothing else', () => {
    expect(parseSlotAspect('?slotAspect=1.2')).toBe(1.2);
    expect(parseSlotAspect('?slotAspect=1')).toBe(1);
    for (const bad of ['?slotAspect=0.8', '?slotAspect=2', '?slotAspect=', '?slotAspect=tall', '']) expect(parseSlotAspect(bad)).toBeNull();
  });

  it('switches the icon style with ?art=v3 only', () => {
    expect(wantsArtV3('?art=v3')).toBe(true);
    expect(wantsArtV3('?art=v2')).toBe(false);
    expect(wantsArtV3('?level=1')).toBe(false);
  });
});
