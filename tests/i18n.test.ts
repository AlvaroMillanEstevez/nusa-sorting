import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/i18n/locales/en';
import { id } from '../src/i18n/locales/id';
import { DEFAULT_LOCALE, resolveLocale, setLocale, t } from '../src/i18n';

describe('resolveLocale', () => {
  it('matches base language from region tags', () => {
    expect(resolveLocale(['id-ID'])).toBe('id');
    expect(resolveLocale(['en-GB'])).toBe('en');
  });

  it('picks the first supported language in order', () => {
    expect(resolveLocale(['fr-FR', 'id', 'en'])).toBe('id');
  });

  it('falls back to the default locale', () => {
    expect(resolveLocale(['es-ES'])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE);
  });
});

describe('t', () => {
  afterEach(() => setLocale(DEFAULT_LOCALE));

  it('returns the game title in every locale', () => {
    setLocale('en');
    expect(t('game.title')).toBe('Nusa Sorting');
    setLocale('id');
    expect(t('game.title')).toBe('Nusa Sorting');
  });

  it('has the same keys in every catalog', () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });
});
