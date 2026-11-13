import { describe, expect, test } from 'vite-plus/test';
import {
  boolName,
  formToConfig,
  linesName,
  locName,
  mapFieldName,
  mapKeyName,
  numName,
  prune,
  scalarName,
} from './codec.ts';

const form = (entries: Record<string, string>) => formToConfig(Object.entries(entries));

describe('formToConfig', () => {
  test('nests dotted field names', () => {
    expect(
      form({
        'organization.email': 'hello@acme.ca',
        'organization.address.addressLocality': 'Ottawa',
      }),
    ).toEqual({
      organization: { email: 'hello@acme.ca', address: { addressLocality: 'Ottawa' } },
    });
  });

  test('drops blank fields rather than writing empty strings', () => {
    // An address of five empty strings would fail the schema's `required`;
    // no address at all is valid. Clearing a field has to produce the latter.
    expect(
      form({
        'organization.email': '  ',
        'organization.address.streetAddress': '',
        'organization.address.addressLocality': '',
      }),
    ).toEqual({});
  });

  test('trims what it keeps', () => {
    expect(form({ 'organization.legalName': '  Acme Widgets Inc.  ' })).toEqual({
      organization: { legalName: 'Acme Widgets Inc.' },
    });
  });

  test('turns locale rows into a per-locale map', () => {
    expect(
      form({
        'organization.name': 'Acme',
        'organization.name$loc.0.code': 'en',
        'organization.name$loc.0.value': 'Acme',
        'organization.name$loc.1.code': 'fr',
        'organization.name$loc.1.value': 'Acmé',
      }),
    ).toEqual({ organization: { name: { en: 'Acme', fr: 'Acmé' } } });
  });

  test('keeps the single value when no locale row is filled in', () => {
    expect(
      form({
        'organization.name': 'Acme',
        'organization.name$loc.0.code': '',
        'organization.name$loc.0.value': '',
      }),
    ).toEqual({ organization: { name: 'Acme' } });
  });

  test('ignores a half-filled locale row', () => {
    expect(
      form({
        'organization.name': 'Acme',
        'organization.name$loc.0.code': 'fr',
        'organization.name$loc.0.value': '',
      }),
    ).toEqual({ organization: { name: 'Acme' } });
  });

  test('splits a textarea into an array, one item per line', () => {
    expect(
      form({ 'organization.sameAs$lines': 'https://acme.ca\n\n  https://x.com/acme  \n' }),
    ).toEqual({ organization: { sameAs: ['https://acme.ca', 'https://x.com/acme'] } });
  });

  test('keys map rows by their $key, not by their row index', () => {
    expect(
      form({
        'organization.services$map.0.$key': 'roof-repair',
        'organization.services$map.0.name': 'Roof repair',
        'organization.services$map.3.$key': 'gutters',
        'organization.services$map.3.name': 'Gutter cleaning',
      }),
    ).toEqual({
      organization: {
        services: {
          'roof-repair': { name: 'Roof repair' },
          gutters: { name: 'Gutter cleaning' },
        },
      },
    });
  });

  test('nests dotted sub-paths inside a map row', () => {
    expect(
      form({
        'organization.locations$map.0.$key': 'ottawa',
        'organization.locations$map.0.name': 'Acme — Ottawa',
        'organization.locations$map.0.address.addressLocality': 'Ottawa',
        'organization.locations$map.0.address.addressRegion': 'ON',
      }),
    ).toEqual({
      organization: {
        locations: {
          ottawa: {
            name: 'Acme — Ottawa',
            address: { addressLocality: 'Ottawa', addressRegion: 'ON' },
          },
        },
      },
    });
  });

  test('drops the blank trailing row, and a row that is only a key', () => {
    expect(
      form({
        'organization.services$map.0.$key': 'roof-repair',
        'organization.services$map.0.name': 'Roof repair',
        'organization.services$map.1.$key': '',
        'organization.services$map.1.name': '',
        'organization.services$map.2.$key': 'typed-then-thought-better',
        'organization.services$map.2.name': '',
      }),
    ).toEqual({ organization: { services: { 'roof-repair': { name: 'Roof repair' } } } });
  });

  test('clearing a key deletes that row', () => {
    expect(
      form({
        'organization.services$map.0.$key': '',
        'organization.services$map.0.name': 'Roof repair',
      }),
    ).toEqual({});
  });

  test("ignores Astro's own form controls", () => {
    expect(form({ _astroAction: '/x', intent: 'save', 'organization.phone': '613' })).toEqual({
      organization: { phone: '613' },
    });
  });

  test('coerces a $bool field to a real JSON boolean', () => {
    expect(form({ 'site.ads.google.enabled$bool': 'true' })).toEqual({
      site: { ads: { google: { enabled: true } } },
    });
  });

  test("a $bool field's hidden false sibling wins when the checkbox is unchecked", () => {
    // CheckboxField.astro renders a hidden "false" input before the checkbox
    // itself; a native unchecked checkbox is omitted from the submission
    // entirely, so only the hidden sibling's entry reaches formToConfig.
    expect(formToConfig([['site.ads.google.enabled$bool', 'false']])).toEqual({
      site: { ads: { google: { enabled: false } } },
    });
  });

  test("a checked $bool checkbox's own entry wins over its hidden sibling", () => {
    // Both entries are present, in DOM order (hidden first) — the checkbox's
    // own "true" must be the one that survives.
    expect(
      formToConfig([
        ['site.ads.google.enabled$bool', 'false'],
        ['site.ads.google.enabled$bool', 'true'],
      ]),
    ).toEqual({ site: { ads: { google: { enabled: true } } } });
  });

  test('coerces a $num field to a real JSON number, dropping a non-numeric one', () => {
    expect(
      form({
        'site.experiments$map.0.$key': 'hero-copy',
        'site.experiments$map.0.splitRatio$num': '0.25',
        'site.experiments$map.0.cookieMaxAge$num': 'not-a-number',
      }),
    ).toEqual({ site: { experiments: { 'hero-copy': { splitRatio: 0.25 } } } });
  });

  test('$bool composes with $map — a checkbox inside a repeatable row', () => {
    expect(
      form({
        'site.experiments$map.0.$key': 'hero-copy',
        'site.experiments$map.0.enabled$bool': 'true',
      }),
    ).toEqual({ site: { experiments: { 'hero-copy': { enabled: true } } } });
  });
});

