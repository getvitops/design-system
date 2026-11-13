import {
  ONBOARDING_STEPS,
  PROJECTIONS,
  formToConfig,
  pathsOf,
  stepStatus,
  valueAt,
  type JsonSchema,
} from '@getvitops/config/forms';
import { parseRenderedSlots } from '@getvitops/utils';
import { errorsByPath, renderProjectionSection, renderStepHtml } from '@getvitops/utils/forms';
import { describe, expect, it } from 'vite-plus/test';
import { configJsonSchema } from './index.ts';

/**
 * The renderer, the codec and the real config schema have to agree: what `renderStepHtml` writes for
 * a document, submitted unedited, must parse back to that document. The pieces are unit-tested apart
 * in `@getvitops/utils` and `@getvitops/config`; this is the one place all three meet the real schema.
 */
const schema = configJsonSchema as unknown as JsonSchema;

// parse5 nodes, read structurally so this package needs no parse5 of its own.
interface Node {
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  value?: string;
}
const attr = (node: Node, name: string): string | undefined =>
  node.attrs?.find((a) => a.name === name)?.value;
const text = (node: Node): string => node.value ?? (node.childNodes ?? []).map(text).join('');
function walk(nodes: Node[], visit: (node: Node) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.childNodes) walk(node.childNodes, visit);
  }
}

/** What a browser would submit for this markup, in document order. */
function submission(html: string): [string, string][] {
  const out: [string, string][] = [];
  walk(parseRenderedSlots(html) as unknown as Node[], (node) => {
    const name = attr(node, 'name');
    if (!name) return;
    if (node.tagName === 'input') {
      const type = attr(node, 'type') ?? 'text';
      if ((type === 'checkbox' || type === 'radio') && attr(node, 'checked') === undefined) return;
      out.push([name, attr(node, 'value') ?? '']);
    } else if (node.tagName === 'textarea') {
      out.push([name, (node.childNodes ?? []).map(text).join('')]);
    } else if (node.tagName === 'select') {
      const options = (node.childNodes ?? []).filter((c) => c.tagName === 'option');
      const picked = options.find((o) => attr(o, 'selected') !== undefined) ?? options[0];
      if (picked) out.push([name, attr(picked, 'value') ?? '']);
    }
  });
  return out;
}

const DOCUMENT = {
  organization: {
    name: 'Acme Roofing',
    legalName: 'Acme Roofing Inc.',
    description: 'We repair roofs across the Ottawa valley.',
    foundingDate: '2015-03-01',
    email: 'hello@acme.ca',
    phone: '+1 613 555 0100',
    address: {
      streetAddress: '100 Bank St',
      addressLocality: 'Ottawa',
      addressRegion: 'ON',
      postalCode: 'K1P 1J1',
      addressCountry: 'CA',
    },
    sameAs: ['https://www.facebook.com/acme', 'https://www.instagram.com/acme'],
    links: { linkedin: 'https://www.linkedin.com/company/acme' },
    primaryLocation: 'ottawa',
    locations: {
      ottawa: {
        slug: 'ottawa',
        name: 'Ottawa',
        phone: '+1 613 555 0100',
        address: { addressLocality: 'Ottawa', addressCountry: 'CA' },
      },
    },
    services: {
      roofing: { slug: 'roofing', name: 'Roofing', description: 'New and repaired roofs.' },
    },
  },
  site: {
    defaultLocale: 'en',
    locales: { en: { name: 'English', basePath: '/' } },
    domains: { canonical: 'https://acme.ca' },
    accessibility: { standard: 'wcag21', level: 'AA' },
    legal: {
      jurisdiction: 'ca',
      privacyPolicy: { enabled: true },
      termsOfService: { enabled: true },
      cookieConsent: { enabled: true, type: 'opt-in' },
    },
    analytics: { plausibleDomain: 'acme.ca' },
  },
  designSystem: {
    themes: { default: { colors: { palette: { brand: { seed: '#0057b8' } } } } },
  },
};

/** JSON with sorted keys: a document and its round trip are the same when only key order differs. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

const options = { values: DOCUMENT, locales: ['en'] };

describe('every onboarding step, rendered from the real schema', () => {
  const html = ONBOARDING_STEPS.map((step) => renderStepHtml(schema, step, options)).join('');
  const result = formToConfig(submission(html));

  it('renders something for every step that has fields', () => {
    for (const step of ONBOARDING_STEPS.filter((s) => !s.review)) {
      expect(renderStepHtml(schema, step, options), step.id).toContain('<wc-field');
    }
  });

  it('submits unedited to the document it started from, for every projected path', () => {
    const mismatches: string[] = [];
    for (const projection of PROJECTIONS.filter((p) => p.id !== 'site.ads')) {
      for (const path of pathsOf(projection)) {
        const expected = valueAt(DOCUMENT, path);
        if (expected === undefined) continue;
        const actual = valueAt(result, path);
        if (canonical(actual) !== canonical(expected)) {
          mismatches.push(`${path}: ${canonical(actual)} !== ${canonical(expected)}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('produces a document no step calls invalid', () => {
    const bad = ONBOARDING_STEPS.map((step) => stepStatus(step, result, schema)).filter(
      (report) => report.status === 'invalid',
    );
    expect(bad).toEqual([]);
  });

  it('never emits a script, an event handler or an unnamed control', () => {
    expect(html).not.toMatch(/<script|\son[a-z]+=/i);
    const unnamed: string[] = [];
    walk(parseRenderedSlots(html) as unknown as Node[], (node) => {
      if (['input', 'select', 'textarea'].includes(node.tagName ?? '')) {
        if (attr(node, 'type') !== 'hidden' && !attr(node, 'name')) unnamed.push(node.tagName!);
      }
    });
    expect(unnamed).toEqual([]);
  });
});

describe('errors from the real validator land on the right control', () => {
  it('shows an invalid email under the email field, linked for a screen reader', () => {
    const values = { organization: { email: 'not-an-email' } };
    const step = ONBOARDING_STEPS.find((s) => s.id === 'contact')!;
    const report = stepStatus(step, values, schema);
    const html = renderStepHtml(schema, step, { values, errors: errorsByPath(report.issues) });
    expect(html).toContain('Must be an email address.');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('data-invalid');
  });
});

describe('a section', () => {
  it('names itself by its heading', () => {
    const projection = PROJECTIONS.find((p) => p.id === 'organization.identity')!;
    const html = renderProjectionSection(schema, projection, { ...options, headingLevel: 2 });
    expect(html).toMatch(/<section class="field-section" aria-labelledby="([^"]+)"><h2 id="\1">/);
    expect(text({ childNodes: parseRenderedSlots(html) as unknown as Node[] })).toContain(
      projection.title,
    );
  });
});
