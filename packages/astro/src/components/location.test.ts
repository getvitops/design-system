import { describe, expect, it } from 'vite-plus/test';
import { formatDays, formatPrice, formatTime, hoursRows, specialRows } from './location.ts';

describe('formatTime', () => {
  it('formats HH:MM in the locale, with an ordinary space', () => {
    expect(formatTime('09:00', 'en')).toBe('9:00 AM');
    expect(formatTime('17:30', 'en')).toBe('5:30 PM');
    expect(formatTime('17:30', 'fr-CA')).toMatch(/^17 h 30$/);
  });
  it('returns anything that is not HH:MM as written', () => {
    expect(formatTime('noon', 'en')).toBe('noon');
  });
});

describe('formatDays', () => {
  it('turns three or more consecutive days into a range', () => {
    expect(formatDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'en')).toBe(
      'Monday – Friday',
    );
  });
  it('lists two days, and a weekend, in words', () => {
    expect(formatDays(['Saturday', 'Sunday'], 'en')).toBe('Saturday and Sunday');
  });
  it('mixes a range with a separate day, in week order whatever the input order', () => {
    expect(formatDays(['Saturday', 'Wednesday', 'Monday', 'Tuesday'], 'en')).toBe(
      'Monday – Wednesday and Saturday',
    );
  });
  it('localises the day names', () => {
    expect(formatDays(['Monday', 'Tuesday', 'Wednesday'], 'fr')).toBe('lundi – mercredi');
  });
  it('ignores unknown names and is empty for none', () => {
    expect(formatDays(['Funday'], 'en')).toBe('');
    expect(formatDays([], 'en')).toBe('');
    expect(formatDays(['Monday', 'Funday'], 'en')).toBe('Monday');
  });
});

describe('hoursRows', () => {
  it('gives one row per entry and drops one with no valid day', () => {
    expect(
      hoursRows(
        [
          { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'], opens: '09:00', closes: '17:00' },
          { dayOfWeek: ['Saturday'], opens: '10:00', closes: '14:00' },
          { dayOfWeek: ['Someday'], opens: '10:00', closes: '14:00' },
        ],
        'en',
      ),
    ).toEqual([
      { days: 'Monday – Wednesday', hours: '9:00 AM – 5:00 PM' },
      { days: 'Saturday', hours: '10:00 AM – 2:00 PM' },
    ]);
  });
});

describe('specialRows', () => {
  it('says closed for a full closure and shows times for a changed day', () => {
    expect(
      specialRows(
        [
          { validFrom: '2026-12-25', validThrough: '2026-12-26' },
          { validFrom: '2026-12-31', opens: '09:00', closes: '13:00' },
        ],
        'en',
      ),
    ).toEqual([
      { dates: 'Dec 25, 2026 – Dec 26, 2026', hours: 'Closed' },
      { dates: 'Dec 31, 2026', hours: '9:00 AM – 1:00 PM' },
    ]);
  });
  it('treats a validThrough equal to validFrom as one day, and takes a localised closed word', () => {
    expect(
      specialRows([{ validFrom: '2026-07-01', validThrough: '2026-07-01' }], 'en', 'Fermé'),
    ).toEqual([{ dates: 'Jul 1, 2026', hours: 'Fermé' }]);
  });
  it('shows a date it cannot parse as written', () => {
    expect(specialRows([{ validFrom: 'soon' }], 'en')[0]?.dates).toBe('soon');
  });
});

describe('formatPrice', () => {
  it('formats a currency, and a bare number', () => {
    expect(formatPrice(1234.5, 'CAD', 'en-CA')).toBe('$1,234.50');
    expect(formatPrice('120.00', 'CAD', 'en-CA')).toBe('$120.00');
    expect(formatPrice(1500, undefined, 'en')).toBe('1,500');
  });
  it('keeps a price that is not a number, and a currency code Intl rejects', () => {
    expect(formatPrice('from 99', 'CAD', 'en')).toBe('from 99 CAD');
    expect(formatPrice(5, 'XX', 'en')).toBe('5 XX');
  });
});
