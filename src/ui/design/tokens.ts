/**
 * The interface design system: the one place every screen takes its sizes, type, colours, depth and motion from
 * (see docs/ui-style.md). Pure data, so it is tested (contrast, minimum sizes, the 8 px grid) and can be mapped
 * through a colour-vision simulation like the board art.
 *
 * The game uses direction A, "warung": warm wood, earth tones, raised buttons with a marked bottom lip. Its
 * colours, depth and corner style live in a Skin, so the colour-vision simulation can map them.
 */

// ---------------------------------------------------------------- spacing: an 8 px grid

/** Base unit of the grid, in CSS px. Every gap, padding and size is a multiple of it (or half of it, 4). */
export const GRID = 8;

/** n grid units in px; half units (n = 0.5, 1.5...) are allowed for fine adjustments. */
export const space = (n: number): number => n * GRID;

export const SPACE = {
  /** 4: between an icon and its label. */
  hair: space(0.5),
  /** 8: inside small pills, between related things. */
  xs: space(1),
  /** 16: standard padding, screen margins. */
  s: space(2),
  /** 24: between groups. */
  m: space(3),
  /** 32: around panels. */
  l: space(4),
  /** 48: between sections. */
  xl: space(6),
} as const;

// ---------------------------------------------------------------- touch

/** Smallest touch target, in CSS px (Apple HIG 44 pt; Material asks 48 dp, which the main buttons meet). */
export const MIN_TOUCH = 44;

// ---------------------------------------------------------------- type

/** Families: bundled OFL fonts (src/assets/fonts), with the system font as a fallback while they load. */
export const FONTS = {
  /** Titles and numbers: Fredoka, cut to Latin with tabular digits (a running clock does not shift). */
  display: '"NusaDisplay", "Fredoka", system-ui, sans-serif',
  /** Reading: Plus Jakarta Sans, made in Indonesia for Jakarta's identity. */
  text: '"NusaText", "Plus Jakarta Sans", system-ui, sans-serif',
} as const;

export type FontRole = keyof typeof FONTS;

export interface TypeStyle {
  readonly font: FontRole;
  /** CSS px. */
  readonly size: number;
  readonly weight: 500 | 600 | 700;
  /** Extra space between letters, in px (titles in capitals breathe a little). */
  readonly tracking: number;
}

/** No text is ever smaller than this (captions included), in CSS px. */
export const MIN_TEXT = 12;
/** Body text and anything players must read during play: at least this, in CSS px. */
export const MIN_BODY_TEXT = 14;

/** The type scale. Sizes are for a phone; screens may scale them down to MIN_TEXT at most. */
export const TYPE = {
  /** Big moments: "Level complete!". */
  hero: { font: 'display', size: 40, weight: 600, tracking: 0.5 },
  /** Panel and screen titles. */
  title: { font: 'display', size: 28, weight: 600, tracking: 0.3 },
  /** Numbers in the HUD: time, score. */
  number: { font: 'display', size: 22, weight: 600, tracking: 0 },
  /** Button labels. */
  button: { font: 'display', size: 20, weight: 600, tracking: 0.3 },
  /** Body text: panel lines, hints. */
  body: { font: 'text', size: 16, weight: 500, tracking: 0 },
  /** Labels over numbers ("SCORE"), small buttons. */
  label: { font: 'text', size: 14, weight: 700, tracking: 0.6 },
  /** The smallest text: notes, badges. */
  caption: { font: 'text', size: 12, weight: 700, tracking: 0.4 },
} as const satisfies Record<string, TypeStyle>;

export type TypeRole = keyof typeof TYPE;

/** Text this size or more (bold) counts as large for contrast (WCAG: 18.66 px bold). */
export const LARGE_TEXT = 18.66;

// ---------------------------------------------------------------- radii

export const RADIUS = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  /** Half the height: a pill. */
  pill: 999,
} as const;

// ---------------------------------------------------------------- motion

/** Durations in ms. Short: the board never waits for the interface. */
export const DURATION = {
  /** Press feedback. */
  press: 90,
  /** Small changes: a toggle, a counter tick. */
  fast: 140,
  /** Most transitions: a panel in, a pill changing. */
  base: 220,
  /** Bigger entrances: the victory panel, a screen. */
  slow: 360,
  /** A screen to screen change (fade through the background colour). */
  screen: 420,
} as const;

