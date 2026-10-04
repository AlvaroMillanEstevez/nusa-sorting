/**
 * What an icon template is made of: a palette of named materials and a drawing that paints them with Paint,
 * plus small shape helpers shared by the templates.
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
  /** Hand-picked colours of the alternative variants; materials not listed keep their colour. */
  readonly variants: { readonly alt1: Palette; readonly alt2: Palette };
  draw(p: Paint): string;
}

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const OUTLINE = 2.4;

/** A star-like outline around an ellipse: `count` points pushed out by `spike` (a fraction of the radius). */
export function spikyEllipse(cx: number, cy: number, rx: number, ry: number, count: number, spike: number): string {
  return Array.from({ length: count * 2 }, (_, i) => {
    const k = i % 2 === 0 ? 1 + spike : 1;
    const a = (Math.PI * i) / count - Math.PI / 2;
    return `${r1(cx + Math.cos(a) * rx * k)},${r1(cy + Math.sin(a) * ry * k)}`;
  }).join(' ');
}

/** An oval with a scalloped, irregular edge (a puffed cracker seen slightly from above). */
export function wavyDisc(cx: number, cy: number, rx: number, ry: number, bumps: number, amp: number): string {
  const at = (k: number, a: number) => `${r1(cx + Math.cos(a) * rx * k)} ${r1(cy + Math.sin(a) * ry * k)}`;
  const parts = [`M${at(1 - amp, 0)}`];
  for (let i = 0; i < bumps; i++) {
    const wobble = 1 + 0.09 * Math.sin(i * 2.3) + 0.05 * Math.cos(i * 4.1);
    const mid = ((i + 0.5) / bumps) * 2 * Math.PI;
    const end = ((i + 1) / bumps) * 2 * Math.PI;
    parts.push(`Q${at((1 + amp) * wobble, mid)} ${at(1 - amp * (0.6 + 0.4 * Math.sin(i * 1.7)), end)}`);
  }
  return parts.join(' ') + 'Z';
}
