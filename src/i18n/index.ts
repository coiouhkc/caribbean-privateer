import { de } from './de';
import { en, type MessageKey } from './en';
import { ru } from './ru';

export type { MessageKey } from './en';

export const LANGUAGES = ['en', 'de', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];

const catalogs: Record<Language, Record<MessageKey, string>> = { en, de, ru };
const STORAGE_KEY = 'potc.language';
const listeners = new Set<(language: Language) => void>();

let current: Language = detectLanguage();

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

function detectLanguage(): Language {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, tests); fall through to the browser language.
  }
  const browser = globalThis.navigator?.language?.slice(0, 2).toLowerCase();
  return isLanguage(browser) ? browser : 'en';
}

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Remembering the language is a convenience only.
  }
  listeners.forEach((listener) => listener(language));
}

/** Subscribes to language changes; returns an unsubscribe function. */
export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function catalog(language: Language): Readonly<Record<MessageKey, string>> {
  return catalogs[language];
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = catalogs[current][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(current).format(value);
}
