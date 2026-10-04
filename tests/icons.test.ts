import { describe, expect, it } from 'vitest';
import { ALL_ITEM_TYPES, ITEM_KINDS, STARTER_KINDS, VARIANTS } from '../src/data/itemCatalog';
import { WOOD } from '../src/ui/art/wood';
import {
  colorDistance,
  contrastRatio,
  hexToRgb,
  lightness,
  rotateHue,
  simulateSvg,
  simulateVision,
} from '../src/ui/icons/color';
import {
  DRAWN_KINDS,
  ICON_TEMPLATES,
  placeholderLook,
  renderIcon,
  renderItemSvg,
  renderPlaceholder,
  tintedMaterials,
  tones,
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

  it('turns colours into greys of the same luminance', () => {
    const [r, g, b] = hexToRgb(simulateVision('#d83a32', 'grayscale'));
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(Math.abs(lightness(simulateVision('#d83a32', 'grayscale')) - lightness('#d83a32'))).toBeLessThan(1);
    expect(simulateVision('#ffffff', 'grayscale')).toBe('#ffffff');
  });

  it('measures lightness and contrast', () => {
    expect(lightness('#000000')).toBe(0);
    expect(lightness('#ffffff')).toBeCloseTo(100);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
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
  it('draws the ten starter kinds', () => {
    expect([...DRAWN_KINDS].sort()).toEqual([...STARTER_KINDS].sort());
  });

  it.each(DRAWN_KINDS)('renders %s as valid SVG without text, in every variant', (kind) => {
    for (const variant of VARIANTS) {
      const svg = renderIcon(kind, variant);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"')).toBe(true);
      expect(balanced(svg)).toBe(true);
      expect(svg).not.toMatch(/<text|<image|filter/);
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('NaN');
      // Colours only as #rrggbb, so the vision simulations reach all of them.
      expect(svg).not.toMatch(/#[0-9a-fA-F]{3}\b|rgb\(/);
    }
  });

  it('outlines every material in a dark tone of its own colour, not black', () => {
    for (const template of Object.values(ICON_TEMPLATES))
      for (const color of Object.values(template.palette)) {
        const { line } = tones(color);
        expect(lightness(line)).toBeLessThan(lightness(color));
        expect(line).not.toBe('#000000');
      }
  });

  it('changes only some materials between variants, by hand-picked colours', () => {
    for (const [kind, template] of Object.entries(ICON_TEMPLATES)) {
      const tinted = tintedMaterials(template);
      expect(tinted.length, kind).toBeGreaterThan(0);
      for (const material of tinted) expect(Object.keys(template.palette), `${kind}.${material}`).toContain(material);
      const alt1 = variantPalette(template, 'alt1');
      for (const material of Object.keys(template.palette))
        if (!tinted.includes(material)) expect(alt1[material]).toBe(template.palette[material]);
    }
  });

  it('tells variants apart by lightness (so in grey too), with alt1 bluer and alt2 yellower', () => {
    // b* of CIELAB, roughly: positive is yellow, negative is blue.
    const yellowness = (hex: string) => {
      const [r, g, b] = hexToRgb(hex);
      return (r + g) / 2 - b;
    };
    for (const [kind, template] of Object.entries(ICON_TEMPLATES))
      for (const material of tintedMaterials(template)) {
        const [original, alt1, alt2] = VARIANTS.map((v) => variantPalette(template, v)[material]!);
        const name = `${kind}.${material}`;
        expect(Math.abs(lightness(original!) - lightness(alt1!)), name).toBeGreaterThanOrEqual(15);
        expect(Math.abs(lightness(original!) - lightness(alt2!)), name).toBeGreaterThanOrEqual(15);
        expect(Math.abs(lightness(alt1!) - lightness(alt2!)), name).toBeGreaterThanOrEqual(15);
        expect(yellowness(alt1!), name).toBeLessThan(0);
        expect(yellowness(alt2!), name).toBeGreaterThan(0);
      }
  });

  it('keeps the main colour of every variant clearly lighter than the shelf wall behind it', () => {
    for (const [kind, template] of Object.entries(ICON_TEMPLATES))
      for (const variant of VARIANTS)
        for (const material of tintedMaterials(template)) {
          const color = variantPalette(template, variant)[material]!;
          expect(contrastRatio(color, WOOD.wall), `${kind}.${material} ${variant}`).toBeGreaterThanOrEqual(1.6);
        }
  });

  it('marks variants with a colour-free badge: none, a dot, a triangle', () => {
    const badge = (svg: string) => svg.slice(svg.lastIndexOf('<circle cx="81" cy="81" r="15.5"'));
    expect(renderIcon('sate', 'original')).not.toContain('r="15.5"');
    expect(badge(renderIcon('sate', 'alt1'))).toContain('<circle cx="81" cy="81" r="6.5"');
    expect(badge(renderIcon('sate', 'alt2'))).toContain('<polygon');
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
      const svg = renderItemSvg(type);
      expect(balanced(svg), type).toBe(true);
      expect(svg).not.toContain('undefined');
    }
    expect(renderPlaceholder('tempe', 'original')).toContain('>T</text>');
    expect(() => renderItemSvg('apple')).toThrow();
  });
});
