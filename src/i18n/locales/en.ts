export const en = {
  'game.title': 'Nusa Sorting',
  'hud.restart': 'Restart',
  'game.won': 'Level complete!',
} as const;

export type MessageKey = keyof typeof en;
