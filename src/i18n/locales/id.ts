import type { MessageKey } from './en';

export const id: Record<MessageKey, string> = {
  'game.title': 'Nusa Sorting',
  'hud.level': 'Level {n}',
  'hud.restart': 'Ulangi',
  'hud.score': 'Skor {score}',
  'hud.combo': 'Kombo x{n}',
  'shelf.locked': '{n} lagi',
  'popup.combo': 'Kombo x{n}!',
  'popup.points': '+{points}',
  'popup.unlocked': 'Terbuka!',
  'popup.blockerRemoved': 'Penghalang hilang!',
  'result.won.title': 'Level selesai!',
  'result.won.timeLeft': 'Sisa waktu: {time}',
  'result.won.score': 'Skor: {score}',
  'result.allDone.title': 'Semua level selesai!',
  'result.lost.timeUp': 'Waktu habis!',
  'result.lost.blocked': 'Tidak ada ruang lagi!',
  'result.lost.hint': 'Coba lagi?',
  'result.next': 'Level berikutnya',
  'result.playAgain': 'Main lagi',
  'result.retry': 'Coba lagi',
};