/** Phaser easing names. */
export const EASE = {
  /** Things arriving and settling. */
  enter: 'Cubic.easeOut',
  /** Things leaving. */
  exit: 'Cubic.easeIn',
  /** A little overshoot: buttons released, panels popping in, rewards. */
  pop: 'Back.easeOut',
  /** Continuous loops: pulses, idle hints. */
  loop: 'Sine.easeInOut',
} as const;

/**
 * Booster tiles (KitBoosterButton): a carved wooden panel in a brass frame, standing on a dark lip, with the
 * count in a dark badge ringed in brass, a green "+" badge to buy one, and a greyed, padlocked look while locked.
 * The sparkles of a gift ready to open (the star chest) use the glint and glow colours.
 */
export const TILE = {
  rim: '#e0b040',
  rimLight: '#f6d98a',
  rimShade: '#a3761f',
  lip: '#6b4612',
  panel: '#8a5530',
  panelLight: '#b27b45',
  panelShade: '#5e3b1d',
  /** Warm light behind the icon. */
  glow: '#ffd98a',
  badge: '#2e1b0d',
  /** Locked: the frame and panel greyed out, the icon darkened by this tint. */
  lockedRim: '#8d8273',
  lockedPanel: '#4f463d',
  lockedIcon: '#6a6a6a',
  /** A gift ready to open: golden glints and a warm glow. */
  glint: '#fff1b8',
} as const;

/**
 * Fresh foods (the 'fresh' mechanic, "basi"): the countdown's price tag on a fresh item, which turns dark with a
 * brass edge and pulses in its last moves, and the flies on a spoiled one. Light and dark swap, so the warning
 * never relies on colour.
 */
export const FRESH = {
  fill: '#fffaf0',
  ring: '#2e1b0d',
  number: '#2e1b0d',
  warnFill: '#2e1b0d',
  warnRing: '#e0b040',
  warnNumber: '#fffaf0',
  fly: '#1b1610',
  wing: '#e9f1f1',
  /** The countdown, a paper price tag on a thread: card, its edge and thread; dark kraft card while warning. */
  tag: '#f3e6c4',
  tagEdge: '#8a6a42',
  thread: '#6b4f2e',
  tagWarn: '#4a2e1b',
  /** The badge warns from this many moves left. */
  warnFrom: 3,
  /** Each half of the warning's pulse, in ms. */
  pulseMs: 420,
} as const;

/** How components react when pressed. */
export const PRESS = {
  /** Scale while held. */
  scale: 0.95,
  /** Overshoot on release, before settling back to 1. */
  release: 1.04,
} as const;

/**
 * How far a disabled control's colours fade towards the sunken well colour, and its label's opacity. It also
 * loses its lip, its shadow and its input, so the state is not shown by colour alone.
 */
export const DISABLED = { fade: 0.6, label: 0.55 } as const;

