import { firstIncomplete, isUnlocked, recordWin, type Progress, type WinRecord } from '../core/progress';
import type { SaveData, SaveService, Settings } from './SaveService';

/**
 * The game's view of saved data: reads once at start, and writes only on meaningful changes (a finished
 * level, a changed setting), never per frame.
 */
export class ProgressStore {
  private data: SaveData;

  constructor(private readonly saves: SaveService) {
    this.data = saves.load();
  }

  get progress(): Progress {
    return this.data.progress;
  }

  get muted(): boolean {
    return this.data.settings.muted;
  }

  get introsSeen(): readonly string[] {
    return this.data.introsSeen;
  }

  /** Remembers that a mechanic intro was shown. */
  markIntroSeen(id: string): void {
    if (this.data.introsSeen.includes(id)) return;
    this.data = { ...this.data, introsSeen: [...this.data.introsSeen, id] };
    this.saves.save(this.data);
  }

  get colorBlindMode(): boolean {
    return this.data.settings.colorBlindMode;
  }

  isUnlocked(levelIds: readonly string[], index: number): boolean {
    return isUnlocked(this.data.progress, levelIds, index);
  }

  firstIncomplete(levelIds: readonly string[]): number | null {
    return firstIncomplete(this.data.progress, levelIds);
  }

  bestScore(levelId: string): number | null {
    return this.data.progress.bestScores[levelId] ?? null;
  }

  recordWin(levelId: string, score: number | null): WinRecord {
    const record = recordWin(this.data.progress, levelId, score);
    this.data = { ...this.data, progress: record.progress };
    this.saves.save(this.data);
    return record;
  }

  setMuted(muted: boolean): void {
    this.setSetting('muted', muted);
  }

  setColorBlindMode(on: boolean): void {
    this.setSetting('colorBlindMode', on);
  }

  private setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (value === this.data.settings[key]) return;
    this.data = { ...this.data, settings: { ...this.data.settings, [key]: value } };
    this.saves.save(this.data);
  }

  /** Forgets all progress and settings (development reset). */
  reset(): void {
    this.saves.clear();
    this.data = this.saves.load();
  }
}
