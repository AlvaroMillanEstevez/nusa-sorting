import { nextArrangement } from '../core/arrangement';
import { firstIncomplete, isUnlocked, recordWin, totalStars, type Progress, type WinRecord } from '../core/progress';
import type { Stars } from '../core/stars';
import type { SaveData, SaveService, Settings } from './SaveService';

/**
 * The game's view of saved data: reads once at start, and writes only on meaningful changes (a finished
 * level, a changed setting), never per frame.
 */
export class ProgressStore {
  private data: SaveData;

  /**
   * `systemReducedMotion` tells whether the system asks for reduced motion (prefers-reduced-motion): the default
   * until the player chooses.
   */
  constructor(
    private readonly saves: SaveService,
    private readonly systemReducedMotion: () => boolean = () => false,
  ) {
    this.data = saves.load();
  }

  get progress(): Progress {
    return this.data.progress;
  }

  get muted(): boolean {
    return this.data.settings.muted;
  }

  get themesSeen(): readonly string[] {
    return this.data.themesSeen;
  }

  /** Remembers that the intro screen of a theme was seen; call it once the player has closed it. */
  markThemeSeen(theme: string): void {
    if (this.data.themesSeen.includes(theme)) return;
    this.data = { ...this.data, themesSeen: [...this.data.themesSeen, theme] };
    this.saves.save(this.data);
  }

  /** Whether the player has completed a tutorial; it then never shows again. */
  isTutorialDone(id: string): boolean {
    return this.data.tutorialsDone.includes(id);
  }

  /** Remembers that a tutorial was completed; call it once, when the player does what it teaches. */
  markTutorialDone(id: string): void {
    if (this.data.tutorialsDone.includes(id)) return;
    this.data = { ...this.data, tutorialsDone: [...this.data.tutorialsDone, id] };
    this.saves.save(this.data);
  }

  /**
   * The arrangement of a level's items to play now, out of `count`: 0 the first time, then a different one each
   * attempt. Remembers it, so the next attempt (even after closing the game) moves on to another.
   */
  takeArrangement(levelId: string, count: number): number {
    const index = nextArrangement(count, this.data.lastArrangements[levelId]);
    this.data = { ...this.data, lastArrangements: { ...this.data.lastArrangements, [levelId]: index } };
    this.saves.save(this.data);
    return index;
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

  /** Most stars earned in a level, or null if it has none yet. */
  bestStars(levelId: string): Stars | null {
    return this.data.progress.bestStars[levelId] ?? null;
  }

  get totalStars(): number {
    return totalStars(this.data.progress);
  }

  recordWin(levelId: string, score: number | null, stars: Stars = 1): WinRecord {
    const record = recordWin(this.data.progress, levelId, score, stars);
    this.data = { ...this.data, progress: record.progress };
    this.saves.save(this.data);
    return record;
  }

  /** Reduce motion: the player's choice, or the system's preference while the player has not chosen. */
  get reduceMotion(): boolean {
    return this.data.settings.reduceMotion ?? this.systemReducedMotion();
  }

  setReduceMotion(on: boolean): void {
    this.setSetting('reduceMotion', on);
  }

  get vibration(): boolean {
    return this.data.settings.vibration;
  }

  setVibration(on: boolean): void {
    this.setSetting('vibration', on);
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
