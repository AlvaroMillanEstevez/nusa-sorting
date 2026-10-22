import { BOOK_TEMPLATE } from './bookIcon';
import type { BoosterId } from '../../data/economy';
import { darken, lighten } from './color';
import { BOOSTER_TEMPLATES } from './boosterIcons';
import { OUTLINE, r1, type Paint, type Palette } from './template';

/**
 * Booster icons as SVG templates (viewBox 0 0 100 100). Each template paints named MATERIALS (e.g. 'brass',
 * 'ice'); a palette gives each material a base colour and the template derives three shading tones, a fine
 * outline in a dark tone of the material itself and a specular highlight from it. (Items are illustrated
 * pictures, see src/assets/art; their drawn icons were retired in October 2026 and stay in git.)
 */

export type { IconTemplate, Paint, Palette } from './template';

/** Shading tones derived from a material's base colour. */
export const tones = (base: string) => ({
  light: lighten(base, 0.38),
  base,
  shade: darken(base, 0.28),
  line: darken(base, 0.58),
});

function paintFor(palette: Palette, defs: string[]): Paint {
  const color = (m: string) => palette[m] ?? '#888888';
  const made = new Set<string>();
  const gradient = (kind: 'l' | 'r', m: string) => {
    const id = `${kind}-${m}`;
    if (!made.has(id)) {
      made.add(id);
      const t = tones(color(m));
      const stops =
        `<stop offset="0" stop-color="${t.light}"/><stop offset="0.5" stop-color="${t.base}"/>` +
        `<stop offset="1" stop-color="${t.shade}"/>`;
      defs.push(
        kind === 'l'
          ? `<linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1">${stops}</linearGradient>`
          : `<radialGradient id="${id}" cx="0.36" cy="0.32" r="0.75">${stops}</radialGradient>`,
      );
    }
    return `url(#${id})`;
  };
  return {
    fill: (m) => gradient('l', m),
    ball: (m) => gradient('r', m),
    flat: color,
    light: (m) => tones(color(m)).light,
    shade: (m) => tones(color(m)).shade,
    line: (m) => tones(color(m)).line,
    edge: (m, width = OUTLINE) => ` stroke="${tones(color(m)).line}" stroke-width="${width}" stroke-linejoin="round"`,
    spec: (cx, cy, rx, ry, rotate = 0) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${r1(rx * 1.6)}" ry="${r1(ry * 1.6)}" transform="rotate(${rotate} ${cx} ${cy})" fill="#ffffff" opacity="0.25"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rotate} ${cx} ${cy})" fill="#ffffff" opacity="0.85"/>`,
  };
}

function svgDocument(defs: string[], body: string): string {
  const shadow =
    '<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.35"/>' +
    '<stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<defs>${shadow}${defs.join('')}</defs>` +
    // Soft shadow underneath.
    `<ellipse cx="50" cy="91" rx="34" ry="6" fill="url(#shadow)"/>` +
    `${body}</svg>`
  );
}

/** SVG for Buku Nenek's book on the map (see bookIcon.ts). */
export function renderBookSvg(): string {
  const defs: string[] = [];
  const body = BOOK_TEMPLATE.draw(paintFor(BOOK_TEMPLATE.palette, defs)).replace(/\s*\n\s*/g, '');
  return svgDocument(defs, body);
}

/** SVG for a booster's icon (see boosterIcons.ts). */
export function renderBoosterSvg(booster: BoosterId): string {
  const template = BOOSTER_TEMPLATES[booster];
  const defs: string[] = [];
  const body = template.draw(paintFor(template.palette, defs)).replace(/\s*\n\s*/g, '');
  return svgDocument(defs, body);
}
