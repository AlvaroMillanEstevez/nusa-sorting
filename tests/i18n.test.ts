import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/i18n/locales/en';
import { id } from '../src/i18n/locales/id';
import { DEFAULT_LOCALE, resolveLocale, setLocale, t } from '../src/i18n';

describe('resolveLocale', () => {
  it('matches base language from region tags', () => {
    expect(resolveLocale(['id-ID'])).toBe('id');
    expect(resolveLocale(['en-GB'])).toBe('en');
  });

  it('follows only the main language: Indonesian further down the list does not count', () => {
    expect(resolveLocale(['id', 'en'])).toBe('id');
    expect(resolveLocale(['es-ES', 'id', 'en'])).toBe('en');
    expect(resolveLocale(['fr-FR', 'id'])).toBe('en');
  });

  it('falls back to the default locale', () => {
    expect(resolveLocale(['es-ES'])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe('t', () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it('returns the game title in every locale', () => {
    // The same name in both languages: Nusa, the brand, and the game's name.
    for (const locale of ['en', 'id'] as const) {
      setLocale(locale);
      expect(t('game.title')).toBe('Nusa: Warung Sort');
      expect(`${t('game.brand')}: ${t('game.name')}`).toBe(t('game.title'));
    }
  });

  it('fills in parameters and leaves unknown placeholders alone', () => {
    setLocale('en');
    expect(t('result.best', { score: '1,250' })).toBe('Best: 1,250');
    expect(t('shelf.locked', { n: 2 })).toBe('2 more');
    expect(t('shelf.locked')).toBe('{n} more');
    setLocale('id');
    expect(t('result.best', { score: '1.250' })).toBe('Terbaik: 1.250');
  });

  it('uses the same placeholders in every catalog', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(id[key])).toEqual(placeholders(en[key]));
    }
  });

  it('has the same keys in every catalog', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });
});
