import { ECONOMY, type Reward } from '../data/economy';
import { ITEM_KINDS, parseItemType } from '../data/itemCatalog';
import { marketCategoryOf, type MarketCategory } from '../data/pasaran';
import { THEMES, type ThemeId } from '../data/themes';
import { addReward, type Wallet } from './economy';
import type { LevelDefinition } from './level';

/**
 * Buku Nenek, Grandma's book: an album with an entry per item kind (texts in src/data/bukuNenek.ts), found the first
 * time the player makes its triple. Its pages are the five food categories (as the market days have them) and the
 * themes with objects of their own, in level order; a page with every entry found gives a reward, collected in
 * the book (ECONOMY.album).
 */

export type AlbumPageId = MarketCategory | ThemeId;

export interface AlbumPage {
  readonly id: AlbumPageId;
  readonly kind: 'food' | 'theme';
  /** Kind ids, in catalogue order. */
  readonly kinds: readonly string[];
}

/** What the player has of the book, saved with the progress. */
export interface Album {
  /** Kind ids found, in the order they were found. */
  readonly found: readonly string[];
  /** Pages whose reward the player has collected. */
  readonly claimed: readonly AlbumPageId[];
  /** Kinds found that the map has not announced yet (it does after the next win). */
  readonly news: readonly string[];
}

export const EMPTY_ALBUM: Album = { found: [], claimed: [], news: [] };

const FOOD_PAGES: readonly MarketCategory[] = ['dish', 'snack', 'sweet', 'drink', 'fruit'];

/** The book's pages, food first, then each theme with objects (the last festival brings none). */
export const ALBUM_PAGES: readonly AlbumPage[] = [
  ...FOOD_PAGES.map((id): AlbumPage => ({ id, kind: 'food', kinds: ITEM_KINDS.filter((k) => marketCategoryOf(k) === id).map((k) => k.id) })),
  ...THEMES.map((theme): AlbumPage => ({ id: theme.id, kind: 'theme', kinds: ITEM_KINDS.filter((k) => k.theme === theme.id).map((k) => k.id) })).filter((page) => page.kinds.length > 0),
];

/** Every entry of the book. */
export const ALBUM_SIZE = ALBUM_PAGES.reduce((n, page) => n + page.kinds.length, 0);

export const albumPage = (id: AlbumPageId): AlbumPage | undefined => ALBUM_PAGES.find((page) => page.id === id);

/** The page an item kind's entry is on. */
export const pageOfKind = (kind: string): AlbumPage | undefined => ALBUM_PAGES.find((page) => page.kinds.includes(kind));

/**
 * Adds the kinds of `types` (item types, any colour variant) not found yet, as news for the map too. The same
 * album back when nothing is new.
 */
export function findKinds(album: Album, types: Iterable<string>): Album {
  const added: string[] = [];
  for (const type of types) {
    const kind = parseItemType(type)?.kind.id;
    if (kind && !album.found.includes(kind) && !added.includes(kind)) added.push(kind);
  }
  return added.length === 0 ? album : { ...album, found: [...album.found, ...added], news: [...album.news, ...added] };
}

/** The kind ids of the items a level holds (on shelves and in stacks). */
export function kindsOfLevel(level: LevelDefinition): string[] {
  const kinds = new Set<string>();
  const add = (type: string) => {
    const kind = parseItemType(type)?.kind.id;
    if (kind) kinds.add(kind);
  };
  for (const layers of level.shelves) for (const layer of layers) for (const type of layer) if (type !== null) add(type);
  for (const mechanic of level.mechanics ?? []) {
    if (mechanic.kind !== 'tracks') continue;
    for (const track of mechanic.tracks) for (const carrier of track.carriers) if (!('shelf' in carrier)) carrier.forEach(add);
  }
  return [...kinds];
}

/** How far a page is: entries found of all, whether it is complete and whether its reward was collected. */
export function pageProgress(album: Album, page: AlbumPage): { found: number; total: number; complete: boolean; claimed: boolean } {
  const found = page.kinds.filter((kind) => album.found.includes(kind)).length;
  return { found, total: page.kinds.length, complete: found === page.kinds.length, claimed: album.claimed.includes(page.id) };
}

/** What completing a page gives (ECONOMY.album). */
export function pageReward(page: AlbumPage): Reward {
  const { foodPage, themePages } = ECONOMY.album;
  return page.kind === 'food' ? foodPage : ((themePages as Readonly<Record<string, Reward>>)[page.id] ?? foodPage);
}

/** Collects a complete page's reward into the wallet; null if the page is not complete or was collected. */
export function claimPage(album: Album, wallet: Wallet, id: AlbumPageId): { album: Album; wallet: Wallet; reward: Reward } | null {
  const page = albumPage(id);
  if (!page) return null;
  const { complete, claimed } = pageProgress(album, page);
  if (!complete || claimed) return null;
  const reward = pageReward(page);
  return { album: { ...album, claimed: [...album.claimed, id] }, wallet: addReward(wallet, reward), reward };
}

/** Pages complete and waiting for the player to collect their reward. */
export const pagesToClaim = (album: Album): AlbumPage[] => ALBUM_PAGES.filter((page) => pageProgress(album, page).complete && !album.claimed.includes(page.id));

/** The kinds found since the map last announced them, and the album with none waiting. */
export function takeNews(album: Album): { album: Album; news: readonly string[] } {
  return { album: album.news.length === 0 ? album : { ...album, news: [] }, news: album.news };
}
