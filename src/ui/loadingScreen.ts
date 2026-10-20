/**
 * The page's loading picture (index.html: the warung at sunset), shown from the first byte until the game has its
 * first screen ready. Fades out without holding anything up.
 */
export function hideLoadingScreen(): void {
  const picture = typeof document === 'undefined' ? null : document.getElementById('loading');
  if (!picture) return;
  picture.style.opacity = '0';
  setTimeout(() => picture.remove(), 260);
}
