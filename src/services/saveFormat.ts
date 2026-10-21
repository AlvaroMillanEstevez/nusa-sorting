import { BOOSTER_IDS, ECONOMY, type BoosterId } from '../data/economy';
import { EMPTY_WALLET, winCoins, xpForScore, type Wallet } from '../core/economy';
import { ALBUM_PAGES, EMPTY_ALBUM, kindsOfLevel, type Album, type AlbumPageId } from '../core/album';
import { ITEM_KINDS } from '../data/itemCatalog';
import { levels } from '../data/levels';
import { EMPTY_PROGRESS, totalStars, type Progress } from '../core/progress';
import type { Stars } from '../core/stars';
import type { SaveData, Settings } from './SaveService';

export const SAVE_VERSION = 4;

const DEFAULT_SETTINGS: Settings = { muted: false, colorBlindMode: false, vibration: true, reduceMotion: null, music: true };

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, progress: EMPTY_PROGRESS, settings: DEFAULT_SETTINGS, themesSeen: [], lastArrangements: {}, tutorialsDone: [], wallet: EMPTY_WALLET, album: EMPTY_ALBUM, snapshot: null };
}

/**
 * Upgrades from older schema versions: migrations[n] turns a version-n save into version n + 1. Add an entry
 * here when the schema changes.
 */
const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // Version 2 added the wallet. Progress made before it is not lost and earns what it would have: the coins of
  // each level's first win with its best stars, experience from its best score, and the chests its stars
  // reached counted as opened (no boosters: their intros give them when the player gets to them).
  1: (old) => ({ ...old, wallet: retroWallet(parseProgress(old.progress)) }),
  // Version 3 made chests open by hand: the stars not yet turned into a chest (version 2 opened one every
  // `everyStars` stars by itself) start the count towards the next, so no star and no pending chest is lost.
  2: (old) => ({ ...old, wallet: isRecord(old.wallet) ? { ...old.wallet, chestStars: pendingChestStars(parseProgress(old.progress), count(old.wallet.chestsOpened)) } : old.wallet }),
  // Version 4 added Buku Nenek. Every kind in a level already won counts as found (its triple was made to win
  // it), without news for the map; the pages it completes wait in the book for their rewards.
  3: (old) => ({ ...old, album: retroAlbum(parseProgress(old.progress)) }),
};

/** The album a version-3 save's progress would have filled: the kinds of every level won. */
export function retroAlbum(progress: Progress): Album {
  const found = new Set<string>();
  for (const level of levels) if (progress.completed.includes(level.id)) for (const kind of kindsOfLevel(level)) found.add(kind);
  return { ...EMPTY_ALBUM, found: ITEM_KINDS.map((k) => k.id).filter((id) => found.has(id)) };
}

/** Stars a version-2 save had collected beyond the chests it opened. */
export function pendingChestStars(progress: Progress, chestsOpened: number): number {
  return Math.max(0, totalStars(progress) - chestsOpened * ECONOMY.chests.everyStars);
}

/** The wallet a version-1 save's progress would have earned. */
export function retroWallet(progress: Progress): Wallet {
  const coins = progress.completed.reduce((sum, id) => sum + winCoins(true, progress.bestStars[id] ?? 1, 0), 0);
  const xp = Object.values(progress.bestScores).reduce((sum, score) => sum + xpForScore(score), 0);
  return { ...EMPTY_WALLET, coins, xp, chestsOpened: Math.floor(totalStars(progress) / ECONOMY.chests.everyStars) };
}

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
    lastArrangements: parseArrangements(data.lastArrangements),
    tutorialsDone: parseIdList(data.tutorialsDone),
    wallet: parseWallet(data.wallet),
    album: parseAlbum(data.album),
    // Missing in older saves: no level in progress.
    snapshot: isRecord(data.snapshot) ? data.snapshot : null,
  };
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0);

/** The album; unknown kinds and pages are dropped, one by one. */
function parseAlbum(value: unknown): Album {
  if (!isRecord(value)) return EMPTY_ALBUM;
  const kinds = new Set(ITEM_KINDS.map((k) => k.id));
  const pages = new Set<string>(ALBUM_PAGES.map((p) => p.id));
  const found = parseIdList(value.found).filter((id) => kinds.has(id));
  return {
    found,
    claimed: parseIdList(value.claimed).filter((id): id is AlbumPageId => pages.has(id)),
    news: parseIdList(value.news).filter((id) => found.includes(id)),
  };
}

/** The wallet; bad fields fall back to zero or empty, one by one. */
function parseWallet(value: unknown): Wallet {
  if (!isRecord(value)) return EMPTY_WALLET;
  const boosters = isRecord(value.boosters) ? value.boosters : {};
  return {
    coins: count(value.coins),
    xp: count(value.xp),
    boosters: Object.fromEntries(BOOSTER_IDS.map((id) => [id, count(boosters[id])])) as Record<BoosterId, number>,
    chestsOpened: count(value.chestsOpened),
    chestStars: count(value.chestStars),
    introduced: parseIdList(value.introduced).filter((id): id is BoosterId => (BOOSTER_IDS as readonly string[]).includes(id)),
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
  const bestStars: Record<string, Stars> = {};
  if (isRecord(value.bestStars)) {
    for (const [id, stars] of Object.entries(value.bestStars)) {
      if (stars === 1 || stars === 2 || stars === 3) bestStars[id] = stars;
    }
  }
  return { completed, bestScores, bestStars };
}

/** A list of non-empty ids, without duplicates; anything else is dropped (missing in older saves: empty). */
function parseIdList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
}

/** Arrangement numbers by level id; bad entries are dropped (missing in older saves: none played yet). */
function parseArrangements(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(value)) return result;
  for (const [id, index] of Object.entries(value)) {
    if (id.length > 0 && typeof index === 'number' && Number.isInteger(index) && index >= 0) result[id] = index;
  }
  return result;
}

function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  // Settings added later are missing from older saves and simply take their default.
  return {
    muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_SETTINGS.muted,
    colorBlindMode: typeof value.colorBlindMode === 'boolean' ? value.colorBlindMode : DEFAULT_SETTINGS.colorBlindMode,
    vibration: typeof value.vibration === 'boolean' ? value.vibration : DEFAULT_SETTINGS.vibration,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    music: typeof value.music === 'boolean' ? value.music : DEFAULT_SETTINGS.music,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
