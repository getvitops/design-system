import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import { describeField, resolveProjection } from './describe.ts';
import {
  isKeyedMap,
  isLocalisable,
  isRequired,
  nodeAt,
  pickSchema,
  type JsonSchema,
} from './json-schema.ts';
import type { Projection } from './projections.ts';
import { stepStatus } from './status.ts';
import type { OnboardingStep } from './steps.ts';
import { unhandledKeywords, validateAgainstSchema, validateField } from './validate.ts';

/** A small schema with one of each shape the real one uses. */
const SCHEMA: JsonSchema = {
  type: 'object',
  required: ['organization'],
  additionalProperties: false,
  properties: {
    organization: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          description: 'Trading **name**.',
          anyOf: [
            { type: 'string' },
            {
              type: 'object',
              propertyNames: { type: 'string' },
              additionalProperties: { type: 'string' },
            },
          ],
        },
        email: { type: 'string', format: 'email' },
        foundingDate: { type: 'string', format: 'date' },
        description: { type: 'string', maxLength: 20 },
        sameAs: { type: 'array', items: { type: 'string', format: 'uri' } },
        address: {
          type: 'object',
          additionalProperties: false,
          required: ['addressLocality'],
          properties: { addressLocality: { type: 'string' }, postalCode: { type: 'string' } },
        },
        services: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            type: 'object',
            required: ['name'],
            additionalProperties: false,
            properties: { name: { type: 'string' }, price: { type: 'number', minimum: 0 } },
          },
        },
      },
    },
    site: {
      type: 'object',
      additionalProperties: false,
      properties: {
        level: { type: 'string', enum: ['none', 'A', 'AA', 'AAA'] },
        jurisdiction: { type: 'string', enum: ['ca', 'qc'] },
        enabled: { type: 'boolean' },
        variants: {
          type: 'array',
          prefixItems: [{ type: 'string' }, { type: 'string' }],
          items: false,
          minItems: 2,
          maxItems: 2,
        },
        themes: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            properties: {
              palette: {
                type: 'object',
                propertyNames: { type: 'string' },
                additionalProperties: {
                  anyOf: [
                    {
                      type: 'object',
                      properties: { seed: { type: 'string' }, anchors: { type: 'object' } },
                      required: ['seed'],
                    },
                    {
                      type: 'object',
                      properties: { tones: { type: 'object' } },
                      required: ['tones'],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('nodeAt', () => {
  it('walks properties, map values, and through a union', () => {
    expect(nodeAt(SCHEMA, 'organization.address.postalCode')?.type).toBe('string');
    expect(nodeAt(SCHEMA, 'organization.services.*.name')?.type).toBe('string');
    expect(nodeAt(SCHEMA, 'site.themes.default.palette.*.seed')?.type).toBe('string');
    expect(nodeAt(SCHEMA, 'organization.nothing')).toBeUndefined();
  });

  it('classifies the shapes forms care about', () => {
    expect(isLocalisable(nodeAt(SCHEMA, 'organization.name'))).toBe(true);
    expect(isKeyedMap(nodeAt(SCHEMA, 'organization.services'))).toBe(true);
    expect(isRequired(SCHEMA, 'organization.name')).toBe(true);
    expect(isRequired(SCHEMA, 'organization.email')).toBe(false);
  });
});

describe('validateAgainstSchema', () => {
  it('reports required, format and enum failures against document paths', () => {
    const issues = validateAgainstSchema(SCHEMA, {
      organization: { email: 'nope', foundingDate: '2020' },
      site: { level: 'AAAA' },
    });
    const byPath = Object.fromEntries(issues.map((i) => [i.path, i.message]));
    expect(byPath['organization.name']).toBe('Required.');
    expect(byPath['organization.email']).toBe('Must be an email address.');
    expect(byPath['organization.foundingDate']).toBe('Must be a date, as YYYY-MM-DD.');
    expect(byPath['site.level']).toMatch(/Must be one of/);
  });

  it('accepts a clean document', () => {
    expect(
      validateAgainstSchema(SCHEMA, {
        organization: { name: { en: 'Acme', fr: 'Acmé' }, email: 'a@b.ca' },
        site: { level: 'AA', variants: ['a', 'b'] },
      }),
    ).toEqual([]);
  });

  it('enforces tuples, length and item counts', () => {
    const at = (value: unknown, path: string) =>
      validateField(SCHEMA, path, value).map((i) => i.message);
    expect(at(['only-one'], 'site.variants')).toEqual(['Needs at least 2 items.']);
    expect(at(['a', 'b', 'c'], 'site.variants')).toEqual([
      'Allows at most 2 items.',
      'Not allowed here.',
    ]);
    expect(at('x'.repeat(21), 'organization.description')).toEqual([
      'Must be at most 20 characters.',
    ]);
    expect(at(-1, 'organization.services.*.price')).toEqual(['Must be at least 0.']);
  });

  it('says a format once, in words, and never shows a visitor a regular expression', () => {
    const email: JsonSchema = {
      type: 'string',
      format: 'email',
      pattern: "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@[a-z]+\\.[a-z]{2,}$",
    };
    // Fails both the format and the stricter library pattern: one message, the friendly one.
    expect(validateAgainstSchema(email, 'nope')).toEqual([
      { path: '', message: 'Must be an email address.' },
    ]);
    // Passes the loose format check but not the stricter pattern: still the friendly message.
    expect(validateAgainstSchema(email, 'a@b')[0]?.message).toBe('Must be an email address.');
    expect(validateAgainstSchema(email, 'ada@example.com')).toEqual([]);
    // A pattern with no format beside it gets a generic sentence, not the regex.
    expect(validateAgainstSchema({ type: 'string', pattern: '^[A-Z]{3}$' }, 'ab')[0]?.message).toBe(
      "Isn't in the expected format.",
    );
    // The schema's own date pattern is recognised.
    expect(
      validateAgainstSchema({ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, '2020')[0]
        ?.message,
    ).toBe('Must be a date, as YYYY-MM-DD.');
  });

  it('flags an unknown field and an unknown path', () => {
    const [issue] = validateAgainstSchema(SCHEMA, { organization: { name: 'A', bogus: 1 } });
    expect(issue).toEqual({
      path: 'organization.bogus',
      message: 'Not a field this schema allows.',
    });
    expect(validateField(SCHEMA, 'organization.bogus', 'x')).toHaveLength(1);
  });

  it('reports no keyword it would silently ignore on its own fixture', () => {
    expect(unhandledKeywords(SCHEMA)).toEqual([]);
    expect(unhandledKeywords({ type: 'string', contentEncoding: 'base64' } as JsonSchema)).toEqual([
      'contentEncoding',
    ]);
  });
});

describe('pickSchema', () => {
  it('keeps only the picked paths, and only their required entries', () => {
    const picked = pickSchema(SCHEMA, ['organization.email']);
    expect(picked.properties?.organization?.properties).toEqual({
      email: SCHEMA.properties!.organization!.properties!.email,
    });
    // `name` is required by the full schema but not picked, so it must not be demanded here.
    expect(picked.properties?.organization?.required).toBeUndefined();
    expect(validateAgainstSchema(picked, { organization: { email: 'a@b.ca' } })).toEqual([]);
  });

  it('keeps a required property that was picked', () => {
    const picked = pickSchema(SCHEMA, ['organization.name', 'organization.email']);
    expect(picked.properties?.organization?.required).toEqual(['name']);
    expect(validateAgainstSchema(picked, { organization: { email: 'a@b.ca' } })[0]?.path).toBe(
      'organization.name',
    );
  });

  it('picks through a map key and a union', () => {
    const picked = pickSchema(SCHEMA, ['site.themes.default.palette']);
    const issues = validateAgainstSchema(picked, {
      site: { themes: { default: { palette: { brand: { seed: 1 } } } } },
    });
    // The whole palette is picked, union included, so a bad branch reports at the hue, not its seed.
    expect(issues.map((i) => i.path)).toEqual(['site.themes.default.palette.brand']);
  });

  it('picks a field inside a map row without taking the row siblings', () => {
    const picked = pickSchema(SCHEMA, ['organization.services.*.name']);
    expect(
      validateAgainstSchema(picked, { organization: { services: { a: { name: 'A' } } } }),
    ).toEqual([]);
    expect(
      validateAgainstSchema(picked, { organization: { services: { a: { price: 1 } } } }).map(
        (i) => i.path,
      ),
    ).toEqual(['organization.services.a.name', 'organization.services.a.price']);
  });
});

describe('describeField', () => {
  const d = (path: string, values?: unknown) => describeField(SCHEMA, path, { values });

  it('derives a widget from the schema node', () => {
    expect(d('organization.name')?.widget).toBe('locale');
    expect(d('organization.email')?.widget).toBe('email');
    expect(d('organization.foundingDate')?.widget).toBe('date');
    expect(d('organization.sameAs')?.widget).toBe('lines');
    expect(d('organization.address')?.widget).toBe('group');
    expect(d('organization.services')?.widget).toBe('map');
    expect(d('site.enabled')?.widget).toBe('switch');
    expect(d('site.level')?.widget).toBe('radio');
    expect(d('site.jurisdiction')?.widget).toBe('radio');
    expect(d('site.variants')?.widget).toBe('lines');
  });

  it('carries required, options, the schema description and the current value', () => {
    expect(d('organization.name')).toMatchObject({
      required: true,
      description: 'Trading **name**.',
    });
    expect(d('site.level')?.options).toEqual(['none', 'A', 'AA', 'AAA']);
    expect(d('organization.email', { organization: { email: 'a@b.ca' } })?.value).toBe('a@b.ca');
    expect(d('organization.email')?.value).toBeUndefined();
  });

  it('describes a group by its properties and a map by a row template plus current rows', () => {
    expect(d('organization.address')?.children?.map((c) => c.path)).toEqual([
      'organization.address.addressLocality',
      'organization.address.postalCode',
    ]);
    const map = d('organization.services', {
      organization: { services: { roof: { name: 'Roof' } } },
    });
    expect(map?.children?.map((c) => c.path)).toEqual([
      'organization.services.*.name',
      'organization.services.*.price',
    ]);
    expect(map?.rows).toEqual([{ key: 'roof', value: { name: 'Roof' } }]);
  });

  it('falls back to a humanised label and honours a projection override', () => {
    expect(d('organization.address.postalCode')?.label).toBe('Postal code');
    expect(
      describeField(SCHEMA, 'organization.email', { override: { label: 'Work email' } })?.label,
    ).toBe('Work email');
  });

  it('narrows a map to the requested fields', () => {
    const field = describeField(SCHEMA, 'site.themes.default.palette', {
      override: { fields: ['seed'] },
    });
    expect(field?.widget).toBe('map');
    expect(field?.children?.map((c) => c.path)).toEqual(['site.themes.default.palette.*.seed']);
  });

  it('returns nothing for a path the schema lacks', () => {
    expect(d('organization.bogus')).toBeUndefined();
  });
});

describe('resolveProjection', () => {
  const projection: Projection = {
    id: 't',
    title: 'T',
    items: [
      'organization.name',
      { kind: 'notice', id: 'n' },
      'organization.bogus',
      { path: 'organization.email', label: 'Mail' },
    ],
  };

  it('keeps order, passes notices through, and drops a path the schema does not know', () => {
    const items = resolveProjection(SCHEMA, projection);
    expect(items.map((i) => (i.kind === 'notice' ? `notice:${i.id}` : i.path))).toEqual([
      'organization.name',
      'notice:n',
      'organization.email',
    ]);
  });
});

describe('stepStatus', () => {
  const step = (over: Partial<OnboardingStep> = {}): OnboardingStep => ({
    id: 'identity',
    title: 'Identity',
    intro: '',
    projections: ['organization.identity'],
    ...over,
  });

  // `organization.identity` is a real projection, but its paths mostly do not exist in SCHEMA, so
  // use the schema's own `name`/`email` through a step whose projection we know resolves.
  it('is incomplete with nothing entered, complete when valid, invalid on a bad value', () => {
    expect(stepStatus(step(), {}, SCHEMA).status).toBe('incomplete');
    expect(stepStatus(step(), { organization: { name: 'Acme' } }, SCHEMA).status).toBe('complete');
    expect(
      stepStatus(step(), { organization: { name: 'Acme', foundingDate: 'x' } }, SCHEMA).status,
    ).toBe('invalid');
  });

  it('calls an untouched optional step empty, not complete', () => {
    expect(stepStatus(step({ optional: true }), {}, SCHEMA).status).toBe('empty');
  });

  it('treats the review step as always reachable', () => {
    expect(stepStatus(step({ review: true, projections: [] }), {}, SCHEMA).status).toBe('complete');
  });
});

describe('the forms entry', () => {
  it('imports no zod and no Node builtin, so a Worker can load it', () => {
    const dir = new URL('./', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(source, file).not.toMatch(/from\s+['"](?:node:|zod|@zod)/);
      expect(source, file).not.toMatch(/from\s+['"]@getvitops\//);
    }
  });
});
