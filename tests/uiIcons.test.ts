import { describe, expect, it } from 'vitest';
import { UI_ICON_NAMES, uiIconSvg } from '../src/ui/design/uiIcons';

describe('interface icons', () => {
  it.each(UI_ICON_NAMES)('%s is one well-formed SVG on the 24-unit grid, in the colour asked for', (name) => {
    const svg = uiIconSvg(name, '#123456');
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 24 24"/);
    expect(svg).toContain('#123456');
    // Only the requested colour: the icon recolours fully with the skin and the state.
    expect(svg.match(/#[0-9a-f]{6}/gi)!.every((c) => c === '#123456')).toBe(true);
    // No attribute twice in one tag (browsers then refuse the whole image).
    for (const tag of svg.match(/<[a-z]+ [^>]*>/gi) ?? []) {
      const names = [...tag.matchAll(/\s([a-z-]+)="/g)].map((m) => m[1]);
      expect(new Set(names).size, tag).toBe(names.length);
    }
  });
});
