import { EMPTY_PROGRESS, type Progress } from '../core/progress';
import type { SaveData, Settings } from './SaveService';

export const SAVE_VERSION = 1;

const DEFAULT_SETTINGS: Settings = { muted: false, colorBlindMode: false };

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, progress: EMPTY_PROGRESS, settings: DEFAULT_SETTINGS, themesSeen: [] };
}

/**
 * Upgrades from older schema versions: migrations[n] turns a version-n save into version n + 1.
 * There is only version 1 so far; add an entry here when the schema changes.
 */
const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

/**
 * Reads a stored save. Never throws: missing, unparsable, non-object or future-version data gives an empty save;
 * older versions are migrated step by step (or reset if no migration exists); malformed fields are dropped one
 * by one, so a single bad entry does not cost the player the rest of their progress.
 */
export function parseSave(raw: string | null): SaveData {
  if (raw === null) return emptySave();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!isRecord(value) || typeof value.version !== 'number' || !Number.isInteger(value.version)) return emptySave();

  let data = value;
  for (let version = value.version; version < SAVE_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) return emptySave();
    data = { ...migrate(data), version: version + 1 };
  }
  if (data.version !== SAVE_VERSION) return emptySave();
  return {
    version: SAVE_VERSION,
    progress: parseProgress(data.progress),
    // Fields the game no longer uses (such as introsSeen, from the mechanic notes) are simply dropped.
    settings: parseSettings(data.settings),
    themesSeen: parseIdList(data.themesSeen),
  };
}

function parseProgress(value: unknown): Progress {
  if (!isRecord(value)) return EMPTY_PROGRESS;
  const completed = Array.isArray(value.completed)
    ? [...new Set(value.completed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
  const bestScores: Record<string, number> = {};
  if (isRecord(value.bestScores)) {
    for (const [id, score] of Object.entries(value.bestScores)) {
      if (typeof score === 'number' && Number.isFinite(score) && score >= 0) bestScores[id] = score;
    }
  }
  return { completed, bestScores };
}

/** A list of non-empty ids, without duplicates; anything else is dropped (missing in older saves: empty). */
function parseIdList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  // Settings added later are missing from older saves and simply take their default.
  return {
    muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_SETTINGS.muted,
    colorBlindMode: typeof value.colorBlindMode === 'boolean' ? value.colorBlindMode : DEFAULT_SETTINGS.colorBlindMode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
