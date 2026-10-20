/**
 * Colours of the level map: a tropical sea, sandy islands with green hearts, palms, wooden docks and boats.
 * Pure data, like the shelves' WOOD palette; the wooden parts reuse WOOD.
 */
export const MAP = {
  /** Sea, top to bottom of the screen, and the lighter water around the islands. */
  seaTop: '#12586b',
  seaBottom: '#0b3a4d',
  shallow: '#3a9ea0',
  wave: '#5fb3b0',
  foam: '#cfeee6',
  sand: '#e6c98d',
  sandShade: '#c9a463',
  grass: '#6c9a45',
  grassShade: '#557d35',
  palmTrunk: '#8a6038',
  palmLeaf: '#4f8a35',
  palmLeafLight: '#76b24c',
  /** The footsteps' shadow on the islands' path. */
  step: '#5a3a1e',
  rope: '#b98a4e',
  ropeLight: '#e0bd84',
  sail: '#f2ead8',
  cloud: '#e9f2f2',
} as const;
