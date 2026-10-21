import { describe, expect, it } from 'vitest';
import { ALBUM_PAGES, ALBUM_SIZE, claimPage, EMPTY_ALBUM, EMPTY_WALLET, findKinds, kindsOfLevel, pageOfKind, pageProgress, pageReward, pagesToClaim, takeNews } from '../src/core';
import { BUKU_NENEK } from '../src/data/bukuNenek';
import { ECONOMY } from '../src/data/economy';
import { ITEM_KINDS } from '../src/data/itemCatalog';
import { levels } from '../src/data/levels';
import { main as reviewDocument } from '../tools/docs/bukuNenek';

// The project has no Node type definitions (it targets the browser); this test only needs to read one file.
const fsModule = 'node:fs';
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync(path: string, encoding: string): string };

describe('Buku Nenek', () => {
  it('has a page for each food category and each theme with objects, every kind on exactly one', () => {
    expect(ALBUM_SIZE).toBe(ITEM_KINDS.length);
    expect(ALBUM_PAGES.map((p) => p.id)).toEqual([
      'dish',
      'snack',
      'sweet',
      'drink',
      'fruit',
      'budaya-jawa',
      '17-agustus',
      'pasar-malam',
      'laut-nusantara',
      'olahraga',
      'permainan-tradisional',
      'rempah-maluku',
      'sawah',
      'fauna-nusantara',
    ]);
    for (const kind of ITEM_KINDS) expect(ALBUM_PAGES.filter((p) => p.kinds.includes(kind.id)), kind.id).toHaveLength(1);
    expect(pageOfKind('cabai')?.id).toBe('fruit');
  });

  it('has an entry for every kind, a short fact in both languages, and nothing else', () => {
    expect(Object.keys(BUKU_NENEK).sort()).toEqual(ITEM_KINDS.map((k) => k.id).sort());
    for (const [kind, entry] of Object.entries(BUKU_NENEK)) {
      for (const text of [entry.fact.en, entry.fact.id]) {
        expect(text.length, kind).toBeGreaterThan(20);
        expect(text.length, kind).toBeLessThanOrEqual(200);
        // One or two sentences.
        expect(text.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 1).length, `${kind}: ${text}`).toBeLessThanOrEqual(2);
      }
      if (entry.region) expect(entry.region.en.length * entry.region.id.length, kind).toBeGreaterThan(0);
    }
  });

  it('finds the kinds of the triples made, variants as their kind, once each, as news for the map', () => {
    const one = findKinds(EMPTY_ALBUM, ['sate', 'sate:alt1', 'gong']);
    expect(one).toEqual({ found: ['sate', 'gong'], claimed: [], news: ['sate', 'gong'] });
    expect(findKinds(one, ['sate'])).toBe(one);
    const { album, news } = takeNews(findKinds(one, ['rambutan']));
    expect(news).toEqual(['sate', 'gong', 'rambutan']);
    expect(album.news).toEqual([]);
    expect(album.found).toEqual(['sate', 'gong', 'rambutan']);
  });

  it('gives a complete page its reward once, collected by hand', () => {
    const sweets = ALBUM_PAGES.find((p) => p.id === 'sweet')!;
    const partial = findKinds(EMPTY_ALBUM, sweets.kinds.slice(1));
    expect(pageProgress(partial, sweets)).toEqual({ found: sweets.kinds.length - 1, total: sweets.kinds.length, complete: false, claimed: false });
    expect(claimPage(partial, EMPTY_WALLET, 'sweet')).toBeNull();
    const full = findKinds(partial, sweets.kinds);
    expect(pagesToClaim(full).map((p) => p.id)).toEqual(['sweet']);
    const claimed = claimPage(full, EMPTY_WALLET, 'sweet')!;
    expect(claimed.reward).toEqual(ECONOMY.album.foodPage);
    expect(claimed.wallet.coins).toBe(ECONOMY.album.foodPage.amount);
    expect(claimPage(claimed.album, claimed.wallet, 'sweet')).toBeNull();
    expect(pagesToClaim(claimed.album)).toEqual([]);
  });

  it("gives theme pages a booster only once it is unlocked by the theme's level", () => {
    for (const page of ALBUM_PAGES.filter((p) => p.kind === 'theme')) {
      const reward = pageReward(page);
      if (reward.kind !== 'booster') continue;
      const themeLevel = levels.findIndex((l) => l.theme === page.id) + 1;
      expect(ECONOMY.boosters[reward.booster].unlockLevel, page.id).toBeLessThanOrEqual(themeLevel);
    }
  });

  it('can be completed by playing: every kind appears in some level', () => {
    const seen = new Set(levels.flatMap(kindsOfLevel));
    for (const kind of ITEM_KINDS) expect(seen.has(kind.id), kind.id).toBe(true);
  });

  it('has its review document up to date (node tools/docs/buku-nenek.mjs)', () => {
    expect(readFileSync('docs/buku-nenek.md', 'utf8')).toBe(reviewDocument());
  });
});
