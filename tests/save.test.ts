import { describe, expect, it } from 'vitest';
import { winCoins } from '../src/core';
import { browserStorage, LocalSaveService, SAVE_KEY, type StorageLike } from '../src/services/LocalSaveService';
import { ProgressStore } from '../src/services/ProgressStore';
import { MemorySaveService, type SaveData } from '../src/services/SaveService';
import { emptySave, parseSave, SAVE_VERSION, serializeSave } from '../src/services/saveFormat';

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

/** Like Safari private mode or blocked storage: every call throws. */
class BrokenStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
  removeItem(): void {
    throw new Error('SecurityError');
  }
}

const sample: SaveData = {
  version: SAVE_VERSION,
  progress: { completed: ['level001', 'level002'], bestScores: { level004: 1250 }, bestStars: { level004: 2 } },
  settings: { muted: true, colorBlindMode: true, vibration: false, reduceMotion: true },
  themesSeen: ['budaya-jawa'],
  lastArrangements: { 'nusa-003': 2 },
  tutorialsDone: ['first-triple'],
  wallet: { coins: 340, xp: 5200, boosters: { freeze: 2, removeTriple: 0, shuffle: 1 }, chestsOpened: 1, introduced: ['freeze'] },
  snapshot: { format: 1, levelId: 'nusa-003', arrangement: 2 },
};

describe('save format', () => {
  it('round-trips a save', () => {
    expect(parseSave(serializeSave(sample))).toEqual(sample);
  });

  it('keeps a level in progress as stored, and drops one that is not an object', () => {
    expect(parseSave(JSON.stringify({ ...sample, snapshot: 'oops' })).snapshot).toBeNull();
    const { snapshot: _none, ...older } = sample;
    expect(parseSave(JSON.stringify(older)).snapshot).toBeNull();
  });

  it.each([
    ['nothing stored', null],
    ['not JSON', '{oops'],
    ['not an object', '[1,2,3]'],
    ['a number', '42'],
    ['no version', JSON.stringify({ progress: sample.progress })],
    ['a newer version', JSON.stringify({ ...sample, version: SAVE_VERSION + 1 })],
    ['an older version without migration', JSON.stringify({ ...sample, version: 0 })],
    ['a non-integer version', JSON.stringify({ ...sample, version: 1.5 })],
  ])('starts empty with %s', (_name, raw) => {
    expect(parseSave(raw)).toEqual(emptySave());
  });

  it('drops malformed fields but keeps the valid ones', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION,
      progress: {
        completed: ['level001', 7, '', null, 'level001', 'level003'],
        bestScores: { level004: 900, level005: -1, level006: 'lots', level007: null },
        bestStars: { level004: 3, level005: 4, level006: '2', level007: 0, level008: 1.5 },
      },
      settings: { muted: 'yes', colorBlindMode: 1, vibration: 'no', reduceMotion: 'yes' },
      themesSeen: ['budaya-jawa', 7, '', 'budaya-jawa', '17-agustus'],
      lastArrangements: { 'nusa-001': 3, 'nusa-002': -1, 'nusa-004': 1.5, 'nusa-005': '2', '': 1 },
      tutorialsDone: 'first-triple',
      wallet: { coins: -5, xp: 120.5, boosters: { freeze: 3, shuffle: 'two', magic: 4 }, chestsOpened: 2, introduced: ['freeze', 'magic', 7] },
    });
    expect(parseSave(raw)).toEqual({
      version: SAVE_VERSION,
      progress: { completed: ['level001', 'level003'], bestScores: { level004: 900 }, bestStars: { level004: 3 } },
      settings: { muted: false, colorBlindMode: false, vibration: true, reduceMotion: null },
      themesSeen: ['budaya-jawa', '17-agustus'],
      lastArrangements: { 'nusa-001': 3 },
      tutorialsDone: [],
      wallet: { coins: 0, xp: 0, boosters: { freeze: 3, removeTriple: 0, shuffle: 0 }, chestsOpened: 2, introduced: ['freeze'] },
      snapshot: null,
    });
  });

  it('reads saves from before colour-blind mode existed with the mode off', () => {
    const old = JSON.stringify({ version: SAVE_VERSION, progress: sample.progress, settings: { muted: true } });
    expect(parseSave(old).settings).toEqual({ muted: true, colorBlindMode: false, vibration: true, reduceMotion: null });
  });

  it('still loads saves holding the mechanic notes once seen, dropping that field', () => {
    const withIntros = JSON.stringify({ ...sample, introsSeen: ['backLayers', 'stackTracks'] });
    expect(parseSave(withIntros)).toEqual(sample);
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, withIntros);
    const store = new ProgressStore(new LocalSaveService(storage));
    expect(store.bestScore('level004')).toBe(1250);
    expect(store.colorBlindMode).toBe(true);
  });

  it('survives missing sections', () => {
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION }))).toEqual(emptySave());
  });
});

