/**
 * Stops the page from scrolling, bouncing or zooming while the player drags items on touch screens.
 * Complements `touch-action: none` in index.html for browsers (notably iOS Safari) that ignore it in places.
 */
export function preventPageGestures(): void {
  const prevent = (event: Event) => event.preventDefault();
  document.addEventListener('touchmove', prevent, { passive: false });
  // iOS Safari pinch-zoom events.
  document.addEventListener('gesturestart', prevent);
  document.addEventListener('gesturechange', prevent);
  document.addEventListener('dblclick', prevent);
}
