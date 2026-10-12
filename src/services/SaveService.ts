import type { Wallet } from '../core/economy';
import type { Progress } from '../core/progress';

export interface Settings {
  readonly muted: boolean;
  /** Colour-blind mode: item variants also carry a mark that does not rely on colour. */
  readonly colorBlindMode: boolean;
  /** Short vibrations on triples, big combos and defeats (where the device has them). */
  readonly vibration: boolean;
  /**
   * Reduce motion: no screen shakes and no looping or bouncing animations. Null until the player changes it, so
   * the system's preference (prefers-reduced-motion) applies.
   */
  readonly reduceMotion: boolean | null;
  /** Background music (sound effects follow `muted`). */
  readonly music: boolean;
}

/** Everything the game persists. `version` is the schema version, bumped on any incompatible change. */
export interface SaveData {
  readonly version: number;
  readonly progress: Progress;
  readonly settings: Settings;
  /** Themes whose intro screen the player has seen (and closed). */
  readonly themesSeen: readonly string[];
  /** Per level id, the arrangement of its items played last (see nextArrangement). */
  readonly lastArrangements: Readonly<Record<string, number>>;
  /** Tutorials the player has completed (such as FIRST_TRIPLE_TUTORIAL); they never show again. */
  readonly tutorialsDone: readonly string[];
  /** Coins, experience, boosters owned, chests opened and boosters introduced (version 2). */
  readonly wallet: Wallet;
  /**
   * The level being played, to pick it up after a reload (see src/core/snapshot.ts), or null. Kept as stored: the
   * game checks it against the level when it restores it, and drops it if it does not fit.
   */
  readonly snapshot: unknown;
}

/** Persistence boundary. The game never touches storage APIs directly. */
export interface SaveService {
  /** Never throws: unavailable, corrupt or unknown saves come back as an empty (or migrated) save. */
  load(): SaveData;
  /** Never throws: if the save cannot be written, the game simply keeps going. */
  save(data: SaveData): void;
  clear(): void;
}

/** Keeps the save in memory only: for tests, and as a fallback when the browser offers no storage. */
export class MemorySaveService implements SaveService {
  private data: SaveData | null = null;

  constructor(private readonly empty: () => SaveData) {}

  load(): SaveData {
    return this.data ?? this.empty();
  }

  save(data: SaveData): void {
    this.data = data;
  }

  clear(): void {
    this.data = null;
  }
}
