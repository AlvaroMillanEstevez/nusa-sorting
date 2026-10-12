/**
 * Interface icons (not item icons): drawn as SVG on one 24-unit grid, with the same rounded 2-unit stroke and a
 * faint fill of the same colour, so they read as one family at any size. Never text or emoji.
 *
 * Each icon is a function of its colour, so the same drawing serves every skin and state.
 */

/** Stroke width on the 24-unit grid. */
export const UI_ICON_STROKE = 2;
/** Opacity of the inner fill that gives the icons their body. */
const BODY = 0.28;

type Draw = (c: string) => string;

const stroke = (c: string, width = UI_ICON_STROKE) =>
  ` fill="none" stroke="${c}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
const body = (c: string) => ` fill="${c}" fill-opacity="${BODY}"`;
const solid = (c: string) => ` fill="${c}"`;

/** A gear: a ring of rounded teeth around a hub. */
function gear(c: string): string {
  const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="10.4" y="1.6" width="3.2" height="4.4" rx="1.2" transform="rotate(${i * 45} 12 12)"${solid(c)}/>`).join('');
  return `${teeth}<circle cx="12" cy="12" r="7"${body(c)}/><circle cx="12" cy="12" r="7"${stroke(c)}/><circle cx="12" cy="12" r="2.6"${stroke(c)}/>`;
}