describe('LocalSaveService', () => {
  it('stores and loads under its key', () => {
    const storage = new FakeStorage();
    new LocalSaveService(storage).save(sample);
    expect(storage.items.has(SAVE_KEY)).toBe(true);
    expect(new LocalSaveService(storage).load()).toEqual(sample);
  });

  it('starts empty from a corrupt stored value', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    expect(new LocalSaveService(storage).load()).toEqual(emptySave());
  });

  it('never throws when storage is unavailable, keeping the session in memory', () => {
    for (const saves of [new LocalSaveService(new BrokenStorage()), new LocalSaveService(null)]) {
      expect(saves.load()).toEqual(emptySave());
      expect(() => saves.save(sample)).not.toThrow();
      expect(saves.load()).toEqual(sample);
      expect(() => saves.clear()).not.toThrow();
      expect(saves.load()).toEqual(emptySave());
    }
  });

  it('clears the stored save', () => {
    const storage = new FakeStorage();
    const saves = new LocalSaveService(storage);
    saves.save(sample);
    saves.clear();
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(saves.load()).toEqual(emptySave());
  });
});

describe('browserStorage', () => {
  it('returns usable storage', () => {
    const storage = new FakeStorage();
    expect(browserStorage({ localStorage: storage })).toBe(storage);
    expect(storage.items.size).toBe(0);
  });

  it('returns null when storage is missing, throws on access or refuses writes', () => {
    expect(browserStorage(undefined)).toBeNull();
    expect(browserStorage({})).toBeNull();
    const throwingHost = {
      get localStorage(): StorageLike {
        throw new Error('SecurityError');
      },
    };
    expect(browserStorage(throwingHost)).toBeNull();
    expect(browserStorage({ localStorage: new BrokenStorage() })).toBeNull();
  });
});

