import type { Localizable } from '../types.js';

/**
 * Resolve a Localizable value to a string for the given locale.
 * If the value is a plain string, it is returned as-is (treated as defaultLocale).
 * If it is a locale map, the best match is returned.
 */
export function t(
  value: Localizable | undefined,
  locale: string,
  defaultLocale: string,
): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value[defaultLocale] ?? '';
}
