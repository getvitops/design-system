import {
  FIELD_META,
  ONBOARDING_STEPS,
  PROJECTIONS,
  UNPROJECTED,
  describeField,
  nodeAt,
  pathsOf,
  projectionById,
  resolveProjection,
  stepStatus,
  unhandledKeywords,
  validateAgainstSchema,
  type JsonSchema,
} from '@getvitops/config/forms';
import { describe, expect, it } from 'vite-plus/test';
import { configJsonSchema, defaultSiteConfig } from './index.ts';

/**
 * The form projections are authored beside the config schema, not derived from it, so these tests
 * are what stop them drifting — the same bargain `tiers.test.ts` makes for the component manifest.
 * They live here because the generator is the one package that owns the real schema.
 */
const schema = configJsonSchema as unknown as JsonSchema;

const topLevelKeys = (section: 'organization' | 'site' | 'designSystem'): string[] =>
  Object.keys(schema.properties?.[section]?.properties ?? {}).filter(
    (key) => key !== '$schema' && key !== 'configVersion',
  );

describe('form projections against config.schema.json', () => {
  it('every projected path resolves to a schema node', () => {
    const missing = PROJECTIONS.flatMap((projection) =>
      pathsOf(projection)
        .filter((path) => !nodeAt(schema, path))
        .map((path) => `${projection.id}: ${path}`),
    );
    expect(missing).toEqual([]);
  });

  it('every registry label names a real path', () => {
    const missing = Object.keys(FIELD_META).filter((path) => !nodeAt(schema, path));
    expect(missing).toEqual([]);
  });

  it('every step names real projections, and no projection is orphaned', () => {
    const used = new Set(ONBOARDING_STEPS.flatMap((step) => step.projections));
    for (const id of used) expect(projectionById(id), id).toBeDefined();
    // `site.ads` is a settings-page projection, edited by the portal rather than by onboarding.
    const standalone = new Set(['site.ads']);
    const orphaned = PROJECTIONS.map((p) => p.id).filter(
      (id) => !used.has(id) && !standalone.has(id),
    );
    expect(orphaned).toEqual([]);
  });

  it('every top-level organization / site / designSystem key is projected or excluded with a reason', () => {
    const projected = new Set(PROJECTIONS.flatMap((p) => pathsOf(p)));
    const covered = (section: string, key: string): boolean => {
      const path = `${section}.${key}`;
      return (
        [...projected].some((p) => p === path || p.startsWith(`${path}.`)) ||
        path in UNPROJECTED ||
        section === 'designSystem'
      );
    };
    const unassigned = (['organization', 'site'] as const).flatMap((section) =>
      topLevelKeys(section)
        .filter((key) => !covered(section, key))
        .map((key) => `${section}.${key}`),
    );
    expect(unassigned, 'add each to a projection or to UNPROJECTED with a reason').toEqual([]);
    // designSystem is the one section edited through a subtree, so check that subtree is reached.
    expect([...projected].some((p) => p.startsWith('designSystem.'))).toBe(true);
  });

  it('every UNPROJECTED key exists, and none is also projected', () => {
    const projected = new Set(PROJECTIONS.flatMap((p) => pathsOf(p)));
    for (const path of Object.keys(UNPROJECTED)) {
      expect(nodeAt(schema, path), `${path} is not in the schema`).toBeDefined();
      expect(
        [...projected].some((p) => p === path || p.startsWith(`${path}.`)),
        `${path} is both projected and excluded`,
      ).toBe(false);
    }
  });

  it('the validator implements every keyword the real schema uses', () => {
    expect(unhandledKeywords(schema)).toEqual([]);
  });

  it('describes every projected field without an unsupported widget', () => {
    const unsupported: string[] = [];
    const walk = (items: ReturnType<typeof resolveProjection>, trail: string): void => {
      for (const item of items) {
        if (item.kind === 'notice') continue;
        if (item.widget === 'unsupported') unsupported.push(`${trail}${item.path}`);
        if (item.children)
          walk(
            item.children.map((c) => c),
            trail,
          );
      }
    };
    for (const projection of PROJECTIONS)
      walk(resolveProjection(schema, projection), `${projection.id} `);
    expect(unsupported).toEqual([]);
  });

  it('derives the widgets the portal chose by hand', () => {
    const widget = (path: string) => describeField(schema, path)?.widget;
    expect(widget('organization.name')).toBe('locale');
    expect(widget('organization.email')).toBe('email');
    expect(widget('organization.foundingDate')).toBe('date');
    expect(widget('organization.sameAs')).toBe('lines');
    expect(widget('organization.address')).toBe('group');
    expect(widget('organization.services')).toBe('map');
    expect(widget('site.legal.jurisdiction')).toBe('radio');
    expect(widget('site.accessibility.level')).toBe('radio');
    expect(widget('site.accessibility.standard')).toBe('radio');
    expect(widget('site.ads')).toBe('map');
    expect(describeField(schema, 'site.ads')?.options?.length).toBeGreaterThan(3);
  });

  it('describes the brand palette as a map of colour pickers over seeds only', () => {
    const palette = describeField(schema, 'designSystem.themes.default.colors.palette', {
      override: { fields: ['seed'] },
    });
    expect(palette?.widget).toBe('map');
    expect(palette?.children?.map((c) => [c.path, c.widget])).toEqual([
      ['designSystem.themes.default.colors.palette.*.seed', 'color'],
    ]);
  });
});

describe('step status against a real site.json', () => {
  it('the default config passes every projection it covers, and is flagged where it is thin', () => {
    const config = defaultSiteConfig({ name: 'Acme', url: 'https://acme.ca', locale: 'en' });
    const status = Object.fromEntries(
      ONBOARDING_STEPS.map((step) => [step.id, stepStatus(step, config, schema).status]),
    );
    // `vitops init --site` writes a name, a locale and a default WCAG target, and nothing else.
    expect(status.identity).toBe('complete');
    expect(status.accessibility).toBe('complete');
    expect(status.contact).not.toBe('invalid');
    expect(Object.values(status)).not.toContain('invalid');
  });

  it('flags an invalid email on the contact step', () => {
    const report = stepStatus(
      ONBOARDING_STEPS.find((s) => s.id === 'contact')!,
      { organization: { email: 'not-an-email' } },
      schema,
    );
    expect(report.status).toBe('invalid');
    expect(report.issues[0]?.path).toBe('organization.email');
  });

  it('validates a whole default document without a single field-level issue', () => {
    const config = defaultSiteConfig({ name: 'Acme', url: 'https://acme.ca', locale: 'en' });
    // The full schema may complain about sections this document omits; it must not complain that
    // the walker does not understand the document it just generated.
    const issues = validateAgainstSchema(schema, config);
    expect(issues.filter((i) => i.message.startsWith('Expected'))).toEqual([]);
  });
});
