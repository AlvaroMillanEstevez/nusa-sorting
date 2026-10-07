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

describe('safe area and language parameters', () => {
  it('reads four insets in CSS px, and nothing else', async () => {
    const { parseSafeArea } = await import('../src/dev/uiParams');
    expect(parseSafeArea('?safeArea=47,0,34,0')).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
    for (const bad of ['?safeArea=47,0,34', '?safeArea=a,b,c,d', '?safeArea=-1,0,0,0', '']) expect(parseSafeArea(bad)).toBeNull();
  });

  it('forces English or Indonesian only', async () => {
    const { parseLang } = await import('../src/dev/uiParams');
    expect(parseLang('?lang=id')).toBe('id');
    expect(parseLang('?lang=en')).toBe('en');
    expect(parseLang('?lang=fr')).toBeNull();
  });
});
