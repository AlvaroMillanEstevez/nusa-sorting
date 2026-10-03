import type { SaveData, SaveService } from './SaveService';
import { emptySave, parseSave, serializeSave } from './saveFormat';

export const SAVE_KEY = 'nusa-sorting.save';

/** The part of the Web Storage API the save needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Returns localStorage if it can really be used, or null: it may be missing, throw on access (blocked cookies,
 * some private modes) or refuse writes (Safari private mode, full quota).
 */
export function browserStorage(host: { readonly localStorage?: StorageLike } | undefined = globalThis): StorageLike | null {
  try {
    const storage = host?.localStorage;
    if (!storage) return null;
    const probe = `${SAVE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Save on localStorage. Without usable storage it keeps the save in memory for the session, so the game
 * behaves the same and nothing throws; progress is simply not kept across visits.
 */
export class LocalSaveService implements SaveService {
  private memory: SaveData | null = null;

  constructor(private readonly storage: StorageLike | null = browserStorage()) {}

  load(): SaveData {
    if (!this.storage) return this.memory ?? emptySave();
    try {
      return parseSave(this.storage.getItem(SAVE_KEY));
    } catch {
      return this.memory ?? emptySave();
    }
  }

  save(data: SaveData): void {
    this.memory = data;
    try {
      this.storage?.setItem(SAVE_KEY, serializeSave(data));
    } catch {
      // Quota or a storage that became unavailable: keep playing with the in-memory copy.
    }
  }

  clear(): void {
    this.memory = null;
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // Nothing to clear if storage is gone.
    }
  }
}
