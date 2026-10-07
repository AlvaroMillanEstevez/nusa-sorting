import { describe, expect, it } from 'vitest';
import { WOOD } from '../src/ui/art/wood';
import {
  GRID,
  LARGE_TEXT,
  MIN_BODY_TEXT,
  MIN_TEXT,
  MIN_TOUCH,
  SKIN,
  SPACE,
  TYPE,
  mapSkin,
  type Skin,
} from '../src/ui/design/tokens';
import { contrastRatio, mix, simulateVision, type Vision } from '../src/ui/icons/color';

/** What can show through a see-through surface: the backdrop, the shelves' dark wall and their lightest wood. */
const behind = (skin: Skin) => [...skin.backdrop, WOOD.wall, WOOD.plankLight, WOOD.bamboo];
/** A colour drawn at `alpha` over `under`. */
const over = (color: string, alpha: number, under: string) => mix(under, color, alpha);

/** WCAG AA: 4.5 for normal text, 3 for large text. */
const AA = 4.5;
const AA_LARGE = 3;

describe.each([[SKIN.id, SKIN] as const])('skin %s', (_id, skin) => {
  it('keeps text on panels readable whatever shows through them', () => {
    for (const under of behind(skin)) {
      const surface = over(skin.surface.fill, skin.surface.alpha, under);
      for (const [role, color] of Object.entries(skin.text)) {
        expect(contrastRatio(color, surface), `${role} on a panel over ${under}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('keeps HUD text on its chips readable over the board', () => {
    for (const under of behind(skin)) {
      const chip = over(skin.chip.fill, skin.chip.alpha, under);
      for (const color of [skin.text.primary, skin.text.secondary, ...Object.values(skin.status)]) {
        expect(contrastRatio(color, chip), `${color} on a chip over ${under}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('keeps button labels readable on their faces', () => {
    for (const [role, fill] of Object.entries(skin.fills)) {
      expect(contrastRatio(fill.text, fill.face), role).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps every face apart from its lip and from the panel by lightness, not colour alone', () => {
    const panel = over(skin.surface.fill, skin.surface.alpha, skin.backdrop[1]);
    for (const [role, fill] of Object.entries(skin.fills)) {
      if (skin.lip > 0) expect(contrastRatio(fill.face, fill.lip), `${role} lip`).toBeGreaterThanOrEqual(1.8);
      // The secondary button may be quiet, but must still read as a button: its border/lip carries the rest.
      if (role !== 'secondary') expect(contrastRatio(fill.face, panel), `${role} on a panel`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(['deuteranopia', 'protanopia', 'grayscale'] as Vision[])('stays readable with %s', (vision) => {
    const seen = mapSkin(skin, (hex) => simulateVision(hex, vision));
    for (const [role, fill] of Object.entries(seen.fills)) {
      expect(contrastRatio(fill.text, fill.face), role).toBeGreaterThanOrEqual(AA_LARGE);
    }
    const panel = over(seen.surface.fill, seen.surface.alpha, seen.backdrop[1]);
    for (const color of Object.values(seen.text)) expect(contrastRatio(color, panel)).toBeGreaterThanOrEqual(AA);
  });
});

describe('type, spacing and touch', () => {
  it('never goes below the minimum text sizes; body text is at least 14 px', () => {
    for (const [role, style] of Object.entries(TYPE)) {
      expect(style.size, role).toBeGreaterThanOrEqual(MIN_TEXT);
      if (style.font === 'text' && role !== 'caption' && role !== 'label') expect(style.size, role).toBeGreaterThanOrEqual(MIN_BODY_TEXT);
    }
    // Button labels count as large text, so 3:1 would do; the skins still give them 4.5:1.
    expect(TYPE.button.size).toBeGreaterThanOrEqual(LARGE_TEXT);
  });

  it('spaces everything on the 8 px grid (half steps allowed)', () => {
    for (const value of Object.values(SPACE)) expect((value * 2) % GRID).toBe(0);
  });

  it('asks for touch targets of at least 44 px', () => {
    expect(MIN_TOUCH).toBeGreaterThanOrEqual(44);
  });
});

describe('stars', () => {
  it('stand out from the panel, earned or not (graphics need 3:1)', () => {
    const panel = SKIN.surface.fill;
    expect(contrastRatio(SKIN.star.filled, panel)).toBeGreaterThanOrEqual(3);
    // An empty star is told by its light rim (and its hollow shape), not by its fill.
    expect(contrastRatio(SKIN.star.rim, panel)).toBeGreaterThanOrEqual(3);
  });
});
