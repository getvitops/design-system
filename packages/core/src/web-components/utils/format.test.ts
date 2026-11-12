import { describe, expect, it } from 'vite-plus/test';
import {
  formatValue,
  isCurrencyCode,
  isFormatType,
  nextRefreshDelay,
  parseInstant,
  parseNumber,
  relativeParts,
} from './format.ts';

const NOW = Date.parse('2026-11-11T12:00:00Z');
const ago = (ms: number) => NOW - ms;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('parsing', () => {
  it('reads an ISO instant, and refuses anything that is not a date', () => {
    expect(parseInstant('2026-11-11T12:00:00Z')?.getTime()).toBe(NOW);
    expect(parseInstant('not a date')).toBeNull();
    expect(parseInstant('')).toBeNull();
    expect(parseInstant(null)).toBeNull();
  });
  it('reads a finite number only', () => {
    expect(parseNumber('1234.5')).toBe(1234.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('Infinity')).toBeNull();
  });
  it('knows the format types and currency codes', () => {
    expect(isFormatType('relative')).toBe(true);
    expect(isFormatType('bogus')).toBe(false);
    expect(isCurrencyCode('CAD')).toBe(true);
    expect(isCurrencyCode('dollars')).toBe(false);
  });
});

describe('relativeParts', () => {
  it.each([
    [30 * 1000, 0, 'minute'],
    [5 * MIN, 5, 'minute'],
    [3 * HOUR + 59 * MIN, 3, 'hour'],
    [2 * DAY, 2, 'day'],
    [8 * DAY, 1, 'week'],
    [75 * DAY, 2, 'month'],
    [800 * DAY, 2, 'year'],
  ])('%i ms ago is %i %s', (age, value, unit) => {
    const parts = relativeParts(NOW, ago(age));
    expect(parts.unit).toBe(unit);
    expect(Math.abs(parts.value)).toBe(value);
    expect(parts.value <= 0).toBe(true);
  });
  it('is positive for the future, rounding toward zero', () => {
    expect(relativeParts(NOW, NOW + 90 * MIN)).toEqual({ value: 1, unit: 'hour' });
  });
});

describe('nextRefreshDelay', () => {
  it('waits for the minute boundary under an hour, never under a second', () => {
    // 5m30s old: the text flips to "6 minutes ago" in 30s.
    expect(nextRefreshDelay(NOW, ago(5 * MIN + 30_000))).toBe(30_000 + 50);
    expect(nextRefreshDelay(NOW, ago(5 * MIN))).toBeGreaterThanOrEqual(MIN);
    expect(nextRefreshDelay(NOW, ago(5 * MIN + 59_999))).toBeGreaterThanOrEqual(1000);
  });
  it('waits for the hour boundary beyond an hour', () => {
    expect(nextRefreshDelay(NOW, ago(3 * HOUR + 59 * MIN))).toBe(HOUR - 59 * MIN + 50);
  });
  it('counts down for a future time', () => {
    expect(nextRefreshDelay(NOW, NOW + 5 * MIN + 10_000)).toBe(10_000 + 50);
  });
});

describe('formatValue', () => {
  const d = (iso: string) => new Date(iso);
  it('relative: natural English, "auto" for the nearest units', () => {
    expect(
      formatValue('relative', { date: d('2026-11-11T11:55:00Z') }, NOW, { locale: 'en' }),
    ).toBe('5 minutes ago');
    expect(
      formatValue('relative', { date: d('2026-11-10T12:00:00Z') }, NOW, { locale: 'en' }),
    ).toBe('yesterday');
    expect(
      formatValue('relative', { date: d('2026-11-11T12:30:00Z') }, NOW, { locale: 'en' }),
    ).toBe('in 30 minutes');
  });
  it('relative: follows the locale', () => {
    expect(
      formatValue('relative', { date: d('2026-11-10T12:00:00Z') }, NOW, { locale: 'fr' }),
    ).toBe('hier');
  });
  it('date and time styles', () => {
    expect(
      formatValue('date', { date: d('2026-11-03T12:00:00Z') }, NOW, {
        locale: 'en',
        dateStyle: 'long',
      }),
    ).toBe('November 3, 2026');
    expect(
      formatValue('date', { date: d('2026-11-03T12:00:00Z') }, NOW, { locale: 'en-CA' }),
    ).toMatch(/2026/);
  });
  it('numbers, percent and currency', () => {
    expect(formatValue('number', { number: 1234567.5 }, NOW, { locale: 'en' })).toBe('1,234,567.5');
    expect(formatValue('percent', { number: 0.256 }, NOW, { locale: 'en' })).toBe('26%');
    expect(
      formatValue('currency', { number: 1234.5 }, NOW, { locale: 'en-CA', currency: 'CAD' }),
    ).toBe('$1,234.50');
    expect(formatValue('number', { number: 1_500_000 }, NOW, { locale: 'en', compact: true })).toBe(
      '1.5M',
    );
  });
  it('is null when it cannot format, so the fallback is left alone', () => {
    expect(formatValue('relative', { date: null }, NOW)).toBeNull();
    expect(formatValue('number', { number: null }, NOW)).toBeNull();
    expect(formatValue('currency', { number: 5 }, NOW)).toBeNull();
    expect(formatValue('currency', { number: 5 }, NOW, { currency: 'ZZZZ' })).toBeNull();
    expect(
      formatValue('date', { date: new Date('2026-01-01') }, NOW, { locale: 'not a locale!!' }),
    ).toBeNull();
  });
});
