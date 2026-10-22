import { describe, expect, it } from 'vitest';
import { BOOSTER_IDS } from '../src/data/economy';
import { renderBookSvg, renderBoosterSvg } from '../src/ui/icons/icons';

describe('booster icons', () => {
  it.each(BOOSTER_IDS)('%s renders a complete colour SVG', (id) => {
    const svg = renderBoosterSvg(id);
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).not.toMatch(/NaN|undefined|#888888/);
    // Shaded like the item icons: gradients and outlines in the material's own dark tone.
    expect(svg).toMatch(/linearGradient|radialGradient/);
  });

  it('draws each booster differently', () => {
    expect(new Set(BOOSTER_IDS.map(renderBoosterSvg)).size).toBe(BOOSTER_IDS.length);
  });

  it("draws Buku Nenek's book the same way: a complete, shaded colour SVG", () => {
    const svg = renderBookSvg();
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined|#888888/);
    expect(svg).toMatch(/linearGradient/);
  });
});
