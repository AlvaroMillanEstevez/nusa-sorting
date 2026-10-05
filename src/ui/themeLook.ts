import type { ThemeId } from '../data/themes';
import { themeById } from '../data/themes';

/**
 * How a themed level looks: a background of its own behind the board, and accents on the shelves and the HUD.
 * The shelves' back wall, which every icon is seen against, never changes, so icons keep their contrast; and
 * the decoration only fills space the board does not use.
 */
export interface ThemeLook {
  /** Background, top to bottom (equal for a flat colour). */
  readonly sky: readonly [string, string];
  /** What is drawn over it. */
  readonly motif: 'batik' | 'bunting' | 'bulbs' | 'waves';
  /** Colours of the motif. */
  readonly motifColors: readonly string[];
  /** Trim along the top of the shelves and their front board. */
  readonly trim: string;
  /** Line under the HUD. */
  readonly accent: string;
}

export const THEME_LOOKS: Readonly<Record<ThemeId, ThemeLook>> = {
  // Brown and gold, with a quiet kawung batik pattern.
  'budaya-jawa': { sky: ['#2a1a10', '#22150c'], motif: 'batik', motifColors: ['#3e2817', '#5a3c1e'], trim: '#d4a640', accent: '#d4a640' },
  // Red and white, with strings of bunting.
  '17-agustus': { sky: ['#4a1214', '#3a0e10'], motif: 'bunting', motifColors: ['#e0282a', '#f6f4ee'], trim: '#e8e2d6', accent: '#e0282a' },
  // Night sky with strings of coloured bulbs.
  'pasar-malam': { sky: ['#0e1030', '#1e1240'], motif: 'bulbs', motifColors: ['#ffd24a', '#ff5a5a', '#5ad27a', '#5ab4ff'], trim: '#ffd24a', accent: '#ffd24a' },
  // Turquoise sea above, sand below, gentle waves.
  'laut-nusantara': { sky: ['#0e5a66', '#8a7448'], motif: 'waves', motifColors: ['#4fc8c0', '#e8d2a0'], trim: '#7fe0d8', accent: '#7fe0d8' },
};

/** The look of a level's theme, or null for a level without one (or with a theme that has no look). */
export function themeLook(theme: string | undefined): ThemeLook | null {
  return theme && themeById(theme) ? THEME_LOOKS[theme as ThemeId] : null;
}