/** A five-pointed star centred on (12, 12.4). */
function starPoints(outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(12 + Math.cos(a) * r).toFixed(2)},${(12.6 + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}

export const UI_ICONS = {
  /** Sound on: a speaker with two waves. */
  sound: (c) =>
    `<path d="M4 9.5h3l4.5-4v13L7 14.5H4z"${body(c)}/><path d="M4 9.5h3l4.5-4v13L7 14.5H4z"${stroke(c)}/>` +
    `<path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.6a7.6 7.6 0 0 1 0 10.8"${stroke(c)}/>`,
  /** Sound off: the speaker with a cross (the cross, not a colour, says it is off). */
  mute: (c) =>
    `<path d="M4 9.5h3l4.5-4v13L7 14.5H4z"${body(c)}/><path d="M4 9.5h3l4.5-4v13L7 14.5H4z"${stroke(c)}/>` +
    `<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"${stroke(c)}/>`,
  /** Background music: two quavers joined by a beam. */
  music: (c) =>
    `<ellipse cx="7" cy="17.5" rx="2.8" ry="2.2"${body(c)}/><ellipse cx="17" cy="15.5" rx="2.8" ry="2.2"${body(c)}/>` +
    `<path d="M9.8 17.5V6.5l10-2v11M9.8 9.5l10-2"${stroke(c)}/><ellipse cx="7" cy="17.5" rx="2.8" ry="2.2"${stroke(c)}/><ellipse cx="17" cy="15.5" rx="2.8" ry="2.2"${stroke(c)}/>`,
  /** The level list: four rounded tiles. */
  levels: (c) =>
    [
      [4, 4],
      [13, 4],
      [4, 13],
      [13, 13],
    ]
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" rx="2"${body(c)}/><rect x="${x}" y="${y}" width="7" height="7" rx="2"${stroke(c)}/>`)
      .join(''),
  /** Restart: a circular arrow. */
  restart: (c) => `<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"${stroke(c)}/><path d="M18.4 3.6v3.6h-3.6"${stroke(c)}/>`,
  settings: gear,
  close: (c) => `<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"${stroke(c)}/>`,
  back: (c) => `<path d="M14.5 5.5L8 12l6.5 6.5"${stroke(c)}/>`,
  next: (c) => `<path d="M5 12h13M12.5 6l6 6-6 6"${stroke(c)}/>`,
  play: (c) => `<path d="M8 5.5v13l10.5-6.5z"${body(c)}/><path d="M8 5.5v13l10.5-6.5z"${stroke(c)}/>`,
  pause: (c) => `<rect x="6.5" y="5.5" width="3.6" height="13" rx="1.4"${solid(c)}/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.4"${solid(c)}/>`,
  /** Time: a clock face. */
  clock: (c) => `<circle cx="12" cy="12" r="8.5"${body(c)}/><circle cx="12" cy="12" r="8.5"${stroke(c)}/><path d="M12 7.5V12l3 2"${stroke(c)}/>`,
  star: (c) => `<polygon points="${starPoints(9, 4)}"${body(c)}/><polygon points="${starPoints(9, 4)}"${stroke(c)}/>`,
  starFilled: (c) => `<polygon points="${starPoints(9, 4)}"${solid(c)}/><polygon points="${starPoints(9, 4)}"${stroke(c)}/>`,
  /** Best score: a trophy cup. */
  trophy: (c) =>
    `<path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z"${body(c)}/><path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z"${stroke(c)}/>` +
    `<path d="M7.5 6.5H5a2.5 2.5 0 0 0 2.6 3.6M16.5 6.5H19a2.5 2.5 0 0 1-2.6 3.6M12 13v3.5M8.5 19.5h7M9.5 19.5l.8-3h3.4l.8 3"${stroke(c)}/>`,
  /** Combo: a flame. */
  combo: (c) =>
    `<path d="M12 3.5c1 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 2-4.2.2 1.5.8 2.4 1.8 2.8-.6-2.6-.2-5.2.7-7.6z"${body(c)}/>` +
    `<path d="M12 3.5c1 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 2-4.2.2 1.5.8 2.4 1.8 2.8-.6-2.6-.2-5.2.7-7.6z"${stroke(c)}/>`,
  lock: (c) =>
    `<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.4"${body(c)}/><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.4"${stroke(c)}/>` +
    `<path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.2v2.2"${stroke(c)}/>`,
  check: (c) => `<path d="M5.5 12.5l4.2 4.2 8.8-9.4"${stroke(c, 2.6)}/>`,
  /** Colour-blind mode: an eye. */
  eye: (c) =>
    `<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z"${body(c)}/>` +
    `<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6z"${stroke(c)}/><circle cx="12" cy="12" r="2.8"${stroke(c)}/>`,
  /** A hint: a light bulb. */
  hint: (c) =>
    `<path d="M8.6 14.6A5.5 5.5 0 1 1 15.4 14.6c-.8.6-1.2 1.4-1.2 2.4H9.8c0-1-.4-1.8-1.2-2.4z"${body(c)}/>` +
    `<path d="M8.6 14.6A5.5 5.5 0 1 1 15.4 14.6c-.8.6-1.2 1.4-1.2 2.4H9.8c0-1-.4-1.8-1.2-2.4zM9.8 20h4.4"${stroke(c)}/>`,
  info: (c) => `<circle cx="12" cy="12" r="8.5"${body(c)}/><circle cx="12" cy="12" r="8.5"${stroke(c)}/><path d="M12 11v5.5M12 7.6v.1"${stroke(c)}/>`,
  home: (c) =>
    `<path d="M4.5 11L12 4.5l7.5 6.5V19a1 1 0 0 1-1 1h-4v-5h-5v5h-4a1 1 0 0 1-1-1z"${body(c)}/>` +
    `<path d="M4.5 11L12 4.5l7.5 6.5V19a1 1 0 0 1-1 1h-4v-5h-5v5h-4a1 1 0 0 1-1-1z"${stroke(c)}/>`,
  /** Reduce motion: a dot with its speed lines struck through by calm. */
  motion: (c) =>
    `<circle cx="16" cy="12" r="4.5"${body(c)}/><circle cx="16" cy="12" r="4.5"${stroke(c)}/>` +
    `<path d="M3.5 8.5h6M2.5 12h5M3.5 15.5h6"${stroke(c)}/>`,
  /** Freeze booster: a snowflake. */
  freeze: (c) =>
    `<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5M4 10.4l3.4.9-.9 3.4M20 13.6l-3.4-.9.9-3.4M5.3 14.4l3.4-.9.9 3.4M18.7 9.6l-3.4.9-.9-3.4"${stroke(c)}/>`,
  /** Remove-a-triple booster: three items bursting from a tap. */
  removeTriple: (c) =>
    `<circle cx="12" cy="13" r="3.2"${body(c)}/><circle cx="12" cy="13" r="3.2"${stroke(c)}/>` +
    `<path d="M12 3.5v3M5 6.5l2 2M19 6.5l-2 2M3.5 13h3M17.5 13h3M6.5 19.5l1.8-1.8M17.5 19.5l-1.8-1.8"${stroke(c)}/>`,
  /** Shuffle booster: two crossing arrows. */
  shuffle: (c) => `<path d="M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.8 0 2.8-1.6 3.5-3.4M13 10.4c.7-1.8 1.7-3.4 3.5-3.4H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"${stroke(c)}/>`,
  /** A treasure chest: what stars collect. */
  chest: (c) =>
    `<path d="M4 10.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"${body(c)}/>` +
    `<path d="M4 10.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10.5V9a4.5 4.5 0 0 1 4.5-4.5h7A4.5 4.5 0 0 1 20 9v1.5M10.5 10.5v3h3v-3"${stroke(c)}/>`,
  /** Add (buy more): a plus. */
  plus: (c) => `<path d="M12 5.5v13M5.5 12h13"${stroke(c, 2.6)}/>`,
  /** For the coming coins: a coin seen face on, with a rim. */
  coin: (c) => `<circle cx="12" cy="12" r="8.5"${body(c)}/><circle cx="12" cy="12" r="8.5"${stroke(c)}/><circle cx="12" cy="12" r="5"${stroke(c)}/>`,
  /** For the coming shop: a shopping bag. */
  shop: (c) =>
    `<path d="M5.5 8.5h13l-1 11h-11z"${body(c)}/><path d="M5.5 8.5h13l-1 11h-11zM9 8.5V7a3 3 0 0 1 6 0v1.5"${stroke(c)}/>`,
  /** For the coming power-ups: a lightning bolt. */
  bolt: (c) => `<path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z"${body(c)}/><path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12z"${stroke(c)}/>`,
} as const satisfies Record<string, Draw>;

export type UiIconName = keyof typeof UI_ICONS;

export const UI_ICON_NAMES = Object.keys(UI_ICONS) as UiIconName[];

/** The SVG document of an icon in a colour. */
export function uiIconSvg(name: UiIconName, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${UI_ICONS[name](color)}</svg>`;
}
