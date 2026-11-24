import { describe, expect, it } from 'vite-plus/test';
import { fieldName, resolveFields, safeAction, safeNext, slugName } from './form.ts';

describe('field names', () => {
  it('derives a safe name from the label', () => {
    expect(slugName('Your full name!')).toBe('your_full_name');
    expect(slugName('Café ☕')).toBe('cafe');
  });
  it('keeps clear of every name the conversion route treats specially', () => {
    const taken = new Set<string>();
    expect(fieldName('phone', 'Phone', 'tel', taken)).toBe('tel');
    expect(fieldName('event', 'Event', 'text', taken)).toBe('event_field');
    expect(fieldName('website', 'Website', 'text', taken)).toBe('website_field');
    expect(fieldName('cf-turnstile-response', 'x', 'text', taken)).toBe('cf_turnstile_response');
  });
  it('de-duplicates and never starts with a digit', () => {
    const taken = new Set<string>();
    expect(fieldName('', 'Name', 'text', taken)).toBe('name');
    expect(fieldName('', 'Name', 'text', taken)).toBe('name_2');
    expect(fieldName('', '3 guests', 'text', new Set())).toBe('f_3_guests');
  });
});

describe('resolveFields', () => {
  it('drops unlabeled rows, coerces unknown kinds, and turns an empty select into text', () => {
    const f = resolveFields([
      { label: '' },
      { label: 'A', type: 'bogus' },
      { label: 'B', type: 'select', options: '' },
      { label: 'C', type: 'select', options: 'x\n y \n' },
    ]);
    expect(f.map((x) => [x.name, x.type])).toEqual([
      ['a', 'text'],
      ['b', 'text'],
      ['c', 'select'],
    ]);
    expect(f[2]!.options).toEqual(['x', 'y']);
  });
  it('caps the number of fields', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ label: `F${i}` }));
    expect(resolveFields(many)).toHaveLength(20);
  });
});

describe('same-site paths only', () => {
  it.each(['//evil.example', 'https://evil.example', '/a\\b', '/a?x=1', '/a#f', 'contact', ''])(
    'refuses %j',
    (v) => expect(safeNext(v)).toBeNull(),
  );
  it('accepts a plain path and defaults the action', () => {
    expect(safeNext('/contact')).toBe('/contact');
    expect(safeAction(undefined)).toBe('/api/track');
    expect(safeAction('/api/enquiry')).toBe('/api/enquiry');
  });
});
