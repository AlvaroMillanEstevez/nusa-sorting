/** Where the game opens. */
export type StartScreen = { readonly scene: 'Game'; readonly levelIndex: number } | { readonly scene: 'Home' };

/**
 * A first visit (no level completed yet) goes straight into level 1: portals like CrazyGames ask that new
 * players land in a game, not a menu. Later visits open the home screen. In development, ?level=N plays that
 * level and ?home opens the home screen.
 */
export function startScreen(completedLevels: number, dev: { level: number | null; home: boolean } = { level: null, home: false }): StartScreen {
  if (dev.home) return { scene: 'Home' };
  if (dev.level !== null) return { scene: 'Game', levelIndex: dev.level };
  return completedLevels === 0 ? { scene: 'Game', levelIndex: 0 } : { scene: 'Home' };
}
