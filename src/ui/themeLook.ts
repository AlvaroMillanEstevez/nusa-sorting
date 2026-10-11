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
  readonly motif: 'batik' | 'bunting' | 'bulbs' | 'waves' | 'court' | 'chalk' | 'spices' | 'terraces' | 'leaves' | 'festival';
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
  // A green sports field in mowed stripes, with the white lines of a court.
  olahraga: { sky: ['#1f5034', '#163c26'], motif: 'court', motifColors: ['#24583a', '#e8f0e0'], trim: '#f2f2e8', accent: '#ffcc33' },
  // Packed earth of a kampung yard, with chalked hopscotch squares and marbles.
  'permainan-tradisional': { sky: ['#4e3622', '#3c2a1a'], motif: 'chalk', motifColors: ['#e6dccb', '#8a6440'], trim: '#ffb347', accent: '#ffb347' },
  // Deep clove red, scattered with cloves and peppercorns.
  'rempah-maluku': { sky: ['#3c1712', '#2a0f0c'], motif: 'spices', motifColors: ['#7e3220', '#c8782e'], trim: '#e8953a', accent: '#e8953a' },
  // Rice terraces stepping down the hill, in fresh greens.
  sawah: { sky: ['#24472a', '#2f5a2a'], motif: 'terraces', motifColors: ['#2f6a34', '#7aac44'], trim: '#c9e265', accent: '#c9e265' },
  // A rainforest night: big leaves crowding in from the sides.
  'fauna-nusantara': { sky: ['#0f2c1e', '#0b2016'], motif: 'leaves', motifColors: ['#1e5236', '#2f7048'], trim: '#7ed957', accent: '#7ed957' },
  // The closing festival: bunting of every island's colours, bulbs and confetti on a party night.
  'festival-nusantara': {
    sky: ['#2c1044', '#1a0a2c'],
    motif: 'festival',
    motifColors: ['#e0282a', '#f6f4ee', '#ffd24a', '#5ad27a', '#5ab4ff', '#ff7ad0', '#d4a640'],
    trim: '#ffd24a',
    accent: '#ff7ad0',
  },
};

/** The look of a level's theme, or null for a level without one (or with a theme that has no look). */
export function themeLook(theme: string | undefined): ThemeLook | null {
  return theme && themeById(theme) ? THEME_LOOKS[theme as ThemeId] : null;
}
