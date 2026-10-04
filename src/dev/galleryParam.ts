/** Development only: `?gallery` opens the icon gallery instead of the game. */
export function wantsGallery(search: string): boolean {
  return new URLSearchParams(search).has('gallery');
}
