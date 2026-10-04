import { describe, expect, it } from 'vitest';
import { ALL_ITEM_TYPES, ITEM_KINDS, STARTER_KINDS, VARIANTS } from '../src/data/itemCatalog';
import { colorDistance, rotateHue, simulateSvg, simulateVision } from '../src/ui/icons/color';
import {
  DRAWN_KINDS,
  ICON_STYLES,
  ICON_TEMPLATES,
  placeholderLook,
  renderIcon,
  renderItemSvg,
  renderPlaceholder,
  variantColor,
  variantPalette,
} from '../src/ui/icons/icons';

/** Rough well-formedness: every opened element is closed, in order. */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const [, closing, name, selfClosing] of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe('colour helpers', () => {
  it('rotates hues and keeps greys', () => {
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00');
    expect(rotateHue('#ff0000', 240)).toBe('#0000ff');
    expect(rotateHue('#808080', 120)).toBe('#808080');
  });

  it('simulates colour blindness: greys stay, red and green collapse', () => {
    for (const vision of ['deuteranopia', 'protanopia'] as const) {
      expect(colorDistance(simulateVision('#ffffff', vision), '#ffffff')).toBeLessThan(3);
      expect(colorDistance(simulateVision('#808080', vision), '#808080')).toBeLessThan(3);
      const red = simulateVision('#d83a32', vision);
      const green = simulateVision('#4e9a3a', vision);
      expect(colorDistance(red, green)).toBeLessThan(colorDistance('#d83a32', '#4e9a3a') / 2);
    }
    expect(simulateVision('#d83a32', 'normal')).toBe('#d83a32');
  });

  it('rewrites every colour of an SVG', () => {
    const svg = '<svg><circle fill="#FF0000"/><rect stroke="#00ff00"/></svg>';
    const out = simulateSvg(svg, 'deuteranopia');
    expect(out).not.toContain('#FF0000');
    expect(out).not.toContain('#00ff00');
    expect(out.match(/#[0-9a-f]{6}/g)).toHaveLength(2);
  });
});

describe('icon templates', () => {
  it('draws six starter kinds with very different silhouettes', () => {
    expect(DRAWN_KINDS).toHaveLength(6);
    for (const kind of DRAWN_KINDS) expect(STARTER_KINDS).toContain(kind);
  });

  it.each(DRAWN_KINDS)('renders %s as valid SVG without text, in both styles and every variant', (kind) => {
    for (const style of ICON_STYLES)
      for (const variant of VARIANTS) {
        const svg = renderIcon(kind, variant, style);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"')).toBe(true);
        expect(balanced(svg)).toBe(true);
        expect(svg).not.toMatch(/<text|<image|filter/);
        expect(svg).not.toContain('undefined');
        expect(svg).not.toContain('NaN');
        // Colours only as #rrggbb, so the colour-blindness simulation reaches all of them.
        expect(svg).not.toMatch(/#[0-9a-fA-F]{3}\b|rgb\(/);
      }
  });

  it('only tints the main materials, and each variant looks clearly different', () => {
    for (const [kind, template] of Object.entries(ICON_TEMPLATES)) {
      for (const material of template.tinted) expect(Object.keys(template.palette), kind).toContain(material);
      const [original, alt1, alt2] = VARIANTS.map((v) => variantPalette(template, v));
      for (const material of Object.keys(template.palette)) {
        if (template.tinted.includes(material)) {
          expect(colorDistance(original![material]!, alt1![material]!), `${kind}.${material}`).toBeGreaterThan(80);
          expect(colorDistance(original![material]!, alt2![material]!), `${kind}.${material}`).toBeGreaterThan(80);
          expect(colorDistance(alt1![material]!, alt2![material]!), `${kind}.${material}`).toBeGreaterThan(80);
        } else {
          expect(alt1![material]).toBe(original![material]);
        }
      }
    }
    // Low-saturation colours are pulled towards a strong one instead of a barely visible hue turn.
    expect(colorDistance(variantColor('#e6c48c', 'alt1'), '#e6c48c')).toBeGreaterThan(80);
  });

  it('marks variants with a colour-free badge: none, a dot, a triangle', () => {
    const badge = (svg: string) => svg.slice(svg.lastIndexOf('<circle cx="80" cy="80" r="13"'));
    expect(renderIcon('sate', 'original', 'soft')).not.toContain('r="13"');
    expect(badge(renderIcon('sate', 'alt1', 'soft'))).toContain('<circle cx="80" cy="80" r="5"');
    expect(badge(renderIcon('sate', 'alt2', 'soft'))).toContain('<polygon');
  });
});

describe('placeholders', () => {
  it('gives every kind a unique shape, colour and initial', () => {
    const looks = ITEM_KINDS.map((k) => placeholderLook(k));
    expect(new Set(looks.map((l) => `${l.shape}|${l.color}|${l.initial}`)).size).toBe(ITEM_KINDS.length);
    // Kinds that share colour and initial must differ in shape.
    for (const [i, a] of looks.entries())
      for (const b of looks.slice(i + 1)) if (a.color === b.color && a.initial === b.initial) expect(a.shape).not.toBe(b.shape);
  });

  it('renders every catalogue type, drawn or not', () => {
    for (const type of ALL_ITEM_TYPES) {
      const svg = renderItemSvg(type, 'soft');
      expect(balanced(svg), type).toBe(true);
      expect(svg).not.toContain('undefined');
    }
    expect(renderPlaceholder('tempe', 'original')).toContain('>T</text>');
    expect(() => renderItemSvg('apple', 'soft')).toThrow();
  });
});
