/**
 * Presentation helpers for `<LocationPage />`: the opening-hours table and the special-hours list.
 * Pure, so the day compression and the "closed" rule are asserted without rendering a component.
 * `Intl` does the locale work (day names, times, dates); the only logic here is grouping.
 */

const WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** Intl pads with a narrow no-break space (U+202F) before a.m./p.m.; a plain space copies and wraps better. */
const tidy = (text: string) => text.replace(/[  ]/g, ' ');

/** The localised name of a weekday, from a reference week (2024-01-01 was a Monday). */
function dayName(day: (typeof WEEK)[number], locale: string | undefined): string {
  const index = WEEK.indexOf(day);
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1 + index)),
  );
}

/** `09:00` → `9:00 a.m.` in the locale. Anything that isn't `HH:MM` is returned as written. */
export function formatTime(hhmm: string, locale: string | undefined): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  return tidy(
    new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 1, Number(m[1]), Number(m[2]))),
    ),
  );
}

/**
 * A set of weekdays as the shortest honest phrase: three or more in a row become a range
 * (`Monday – Friday`), the rest are listed (`Saturday and Sunday`). Always in week order, whatever
 * order they were authored in, and unknown names are ignored.
 */
export function formatDays(days: readonly string[], locale: string | undefined): string {
  const present = WEEK.filter((d) => days.includes(d));
  if (present.length === 0) return '';
  const runs: (typeof WEEK)[number][][] = [];
  for (const day of present) {
    const last = runs[runs.length - 1];
    if (last && WEEK.indexOf(last[last.length - 1]!) === WEEK.indexOf(day) - 1) last.push(day);
    else runs.push([day]);
  }
  const phrases = runs.flatMap((run) =>
    run.length >= 3
      ? [`${dayName(run[0]!, locale)} – ${dayName(run[run.length - 1]!, locale)}`]
      : run.map((d) => dayName(d, locale)),
  );
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(phrases);
}

export interface HoursRow {
  days: string;
  hours: string;
}

/** One row per recurring-hours entry. */
export function hoursRows(
  hours: readonly { dayOfWeek: readonly string[]; opens: string; closes: string }[],
  locale: string | undefined,
): HoursRow[] {
  return hours
    .map((h) => ({
      days: formatDays(h.dayOfWeek, locale),
      hours: `${formatTime(h.opens, locale)} – ${formatTime(h.closes, locale)}`,
    }))
    .filter((row) => row.days);
}

export interface SpecialRow {
  dates: string;
  hours: string;
}

const formatDate = (iso: string, locale: string | undefined) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : tidy(new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date));
};

/**
 * One row per dated deviation. An entry with no `opens`/`closes` is a full closure, said as such
 * rather than shown as an empty time.
 */
export function specialRows(
  special: readonly {
    validFrom: string;
    validThrough?: string | undefined;
    opens?: string | undefined;
    closes?: string | undefined;
  }[],
  locale: string | undefined,
  closed = 'Closed',
): SpecialRow[] {
  return special.map((s) => ({
    dates:
      s.validThrough && s.validThrough !== s.validFrom
        ? `${formatDate(s.validFrom, locale)} – ${formatDate(s.validThrough, locale)}`
        : formatDate(s.validFrom, locale),
    hours:
      s.opens && s.closes
        ? `${formatTime(s.opens, locale)} – ${formatTime(s.closes, locale)}`
        : closed,
  }));
}

/** `1234.5` + `CAD` → `$1,234.50`; a code `Intl` rejects falls back to `1234.5 XYZ`. */
export function formatPrice(
  price: string | number,
  currency: string | undefined,
  locale: string | undefined,
): string {
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n)) return currency ? `${price} ${currency}` : String(price);
  if (!currency) return new Intl.NumberFormat(locale).format(n);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}
