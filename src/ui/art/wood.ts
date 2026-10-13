/**
 * Colours of the wooden street-stall art (warung shelves, bamboo belts, crates). Pure data: scenes draw with
 * it, the icon tests check icons against it, and the gallery runs it through the colour-blindness simulation.
 */
export const WOOD = {
  /** Shelf frame: sides, top and supports. */
  frame: '#8b5a2f',
  frameLight: '#b27b45',
  frameDark: '#5e3b1d',
  /** Dark edge drawn around wooden parts. */
  line: '#3b2412',
  /** Front edge of the shelf board. */
  plank: '#a86d38',
  plankLight: '#d09658',
  plankDark: '#6e4421',
  grain: '#74482a',
  /**
   * Dark back wall of each shelf: the background every item is seen against. Dark so that white things
   * (bowls, plates, glasses, fruit flesh) stand out, and every icon's main colour is kept well above it.
   */
  wall: '#4a2e1b',
  wallSlat: '#583822',
  wallShade: '#331f11',
  /** Bamboo for belts and rails. */
  bamboo: '#d8bf72',
  bambooLight: '#efdc9c',
  bambooDark: '#9c8340',
  /** Lock: rolling shutter and brass padlock. */
  shutter: '#7d5532',
  shutterLight: '#9c6e44',
  shutterDark: '#4f331b',
  brass: '#e0b040',
  brassDark: '#8c6518',
  /** Log ends (conveyor rollers, the caps of shelf tracks), in the illustrated shelf's warm wood. */
  log: '#b97a40',
  logLight: '#dda468',
  logDark: '#6f4019',
  /** The roaming blocker: a wooden crate. */
  crate: '#c48a4c',
  crateLight: '#dfaa6c',
  crateDark: '#7e5126',
  /** The stall around the board on wide screens: striped awning, string lights, ketupat and lanterns. */
  awningRed: '#a8432f',
  awningRedDark: '#7a2c1d',
  awningCream: '#ecd5a6',
  awningCreamDark: '#c4a676',
  bulb: '#ffd27e',
  ketupat: '#7cb24a',
  ketupatDark: '#3f6b23',
  lantern: '#d0463a',
  lanternDark: '#8a2a1f',
} as const;

export type WoodPalette = { readonly [K in keyof typeof WOOD]: string };

/** The palette with every colour passed through `map` (used by the gallery's vision simulation). */
export function mapWood(map: (hex: string) => string): WoodPalette {
  return Object.fromEntries(Object.entries(WOOD).map(([k, v]) => [k, map(v)])) as unknown as WoodPalette;
}
