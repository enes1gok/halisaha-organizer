import type { ErrorTranslationKey } from './errorTranslationKeys';
import { trErrors } from './locales/tr/errors';

export type ErrorLocale = 'tr';

const catalogs: Record<ErrorLocale, Record<ErrorTranslationKey, string>> = {
  tr: trErrors,
};

/** Replace `{name}` placeholders in the template string. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v !== undefined ? String(v) : `{${name}}`;
  });
}

export function translateError(
  key: ErrorTranslationKey,
  locale: ErrorLocale = 'tr',
  params?: Record<string, string | number>,
): string {
  const raw = catalogs[locale][key];
  return interpolate(raw, params);
}