describe('ProgressStore', () => {
  it('loads once and saves only when a level is won or a setting changes', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, serializeSave(sample));
    storage.writes = 0;
    const store = new ProgressStore(new LocalSaveService(storage));
    expect(store.muted).toBe(true);
    expect(store.bestScore('level004')).toBe(1250);
    expect(storage.writes).toBe(0);

    const record = store.recordWin('level004', 1500);
    expect(record.newBest).toBe(true);
    expect(storage.writes).toBe(1);
    store.setMuted(true); // unchanged: no write
    expect(storage.writes).toBe(1);
    store.setMuted(false);
    expect(storage.writes).toBe(2);

    const reloaded = new ProgressStore(new LocalSaveService(storage));
    expect(reloaded.bestScore('level004')).toBe(1500);
    expect(reloaded.muted).toBe(false);
  });

  it('remembers the theme intros seen, saving only the first time, and reads older saves as none seen', () => {
    const storage = new FakeStorage();
    const store = new ProgressStore(new LocalSaveService(storage));
    expect(store.themesSeen).toEqual([]);
    store.markThemeSeen('budaya-jawa');
    store.markThemeSeen('budaya-jawa');
    expect(storage.writes).toBe(1);
    expect(new ProgressStore(new LocalSaveService(storage)).themesSeen).toEqual(['budaya-jawa']);
    const old = JSON.stringify({ version: SAVE_VERSION, progress: sample.progress, settings: sample.settings });
    expect(parseSave(old).themesSeen).toEqual([]);
  });

  it('follows the system for reduce motion until the player chooses, then keeps the choice', () => {
    const storage = new FakeStorage();
    const systemWants = new ProgressStore(new LocalSaveService(storage), () => true);
    expect(systemWants.reduceMotion).toBe(true);
    systemWants.setReduceMotion(false);
    expect(new ProgressStore(new LocalSaveService(storage), () => true).reduceMotion).toBe(false);
    expect(new ProgressStore(new LocalSaveService(new FakeStorage()), () => false).reduceMotion).toBe(false);
  });

  it('migrates a version 1 save to version 2 keeping its progress, and gives it what that progress earned', () => {
    const v1 = JSON.stringify({
      version: 1,
      progress: { completed: ['a', 'b'], bestScores: { a: 2000, b: 3000 }, bestStars: { a: 3, b: 2 } },
      settings: { muted: true, colorBlindMode: false },
      themesSeen: ['budaya-jawa'],
      lastArrangements: { a: 1 },
      tutorialsDone: ['first-triple'],
    });
    const save = parseSave(v1);
    expect(save.version).toBe(2);
    expect(save.progress.completed).toEqual(['a', 'b']);
    expect(save.settings.muted).toBe(true);
    expect(save.themesSeen).toEqual(['budaya-jawa']);
    // First-win coins with the best stars, experience from the best scores, no chest for 5 stars.
    expect(save.wallet).toEqual({ coins: winCoins(true, 3, 0) + winCoins(true, 2, 0), xp: 5000, boosters: { freeze: 0, removeTriple: 0, shuffle: 0 }, chestsOpened: 0, introduced: [] });
  });

  it('remembers completed tutorials, saving only the first time, and reads older saves as none done', () => {
    const storage = new FakeStorage();
    const store = new ProgressStore(new LocalSaveService(storage));
    expect(store.isTutorialDone('first-triple')).toBe(false);
    store.markTutorialDone('first-triple');
    store.markTutorialDone('first-triple');
    expect(storage.writes).toBe(1);
    expect(new ProgressStore(new LocalSaveService(storage)).isTutorialDone('first-triple')).toBe(true);
    const old = JSON.stringify({ version: SAVE_VERSION, progress: sample.progress, settings: sample.settings });
    expect(parseSave(old).tutorialsDone).toEqual([]);
  });

  it('plays arrangement 0 first, then another each attempt in turn, remembered across sessions', () => {
    const storage = new FakeStorage();
    const store = new ProgressStore(new LocalSaveService(storage));
    expect([0, 1, 2, 3].map(() => store.takeArrangement('nusa-004', 3))).toEqual([0, 1, 2, 0]);
    expect(store.takeArrangement('nusa-005', 3)).toBe(0);
    expect(new ProgressStore(new LocalSaveService(storage)).takeArrangement('nusa-004', 3)).toBe(1);
    const old = JSON.stringify({ version: SAVE_VERSION, progress: sample.progress, settings: sample.settings });
    expect(parseSave(old).lastArrangements).toEqual({});
  });

  it('keeps colour-blind mode off by default, and saves it when it changes', () => {
    const storage = new FakeStorage();
    const store = new ProgressStore(new LocalSaveService(storage));
    expect(store.colorBlindMode).toBe(false);
    store.setColorBlindMode(false); // unchanged: no write
    expect(storage.writes).toBe(0);
    store.setColorBlindMode(true);
    expect(storage.writes).toBe(1);
    expect(new ProgressStore(new LocalSaveService(storage)).colorBlindMode).toBe(true);
    expect(store.muted).toBe(false);
  });

  it('answers progression questions by level id', () => {
    const store = new ProgressStore(new MemorySaveService(emptySave));
    const ids = ['level001', 'level002', 'level003'];
    expect(store.firstIncomplete(ids)).toBe(0);
    store.recordWin('level001', null);
    expect(store.isUnlocked(ids, 1)).toBe(true);
    expect(store.isUnlocked(ids, 2)).toBe(false);
    expect(store.firstIncomplete(ids)).toBe(1);
  });

  it('resets to an empty save', () => {
    const storage = new FakeStorage();
    const store = new ProgressStore(new LocalSaveService(storage));
    store.recordWin('level001', 10);
    store.reset();
    expect(store.progress.completed).toEqual([]);
    expect(storage.items.has(SAVE_KEY)).toBe(false);
  });
});
