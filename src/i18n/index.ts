import { en, type MessageKey } from './locales/en';
import { id } from './locales/id';

export type { MessageKey };

export const SUPPORTED_LOCALES = ['en', 'id'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, id };

let currentLocale: Locale = DEFAULT_LOCALE;

/** Picks the first supported locale from a browser-style language list (e.g. navigator.languages). */
export function resolveLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    const match = SUPPORTED_LOCALES.find((locale) => locale === base);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export type MessageParams = Readonly<Record<string, string | number>>;

/** Translated text for `key`, replacing `{name}` placeholders with `params.name`. */
export function t(key: MessageKey, params?: MessageParams): string {
  const text = catalogs[currentLocale][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
