import { nextArrangement } from '../core/arrangement';
import { firstIncomplete, isUnlocked, recordWin, totalStars, type Progress, type WinRecord } from '../core/progress';
import type { Stars } from '../core/stars';
import { buyBooster, introduceBooster, openChest, rewardWin, spend, useBooster, useOrBuyBooster, type Wallet, type WinFacts, type WinRewards } from '../core/economy';
import type { GameSnapshot } from '../core/snapshot';
import { claimPage, findKinds, takeNews, type Album, type AlbumPageId } from '../core/album';
import type { BoosterId, Reward } from '../data/economy';
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

  // ---------------------------------------------------------------- Buku Nenek

  get album(): Album {
    return this.data.album;
  }

  /** Records the kinds of triples just made (item types) in the book; saves only when one is new. */
  findKinds(types: Iterable<string>): void {
    const album = findKinds(this.data.album, types);
    if (album === this.data.album) return;
    this.data = { ...this.data, album };
    this.saves.save(this.data);
  }

  /** Collects a complete page's reward (see claimPage) and saves; null if it cannot be collected. */
  claimPage(id: AlbumPageId): Reward | null {
    const claimed = claimPage(this.data.album, this.data.wallet, id);
    if (!claimed) return null;
    this.data = { ...this.data, album: claimed.album, wallet: claimed.wallet };
    this.saves.save(this.data);
    return claimed.reward;
  }

  /** The kinds found since the map last announced them; they are not news any more. */
  takeAlbumNews(): readonly string[] {
    const { album, news } = takeNews(this.data.album);
    if (news.length > 0) {
      this.data = { ...this.data, album };
      this.saves.save(this.data);
    }
    return news;
  }

  // ---------------------------------------------------------------- wallet

  get wallet(): Wallet {
    return this.data.wallet;
  }

  private setWallet(wallet: Wallet): void {
    this.data = { ...this.data, wallet };
    this.saves.save(this.data);
  }

  /** Applies a win's rewards (coins, experience, level-up gifts, chests) and saves them. */
  rewardWin(win: WinFacts): WinRewards {
    const rewards = rewardWin(this.data.wallet, win);
    this.setWallet(rewards.wallet);
    return rewards;
  }

  /**
   * Opens a star chest if the player has the stars for one (see openChest), and saves; null if not. `reachedLevel`
   * is the furthest level the player can play: the chest's booster is one unlocked by then.
   */
  openChest(reachedLevel: number): { number: number; rewards: Reward[] } | null {
    const opened = openChest(this.data.wallet, reachedLevel);
    if (!opened) return null;
    this.setWallet(opened.wallet);
    return { number: opened.number, rewards: opened.rewards };
  }

  /** Buys one booster with coins; false if the player cannot afford it. */
  buyBooster(booster: BoosterId): boolean {
    const next = buyBooster(this.data.wallet, booster);
    if (next) this.setWallet(next);
    return next !== null;
  }

  /**
   * Uses one booster to continue: one the player has, else one bought at its shop price; false (and nothing
   * changes) if neither is possible.
   */
  useOrBuyBooster(booster: BoosterId): boolean {
    const next = useOrBuyBooster(this.data.wallet, booster);
    if (next) this.setWallet(next);
    return next !== null;
  }

  /** Pays coins (more time after running out of it); false (and nothing changes) if the player has too few. */
  spendCoins(coins: number): boolean {
    const next = spend(this.data.wallet, coins);
    if (next) this.setWallet(next);
    return next !== null;
  }

  /** Uses one booster; false if the player has none. */
  useBooster(booster: BoosterId): boolean {
    const next = useBooster(this.data.wallet, booster);
    if (next) this.setWallet(next);
    return next !== null;
  }

  /** Development only (?boosters=N): sets how many of every booster the player has. */
  setBoosterCounts(count: number): void {
    this.setWallet({ ...this.data.wallet, boosters: { freeze: count, removeTriple: count, shuffle: count } });
  }

  /** Development only (?coins=N): sets the coins. */
  setCoins(coins: number): void {
    this.setWallet({ ...this.data.wallet, coins });
  }

  /** Development only (?progress=N): adds stars towards chests, as winning them would. */
  addChestStars(stars: number): void {
    this.setWallet({ ...this.data.wallet, chestStars: this.data.wallet.chestStars + stars });
  }

  /** Gives a booster's intro gift, once; true if this was its first time. */
  introduceBooster(booster: BoosterId): boolean {
    if (this.data.wallet.introduced.includes(booster)) return false;
    this.setWallet(introduceBooster(this.data.wallet, booster));
    return true;
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

  get music(): boolean {
    return this.data.settings.music;
  }

  setMusic(on: boolean): void {
    this.setSetting('music', on);
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

  // ---------------------------------------------------------------- level in progress

  /** The snapshot of the level being played, as stored (null if none); see restoreSnapshot. */
  get snapshot(): unknown {
    return this.data.snapshot;
  }

  /** Keeps the level being played, to pick it up after a reload. */
  saveSnapshot(snapshot: GameSnapshot): void {
    this.data = { ...this.data, snapshot };
    this.saves.save(this.data);
  }

  /** Forgets the level in progress: it was won, lost, restarted or left. */
  clearSnapshot(): void {
    if (this.data.snapshot === null) return;
    this.data = { ...this.data, snapshot: null };
    this.saves.save(this.data);
  }

  /** Forgets all progress and settings (development reset). */
  reset(): void {
    this.saves.clear();
    this.data = this.saves.load();
  }
}
