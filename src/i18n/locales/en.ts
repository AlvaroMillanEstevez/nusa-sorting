export const en = {
  'game.title': 'Nusa Sorting',
  'hud.level': 'Level {n}',
  'hud.restart': 'Restart',
  'result.won.title': 'Level complete!',
  'result.won.timeLeft': 'Time left: {time}',
  'result.allDone.title': 'All levels complete!',
  'result.lost.timeUp': "Time's up!",
  'result.lost.blocked': 'No space left!',
  'result.lost.hint': 'Try again?',
  'result.next': 'Next level',
  'result.playAgain': 'Play again',
  'result.retry': 'Retry',
} as const;

export type MessageKey = keyof typeof en;
