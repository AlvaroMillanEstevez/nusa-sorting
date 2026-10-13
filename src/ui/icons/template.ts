/**
 * What an icon template is made of: a palette of named materials and a drawing that paints them with Paint.
 */

export type Palette = Readonly<Record<string, string>>;

/** Drawing helpers handed to a template. */
export interface Paint {
  /** Three-tone linear shading (light top-left, base, shade bottom-right). */
  fill(material: string): string;
  /** Three-tone radial shading, for round things. */
  ball(material: string): string;
  flat(material: string): string;
  light(material: string): string;
  shade(material: string): string;
  /** The material's outline colour: a dark tone of the material, never black. */
  line(material: string): string;
  /** Outline attributes (` stroke="…" stroke-width="…"`). */
  edge(material: string, width?: number): string;
  /** A specular highlight: a bright core in a soft halo. */
  spec(cx: number, cy: number, rx: number, ry: number, rotate?: number): string;
}

export interface IconTemplate {
  readonly palette: Palette;
  draw(p: Paint): string;
}

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const OUTLINE = 2.4;
