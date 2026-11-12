/**
 * Pure decisions behind `<wc-format>`: parse the machine value, pick a relative unit, say when to
 * re-render, format. `Intl` does the locale work; nothing here reads the clock or the DOM, so `now`
 * is a parameter and every case is deterministic.
 */

export type FormatType =
  | 'relative'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'percent'
  | 'currency';

export const FORMAT_TYPES: readonly FormatType[] = [
  'relative',
  'date',
  'datetime',
  'time',
  'number',
  'percent',
  'currency',
];

export const isFormatType = (value: string | null | undefined): value is FormatType =>
  (FORMAT_TYPES as readonly string[]).includes(value ?? '');

/** The machine value of a `<time datetime>`, or null when it isn't a date. */
export function parseInstant(datetime: string | null | undefined): Date | null {
  if (!datetime) return null;
  const date = new Date(datetime);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The machine value of a `<data value>`, or null when it isn't a finite number. */
export function parseNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type RelativeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `then` relative to `now`, as the largest unit that still reads naturally, rounded toward zero. */
export function relativeParts(now: number, then: number): { value: number; unit: RelativeUnit } {
  const diff = then - now;
  const abs = Math.abs(diff);
  const sign = Math.sign(diff) || 1;
  const toward = (n: number) => sign * Math.floor(n);
  // Minutes is the floor: second-level text would need a timer a second to stay true.
  if (abs < HOUR) return { value: toward(abs / MINUTE), unit: 'minute' };
  if (abs < DAY) return { value: toward(abs / HOUR), unit: 'hour' };
  if (abs < 7 * DAY) return { value: toward(abs / DAY), unit: 'day' };
  if (abs < 30 * DAY) return { value: toward(abs / (7 * DAY)), unit: 'week' };
  if (abs < 365 * DAY) return { value: toward(abs / (30 * DAY)), unit: 'month' };
  return { value: toward(abs / (365 * DAY)), unit: 'year' };
}

/**
 * Milliseconds until the text would change, so a timer fires when it matters rather than on a fixed
 * poll. The unit's boundary, not a guess: a timestamp 3h59m old stays "3 hours ago" for a minute,
 * not for an hour. Days and beyond re-check hourly, which is as precise as anyone can see.
 */
export function nextRefreshDelay(now: number, then: number): number {
  const abs = Math.abs(then - now);
  const step = abs < HOUR ? MINUTE : abs < DAY ? HOUR : HOUR;
  // Past a timestamp text counts up and a future one counts down, so the boundary differs by sign.
  const toNext = then <= now ? step - (abs % step) : abs % step || step;
  return Math.max(1000, toNext + 50);
}

export interface FormatOptions {
  locale?: string | undefined;
  dateStyle?: 'full' | 'long' | 'medium' | 'short' | undefined;
  timeStyle?: 'full' | 'long' | 'medium' | 'short' | undefined;
  currency?: string | undefined;
  compact?: boolean | undefined;
}

/** Whether `value` is a currency code `Intl` will accept (three letters). */
export const isCurrencyCode = (value: string | undefined): value is string =>
  !!value && /^[A-Za-z]{3}$/.test(value);

/**
 * The text for a parsed value, or null when it can't be formatted (a currency with no code, a
 * locale `Intl` rejects). Null means "leave the fallback as it is".
 */
export function formatValue(
  type: FormatType,
  input: { date?: Date | null; number?: number | null },
  now: number,
  opts: FormatOptions = {},
): string | null {
  try {
    if (type === 'relative') {
      if (!input.date) return null;
      const { value, unit } = relativeParts(now, input.date.getTime());
      return new Intl.RelativeTimeFormat(opts.locale, { numeric: 'auto' }).format(value, unit);
    }
    if (type === 'date' || type === 'datetime' || type === 'time') {
      if (!input.date) return null;
      const style: Intl.DateTimeFormatOptions =
        type === 'date'
          ? { dateStyle: opts.dateStyle ?? 'medium' }
          : type === 'time'
            ? { timeStyle: opts.timeStyle ?? 'short' }
            : { dateStyle: opts.dateStyle ?? 'medium', timeStyle: opts.timeStyle ?? 'short' };
      return new Intl.DateTimeFormat(opts.locale, style).format(input.date);
    }
    if (input.number == null) return null;
    if (type === 'currency') {
      if (!isCurrencyCode(opts.currency)) return null;
      return new Intl.NumberFormat(opts.locale, {
        style: 'currency',
        currency: opts.currency.toUpperCase(),
        ...(opts.compact ? { notation: 'compact' as const } : {}),
      }).format(input.number);
    }
    return new Intl.NumberFormat(opts.locale, {
      ...(type === 'percent' ? { style: 'percent' as const } : {}),
      ...(opts.compact ? { notation: 'compact' as const } : {}),
    }).format(input.number);
  } catch {
    return null;
  }
}
