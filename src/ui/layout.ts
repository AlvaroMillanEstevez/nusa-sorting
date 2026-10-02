/** Title font size in px for a given viewport, clamped so it stays readable on phones and desktops. */
export function titleFontSize(width: number, height: number): number {
  const shortSide = Math.min(width, height);
  return Math.round(Math.min(96, Math.max(28, shortSide * 0.12)));
}
