import { describe, expect, it } from 'vitest';
import { catalog, LANGUAGES, setLanguage, t } from '../src/i18n';

describe('i18n', () => {
  it('defines every key with a non-empty text in every language', () => {
    const keys = Object.keys(catalog('en')).sort();
    for (const language of LANGUAGES) {
      const messages = catalog(language);
      expect(Object.keys(messages).sort()).toEqual(keys);
      for (const key of keys) expect(messages[key as keyof typeof messages].trim()).not.toBe('');
    }
  });

  it('uses the same placeholders in every language', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    const en = catalog('en');
    for (const language of LANGUAGES) {
      const messages = catalog(language);
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(placeholders(messages[key]), `${language}:${key}`).toEqual(placeholders(en[key]));
      }
    }
  });

  it('switches language and fills in parameters', () => {
    setLanguage('de');
    expect(t('hud.goal', { amount: 5 })).toBe('Ziel: 5');
    setLanguage('ru');
    expect(t('port.onBoard', { count: 3 })).toBe('На борту: 3');
    setLanguage('en');
    expect(t('trade.noGold')).toBe('Not enough gold!');
  });
});