describe('prune', () => {
  test('removes empty strings, arrays and objects, depth first', () => {
    expect(prune({ a: { b: { c: '' }, d: [] }, e: 'keep' })).toEqual({ e: 'keep' });
  });

  test("keeps falsy values that aren't empty", () => {
    expect(prune({ a: 0, b: false, c: null })).toEqual({ a: 0, b: false, c: null });
  });
});

describe('form names', () => {
  test('every builder produces a name formToConfig parses back to the same path', () => {
    const round = (name: string, value: string) => form({ [name]: value });
    expect(round(scalarName('organization.email'), 'a@b.ca')).toEqual({
      organization: { email: 'a@b.ca' },
    });
    expect(round(boolName('site.x.enabled'), 'true')).toEqual({ site: { x: { enabled: true } } });
    expect(round(numName('site.x.ratio'), '0.5')).toEqual({ site: { x: { ratio: 0.5 } } });
    expect(round(linesName('organization.sameAs'), 'a\nb')).toEqual({
      organization: { sameAs: ['a', 'b'] },
    });
    expect(
      form({
        [locName('organization.name', 0, 'code')]: 'en',
        [locName('organization.name', 0, 'value')]: 'Acme',
      }),
    ).toEqual({ organization: { name: { en: 'Acme' } } });
    expect(
      form({
        [mapKeyName('organization.services', 0)]: 'roof',
        [mapFieldName('organization.services', 0, 'name')]: 'Roof',
      }),
    ).toEqual({ organization: { services: { roof: { name: 'Roof' } } } });
  });

  test('an empty $num field writes nothing, not zero', () => {
    expect(form({ 'site.x.ratio$num': '' })).toEqual({});
  });

  test('refuses a prototype-polluting path', () => {
    expect(form({ '__proto__.polluted': 'yes', 'a.constructor.b': 'yes' })).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
