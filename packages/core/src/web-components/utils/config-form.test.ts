import { describe, expect, it } from 'vite-plus/test';
import { docPathOf, messageAt, parseKeyName, renumber } from './config-form.ts';

const keys =
  (table: Record<string, string>) =>
  (name: string): string =>
    table[name] ?? '';

describe('docPathOf', () => {
  it('is the name itself for a plain control', () => {
    expect(docPathOf('organization.email', keys({}))).toBe('organization.email');
  });

  it('drops the marker a control name carries', () => {
    expect(docPathOf('site.x.enabled$bool', keys({}))).toBe('site.x.enabled');
    expect(docPathOf('site.x.ratio$num', keys({}))).toBe('site.x.ratio');
    expect(docPathOf('organization.sameAs$lines', keys({}))).toBe('organization.sameAs');
    expect(docPathOf('organization.name$loc.1.value', keys({}))).toBe('organization.name');
  });

  it('turns a row index into the key its key control holds', () => {
    const keyOf = keys({ 'organization.services$map.0.$key': 'roof' });
    expect(docPathOf('organization.services$map.0.price$num', keyOf)).toBe(
      'organization.services.roof.price',
    );
    expect(docPathOf('organization.services$map.0.name$loc.0.value', keyOf)).toBe(
      'organization.services.roof.name',
    );
  });

  it('has no path for a row that has no key yet', () => {
    expect(docPathOf('organization.services$map.2.name', keys({}))).toBeUndefined();
    expect(
      docPathOf(
        'organization.services$map.2.name',
        keys({ 'organization.services$map.2.$key': '  ' }),
      ),
    ).toBeUndefined();
  });

  it('resolves a nested map through both keys', () => {
    const keyOf = keys({ 'a$map.0.$key': 'outer', 'a$map.0.inner$map.1.$key': 'x' });
    expect(docPathOf('a$map.0.inner$map.1.n$num', keyOf)).toBe('a.outer.inner.x.n');
  });
});

describe('messageAt', () => {
  const issues = [
    { path: 'organization.name.en', message: 'Too short.' },
    { path: 'organization.email', message: 'Must be an email address.' },
  ];

  it('finds an issue at the path, or inside it', () => {
    expect(messageAt(issues, 'organization.email')).toBe('Must be an email address.');
    expect(messageAt(issues, 'organization.name')).toBe('Too short.');
  });

  it('is empty for a path with no issue, and does not match a sibling that shares a prefix', () => {
    expect(messageAt(issues, 'organization.phone')).toBe('');
    expect(messageAt(issues, 'organization.emailAddress')).toBe('');
    expect(messageAt(issues, 'organization.ema')).toBe('');
  });
});

describe('renumber', () => {
  it('moves a name to the next row', () => {
    expect(
      renumber('organization.services$map.0.name', 'organization.services', 0, 1, 'name'),
    ).toBe('organization.services$map.1.name');
    expect(
      renumber(
        'organization.services$map.0.name$loc.0.code',
        'organization.services',
        0,
        1,
        'name',
      ),
    ).toBe('organization.services$map.1.name$loc.0.code');
  });

  it("changes only this map's index and leaves a nested map's alone", () => {
    expect(renumber('a$map.0.inner$map.0.n', 'a', 0, 1, 'name')).toBe('a$map.1.inner$map.0.n');
  });

  it('does not touch a different map that shares the row number', () => {
    expect(renumber('b$map.0.n', 'a', 0, 1, 'name')).toBe('b$map.0.n');
  });

  it('moves the ids derived from those names, and the key control id', () => {
    expect(
      renumber('f-organization-services-map-0-name-help', 'organization.services', 0, 1, 'id'),
    ).toBe('f-organization-services-map-1-name-help');
    expect(renumber('f-organization-services-0-key', 'organization.services', 0, 1, 'id')).toBe(
      'f-organization-services-1-key',
    );
  });

  it('does not mistake row 1 for row 10', () => {
    expect(renumber('x$map.10.n', 'x', 1, 2, 'name')).toBe('x$map.10.n');
    expect(renumber('f-x-map-10-n', 'x', 1, 2, 'id')).toBe('f-x-map-10-n');
  });
});

describe('parseKeyName', () => {
  it('reads the map and row off a key control name', () => {
    expect(parseKeyName('organization.services$map.2.$key')).toEqual({
      base: 'organization.services',
      index: 2,
    });
    expect(parseKeyName('a$map.0.inner$map.3.$key')).toEqual({ base: 'a$map.0.inner', index: 3 });
  });

  it('is undefined for anything else', () => {
    expect(parseKeyName('organization.email')).toBeUndefined();
    expect(parseKeyName('a$map.0.name')).toBeUndefined();
  });
});
