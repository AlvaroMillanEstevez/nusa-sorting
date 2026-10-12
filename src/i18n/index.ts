import { en, type MessageKey } from './locales/en';
import { id } from './locales/id';

export type { MessageKey };

export const SUPPORTED_LOCALES = ['en', 'id'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, id };

let currentLocale: Locale = DEFAULT_LOCALE;

/**
 * The game's language from the browser's (e.g. navigator.languages): only its main language counts, so a phone in
 * Spanish that also lists Indonesian further down plays in English. English unless the main language is supported.
 */
export function resolveLocale(languages: readonly string[]): Locale {
  const base = languages[0]?.toLowerCase().split('-')[0];
  return SUPPORTED_LOCALES.find((locale) => locale === base) ?? DEFAULT_LOCALE;
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

/** A text in a given locale, whatever the current one (e.g. a name shown in both languages). */
export function textIn(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}
