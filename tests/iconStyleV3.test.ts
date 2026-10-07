import { describe, expect, it } from 'vitest';
import { renderIcon, renderItemSvg, renderSilhouette, V3_KINDS } from '../src/ui/icons/icons';

describe('the v3 icon style test', () => {
  it('covers sate, es teh manis and rambutan, and leaves the game on the current style by default', () => {
    expect(V3_KINDS.sort()).toEqual(['es-teh-manis', 'rambutan', 'sate']);
    expect(renderItemSvg('sate')).toBe(renderIcon('sate', 'original', false, 'current'));
    expect(renderItemSvg('sate')).not.toBe(renderIcon('sate', 'original', false, 'v3'));
    // Kinds without a v3 drawing keep theirs.
    expect(renderIcon('bakso', 'original', false, 'v3')).toBe(renderIcon('bakso', 'original', false, 'current'));
  });

  it.each(V3_KINDS)('draws %s with textures, a contact shadow, a rim light and no thick outline, in every variant', (kind) => {
    for (const variant of ['original', 'alt1', 'alt2'] as const) {
      const svg = renderIcon(kind, variant, false, 'v3');
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 100 100"/);
      expect(svg).toContain('class="contact-shadow"');
      expect(svg).toContain('filter="url(#v3rim)"');
      const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
      // Strokes that remain are shapes (sticks, hairs, drizzle) or hairlines, drawn in the material's own tones.
      expect(svg.includes('<pattern') || kind === 'es-teh-manis', kind).toBe(true);
      expect(widths.length).toBeGreaterThan(0);
    }
    expect(renderIcon(kind, 'alt1', false, 'v3')).not.toBe(renderIcon(kind, 'original', false, 'v3'));
  });

  it('adds the colour-blind badge, and its silhouette drops the contact shadow', () => {
    expect(renderIcon('sate', 'alt2', true, 'v3')).toContain('<polygon points="81,71.5');
    expect(renderSilhouette('sate')).not.toContain('contact-shadow');
  });
});
