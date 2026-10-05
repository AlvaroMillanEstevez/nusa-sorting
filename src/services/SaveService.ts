import type { Progress } from '../core/progress';

export interface Settings {
  readonly muted: boolean;
  /** Colour-blind mode: item variants also carry a mark that does not rely on colour. */
  readonly colorBlindMode: boolean;
}

/** Everything the game persists. `version` is the schema version, bumped on any incompatible change. */
export interface SaveData {
  readonly version: number;
  readonly progress: Progress;
  readonly settings: Settings;
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