/** A fill as a disabled control shows it. */
export function disabledFill(fill: Fill, well: string): Fill {
  const fade = (hex: string) => mixHex(hex, well, DISABLED.fade);
  return { face: fade(fill.face), lip: fade(fill.lip), light: fade(fill.light), text: fill.text };
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------- colour and depth: the two directions

/** A coloured control: its face, the lip under it (direction A), a highlight and the label on it. */
export interface Fill {
  readonly face: string;
  /** Bottom lip / darker edge. */
  readonly lip: string;
  /** Top highlight. */
  readonly light: string;
  /** Label colour on the face. */
  readonly text: string;
}

/** A soft shadow under something raised, faked with a few stacked translucent shapes. */
export interface Elevation {
  readonly offsetY: number;
  readonly blur: number;
  readonly alpha: number;
}

export interface Skin {
  readonly id: 'warung';
  /** Behind everything: top and bottom of a vertical gradient. */
  readonly backdrop: readonly [string, string];
  /** Panels and modals. */
  readonly surface: {
    readonly fill: string;
    /** Opacity of the fill (below 1: the board shows through, direction B). */
    readonly alpha: number;
    readonly border: string;
    readonly borderAlpha: number;
    readonly borderWidth: number;
    /** A thin light line along the top inner edge. */
    readonly highlight: string;
    readonly highlightAlpha: number;
    /** Wood grain lines drawn over the fill (direction A), or null. */
    readonly grain: string | null;
  };
  /** HUD pills and other small surfaces over the board. */
  readonly chip: { readonly fill: string; readonly alpha: number; readonly border: string; readonly borderAlpha: number };
  /** Inset tracks: progress bar background, toggle track off. */
  readonly well: string;
  /** What text over surfaces, chips and the backdrop uses. Every pair is tested for contrast. */
  readonly text: { readonly primary: string; readonly secondary: string; readonly accent: string };
  readonly fills: {
    /** The main action of a screen ("Next", "Play"). */
    readonly primary: Fill;
    /** Other actions ("Levels"). */
    readonly secondary: Fill;
    /** Toggles on, progress, success. */
    readonly positive: Fill;
    /** Retry after a loss, destructive actions. */
    readonly danger: Fill;
  };
  /** States the HUD shows; each always comes with an icon or a motion, never colour alone. */
  readonly status: {
    readonly combo: string;
    readonly lowTime: string;
    readonly criticalTime: string;
  };
  /** Stars: an earned star is filled; one still to earn is a dark hollow with a light rim (shape, not colour). */
  readonly star: { readonly filled: string; readonly rim: string; readonly empty: string };
  /** Height of the lip under raised controls, in px (0: flat). */
  readonly lip: number;
  /** Corner radius of buttons as a share of their height (0.5: pills). */
  readonly buttonRound: number;
  readonly panelRadius: number;
  readonly chipRadius: number;
  readonly elevation: { readonly low: Elevation; readonly high: Elevation };
}

/** A: "warung cálido". Wood, earth tones, turmeric and bamboo; raised buttons with a marked bottom lip. */
export const WARUNG: Skin = {
  id: 'warung',
  backdrop: ['#3a2416', '#1f120a'],
  surface: {
    fill: '#6f4324',
    alpha: 1,
    border: '#2e1b0d',
    borderAlpha: 1,
    borderWidth: 3,
    highlight: '#b27b45',
    highlightAlpha: 0.9,
    grain: '#5e3a1f',
  },
  chip: { fill: '#2e1b0d', alpha: 0.86, border: '#8b5a2f', borderAlpha: 0.9 },
  well: '#2e1b0d',
  text: { primary: '#fff4e0', secondary: '#f0d7b0', accent: '#ffc95a' },
  fills: {
    primary: { face: '#f2a33a', lip: '#9c5a16', light: '#ffd27e', text: '#3a1e08' },
    secondary: { face: '#e6cc88', lip: '#8f763a', light: '#f7e7b6', text: '#3b2412' },
    positive: { face: '#6fae45', lip: '#3d6b22', light: '#a5d77f', text: '#16290a' },
    danger: { face: '#e8604a', lip: '#8a2a1a', light: '#f8a08c', text: '#2a0805' },
  },
  status: { combo: '#ffc95a', lowTime: '#ffc23d', criticalTime: '#ff7a68' },
  star: { filled: '#ffc93c', rim: '#f0d7b0', empty: '#2e1b0d' },
  lip: 5,
  buttonRound: 0.32,
  panelRadius: 18,
  chipRadius: 12,
  elevation: { low: { offsetY: 3, blur: 4, alpha: 0.35 }, high: { offsetY: 8, blur: 14, alpha: 0.45 } },
};

/** The game's skin: direction A, chosen by Koke in October 2026. */
export const SKIN: Skin = WARUNG;

/** A skin with every colour passed through `map` (for the colour-vision simulation). */
export function mapSkin(skin: Skin, map: (hex: string) => string): Skin {
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return /^#[0-9a-f]{6}$/i.test(value) ? map(value) : value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    return value;
  };
  return walk(skin) as Skin;
}

/** A hex colour as the number Phaser takes. */
export const hexNumber = (hex: string): number => Number.parseInt(hex.slice(1), 16);
