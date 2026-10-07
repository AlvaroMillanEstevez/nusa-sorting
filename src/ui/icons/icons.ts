import { parseItemType, type Variant } from '../../data/itemCatalog';
import { darken, lighten } from './color';
import { CULTURAL_TEMPLATES } from './culturalIcons';
import { MORE_TEMPLATES } from './moreIcons';
import { STARTER_TEMPLATES } from './starterIcons';
import { OUTLINE, r1, type IconTemplate, type Paint, type Palette } from './template';

/**
 * Item icons as SVG templates (viewBox 0 0 100 100). Each template paints named MATERIALS (e.g. 'meat',
 * 'stick'); a palette gives each material a base colour and the template derives three shading tones, a fine
 * outline in a dark tone of the material itself and a specular highlight from it.
 *
 * Colour variants are hand-picked alternative colours for a few materials, chosen to differ above all in
 * lightness and along the blue-yellow axis (what colour-blind players still see), plus a corner badge that
 * does not rely on colour at all.
 */

export type { IconTemplate, Paint, Palette } from './template';

/** Every kind's icon. */
export const ICON_TEMPLATES: Readonly<Record<string, IconTemplate>> = { ...STARTER_TEMPLATES, ...MORE_TEMPLATES, ...CULTURAL_TEMPLATES };


// ---------------------------------------------------------------- variants

export function variantPalette(template: IconTemplate, variant: Variant): Palette {
  return variant === 'original' ? template.palette : { ...template.palette, ...template.variants[variant] };
}

/** Materials whose colour changes between variants. */
export function tintedMaterials(template: IconTemplate): string[] {
  return [...new Set([...Object.keys(template.variants.alt1), ...Object.keys(template.variants.alt2)])];
}

/**
 * Colour-free badge in the bottom-right corner, shown only in colour-blind mode (`marks`): none for the
 * original, a dot for alt1, a triangle for alt2. Dark with a white ring and a white mark, so it stands out on
 * light and on dark icons alike. Without it, variants are told apart by colour and lightness alone.
 */
function variantBadge(variant: Variant, marks: boolean): string {
  if (!marks || variant === 'original') return '';
  const mark =
    variant === 'alt1'
      ? '<circle cx="81" cy="81" r="6.5" fill="#ffffff"/>'
      : '<polygon points="81,71.5 89.5,86.5 72.5,86.5" fill="#ffffff"/>';
  return `<circle cx="81" cy="81" r="15.5" fill="#1d2630" stroke="#ffffff" stroke-width="3"/>${mark}`;
}

// ---------------------------------------------------------------- rendering

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

/** SVG for a drawn kind in a variant; `marks` adds the colour-blind variant badge. */
export function renderIcon(kindId: string, variant: Variant, marks = false): string {
  const template = ICON_TEMPLATES[kindId];
  if (!template) throw new Error(`no icon for ${kindId}`);
  const defs: string[] = [];
  const paint = paintFor(variantPalette(template, variant), defs);
  const body = template.draw(paint).replace(/\s*\n\s*/g, '');
  // Drawn a little larger than the 100-unit grid so icons fill their slot; the badge stays in its corner.
  return svgDocument(defs, `<g transform="translate(50 52) scale(1.07) translate(-50 -52)">${body}</g>` + variantBadge(variant, marks));
}

/** SVG for any item type id (`marks`: see renderIcon). */
export function renderItemSvg(type: string, marks = false): string {
  const parsed = parseItemType(type);
  if (!parsed) throw new Error(`unknown item type ${type}`);
  return renderIcon(parsed.kind.id, parsed.variant, marks);
}

/** Flat colour of a silhouette, and of the thin rim that lifts it off the dark wood. */
export const SILHOUETTE_FILL = '#1e130b';
export const SILHOUETTE_RIM = '#8c6a48';

/**
 * What an item looks like from behind another one: its exact shape in one flat dark tone, without colour or
 * inner detail, with a thin lighter rim so it stands out on the shelf's dark wood. The shape is shown on
 * purpose, so players can plan; the item's soft shadow is left out.
 */
export function renderSilhouette(type: string): string {
  const svg = renderItemSvg(type).replace('<ellipse cx="50" cy="91" rx="34" ry="6" fill="url(#shadow)"/>', '');
  const open = svg.indexOf('</defs>') + '</defs>'.length;
  const filter =
    '<filter id="silhouette" x="-10%" y="-10%" width="120%" height="120%">' +
    // Semi-transparent parts (glass) count as solid: the shape is all that matters.
    '<feComponentTransfer in="SourceAlpha" result="solid"><feFuncA type="linear" slope="4"/></feComponentTransfer>' +
    '<feMorphology in="solid" operator="dilate" radius="2.4" result="grown"/>' +
    `<feFlood flood-color="${SILHOUETTE_RIM}"/><feComposite in2="grown" operator="in" result="rim"/>` +
    `<feFlood flood-color="${SILHOUETTE_FILL}"/><feComposite in2="solid" operator="in" result="shape"/>` +
    '<feMerge><feMergeNode in="rim"/><feMergeNode in="shape"/></feMerge></filter>';
  return svg.slice(0, open - '</defs>'.length) + filter + '</defs><g filter="url(#silhouette)">' + svg.slice(open, -'</svg>'.length) + '</g></svg>';
}
