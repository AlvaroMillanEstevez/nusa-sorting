/** Development only: `?art=v2` plays with the new art (wooden shelves, SVG icons) instead of the current one. */
export function wantsArtV2(search: string): boolean {
  return new URLSearchParams(search).get('art') === 'v2';
}
