import {
  describeField,
  formToConfig,
  renderInlineMarkdown,
  resolveProjection,
  type JsonSchema,
  type Projection,
} from '@getvitops/config/forms';
import { parseFragment, type DefaultTreeAdapterTypes as T } from 'parse5';
import { describe, expect, it } from 'vite-plus/test';
import { nodesToHtml } from '../html-render.ts';
import {
  errorsByPath,
  inlineMarkdownNodes,
  renderProjectionHtml,
  renderProjectionSection,
  renderStepHtml,
} from './render.ts';

const SCHEMA: JsonSchema = {
  type: 'object',
  // `organization` is required here so its `name` is required outright; a field is only required
  // natively when every ancestor is (see `isUnconditionallyRequired`).
  required: ['organization'],
  additionalProperties: false,
  properties: {
    organization: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          description: 'Trading **name**, as in `Acme`.',
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
        sameAs: { type: 'array', items: { type: 'string' } },
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
            properties: {
              name: {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    propertyNames: { type: 'string' },
                    additionalProperties: { type: 'string' },
                  },
                ],
              },
              price: { type: 'number', minimum: 0 },
              active: { type: 'boolean' },
            },
          },
        },
      },
    },
    site: {
      type: 'object',
      additionalProperties: false,
      properties: {
        level: { type: 'string', enum: ['none', 'A', 'AA', 'AAA'] },
        jurisdiction: { type: 'string', enum: ['ca', 'qc', 'us', 'eu', 'uk', 'au'] },
        enabled: { type: 'boolean' },
      },
    },
  },
};

const projection = (...paths: string[]): Projection => ({ id: 't', title: 'T', items: paths });
const render = (
  paths: string[],
  values: unknown = {},
  options: Parameters<typeof renderProjectionHtml>[1] = {},
): string =>
  renderProjectionHtml(resolveProjection(SCHEMA, projection(...paths), { values }), {
    values,
    ...options,
  });

/* ── A tiny reader: the HTML back to what a browser would submit ───────────── */

type Node = T.ChildNode;
const attr = (node: T.Element, name: string): string | undefined =>
  node.attrs.find((a) => a.name === name)?.value;
const walk = (node: Node | T.DocumentFragment, visit: (el: T.Element) => void): void => {
  if ('tagName' in node) visit(node);
  if ('childNodes' in node) for (const child of node.childNodes) walk(child, visit);
};
const all = (source: string | Node | T.DocumentFragment, tag: string): T.Element[] => {
  const out: T.Element[] = [];
  walk(typeof source === 'string' ? parseFragment(source) : source, (el) => {
    if (el.tagName === tag) out.push(el);
  });
  return out;
};
const text = (node: Node | T.DocumentFragment): string =>
  'value' in node && typeof node.value === 'string'
    ? node.value
    : 'childNodes' in node
      ? node.childNodes.map(text).join('')
      : '';

/** What the browser would put in `FormData`, in document order. */
function submission(html: string): [string, string][] {
  const out: [string, string][] = [];
  walk(parseFragment(html), (el) => {
    const name = attr(el, 'name');
    if (!name) return;
    if (el.tagName === 'input') {
      const type = attr(el, 'type') ?? 'text';
      if ((type === 'checkbox' || type === 'radio') && attr(el, 'checked') === undefined) return;
      out.push([name, attr(el, 'value') ?? (type === 'checkbox' ? 'on' : '')]);
    } else if (el.tagName === 'textarea') {
      out.push([name, el.childNodes.map(text).join('')]);
    } else if (el.tagName === 'select') {
      const options = all(el, 'option');
      const picked = options.find((o) => attr(o, 'selected') !== undefined) ?? options[0];
      if (picked) out.push([name, attr(picked, 'value') ?? text(picked)]);
    }
  });
  return out;
}
describe('a text field', () => {
  const html = render(['organization.email'], { organization: { email: 'ada@example.com' } });
  const [wcField] = all(html, 'wc-field');
  const [input] = all(html, 'input');

  it('is a <wc-field> around a label that nests the control, with no id/for pair', () => {
    expect(attr(wcField!, 'class')).toBe('field');
    expect(all(html, 'label')).toHaveLength(1);
    expect(attr(all(html, 'label')[0]!, 'for')).toBeUndefined();
    expect(attr(all(html, 'label')[0]!, 'class')).toBe('field__control');
    // The input is inside the label.
    expect(all(all(html, 'label')[0]!, 'input')).toHaveLength(1);
    expect(html.indexOf('<input')).toBeGreaterThan(html.indexOf('<label'));
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('</label>'));
  });

  it('carries the type, name and current value, and marks an optional field', () => {
    expect(attr(input!, 'type')).toBe('email');
    expect(attr(input!, 'name')).toBe('organization.email');
    expect(attr(input!, 'value')).toBe('ada@example.com');
    expect(html).toContain('field__optional');
  });

  it('always renders an empty polite live region for the error', () => {
    expect(html).toMatch(/<span class="field__error"[^>]*aria-live="polite"[^>]*><\/span>/);
  });

  it('marks a required top-level field required, and not optional', () => {
    const required = render(['organization.name']);
    expect(attr(all(required, 'input')[0]!, 'required')).toBeDefined();
    expect(required).not.toContain('field__optional');
  });

  it('does not mark a field required when an ancestor that is optional holds it', () => {
    // `domains` is optional, so `canonical` is required only if the visitor starts a domain.
    const html = renderProjectionHtml(
      resolveProjection(
        {
          type: 'object',
          properties: {
            site: {
              type: 'object',
              properties: {
                domains: {
                  type: 'object',
                  required: ['canonical'],
                  properties: { canonical: { type: 'string', format: 'uri' } },
                },
              },
            },
          },
        } as JsonSchema,
        { id: 'p', title: 'P', items: ['site.domains.canonical'] },
      ),
      {},
    );
    expect(html).not.toMatch(/<input[^>]*\brequired\b/);
    expect(html).toContain('field__optional');
  });
});

describe('what a visitor typed comes back out exactly', () => {
  it.each(['AT&T', '&copy', 'a&amp;b', 'say "hi"', "it's", '<b>x</b>', '5 < 6 > 4'])(
    'round-trips %j through the value attribute',
    (value) => {
      const html = render(['organization.email'], { organization: { email: value } });
      expect(attr(all(html, 'input')[0]!, 'value')).toBe(value);
    },
  );

  it('does not let a label or a value break out of its element', () => {
    const hostile = '"><script>alert(1)</script>';
    const html = render(['organization.email'], { organization: { email: hostile } });
    expect(all(html, 'script')).toHaveLength(0);
    expect(attr(all(html, 'input')[0]!, 'value')).toBe(hostile);
    const labelled = renderProjectionHtml([
      { ...describeField(SCHEMA, 'organization.email')!, label: hostile },
    ]);
    expect(all(labelled, 'script')).toHaveLength(0);
    expect(text(parseFragment(labelled))).toContain(hostile);
  });
});

describe('errors and help', () => {
  const values = { organization: { email: 'nope' } };
  const withError = render(['organization.email'], values, {
    errors: { 'organization.email': 'Must be an email address.' },
  });

  it('shows the error and links it, with aria-invalid, so the no-JS page is already right', () => {
    const [input] = all(withError, 'input');
    expect(withError).toContain('Must be an email address.');
    expect(attr(all(withError, 'wc-field')[0]!, 'data-invalid')).toBeDefined();
    expect(attr(input!, 'aria-invalid')).toBe('true');
    const errorId = attr(
      all(withError, 'span').find((s) => attr(s, 'class') === 'field__error')!,
      'id',
    );
    expect(attr(input!, 'aria-describedby')).toContain(errorId);
  });

  it('is clean with no error', () => {
    const clean = render(['organization.email'], values);
    expect(attr(all(clean, 'input')[0]!, 'aria-invalid')).toBeUndefined();
    expect(attr(all(clean, 'wc-field')[0]!, 'data-invalid')).toBeUndefined();
  });

  it('turns the first issue per path into an errors map', () => {
    expect(
      errorsByPath([
        { path: 'a', message: 'first' },
        { path: 'a', message: 'second' },
        { path: 'b', message: 'only' },
      ]),
    ).toEqual({ a: 'first', b: 'only' });
  });

  it('prints the schema description as help, markdown rendered, and links it', () => {
    const html = render(['organization.name']);
    expect(html).toContain('<strong>name</strong>');
    expect(html).toContain('<code>Acme</code>');
    const helpId = attr(all(html, 'small')[0]!, 'id');
    expect(attr(all(html, 'input')[0]!, 'aria-describedby')).toContain(helpId);
  });
});

describe('widgets', () => {
  it('writes a switch as a hidden false then a checkbox, so unchecking still submits', () => {
    const off = render(['site.enabled'], { site: { enabled: false } });
    expect(submission(off)).toEqual([['site.enabled$bool', 'false']]);
    const on = render(['site.enabled'], { site: { enabled: true } });
    expect(submission(on)).toEqual([
      ['site.enabled$bool', 'false'],
      ['site.enabled$bool', 'true'],
    ]);
    expect(formToConfig(submission(on))).toEqual({ site: { enabled: true } });
  });

  it('writes a short enum as radios in a fieldset and a long one as a select', () => {
    const radios = render(['site.level'], { site: { level: 'AA' } });
    expect(all(radios, 'fieldset')).toHaveLength(1);
    expect(all(radios, 'legend')).toHaveLength(1);
    expect(all(radios, 'input').map((i) => attr(i, 'value'))).toEqual(['none', 'A', 'AA', 'AAA']);
    expect(submission(radios)).toEqual([['site.level', 'AA']]);

    const select = render(['site.jurisdiction'], { site: { jurisdiction: 'qc' } });
    expect(all(select, 'select')).toHaveLength(1);
    expect(all(select, 'option').map((o) => attr(o, 'value'))).toEqual([
      '',
      'ca',
      'qc',
      'us',
      'eu',
      'uk',
      'au',
    ]);
    expect(submission(select)).toEqual([['site.jurisdiction', 'qc']]);
  });

  it('writes lines as a textarea, one per line, under the $lines name', () => {
    const html = render(['organization.sameAs'], {
      organization: { sameAs: ['https://a.ca', 'https://b.ca'] },
    });
    expect(submission(html)).toEqual([['organization.sameAs$lines', 'https://a.ca\nhttps://b.ca']]);
    expect(formToConfig(submission(html))).toEqual({
      organization: { sameAs: ['https://a.ca', 'https://b.ca'] },
    });
  });

  it('writes a group as a fieldset of its fields', () => {
    const html = render(['organization.address'], {
      organization: { address: { addressLocality: 'Ottawa' } },
    });
    expect(all(html, 'fieldset')).toHaveLength(1);
    expect(submission(html)).toEqual([
      ['organization.address.addressLocality', 'Ottawa'],
      ['organization.address.postalCode', ''],
    ]);
    // A group's required child is NOT natively required: that would force the whole group.
    expect(all(html, 'input').every((i) => attr(i, 'required') === undefined)).toBe(true);
  });
});

describe('a switch whose schema default is true', () => {
  const DEFAULT_ON: JsonSchema = {
    type: 'object',
    properties: {
      site: {
        type: 'object',
        properties: { indexable: { type: 'boolean', default: true } },
      },
    },
  };
  const html = (values: unknown) =>
    renderProjectionHtml(resolveProjection(DEFAULT_ON, projection('site.indexable'), { values }));

  it('starts checked when unset, so saving unedited does not write false', () => {
    expect(formToConfig(submission(html({})))).toEqual({ site: { indexable: true } });
  });

  it('honours an explicit false', () => {
    expect(formToConfig(submission(html({ site: { indexable: false } })))).toEqual({
      site: { indexable: false },
    });
  });
});

describe('a localisable field', () => {
  it('is a plain input for one language, and keeps the value of a one-entry map', () => {
    const single = render(
      ['organization.name'],
      { organization: { name: 'Acme' } },
      { locales: ['en'] },
    );
    expect(submission(single)).toEqual([['organization.name', 'Acme']]);
    const oneEntry = render(
      ['organization.name'],
      { organization: { name: { en: 'Acme' } } },
      { locales: ['en'] },
    );
    expect(submission(oneEntry)).toEqual([['organization.name', 'Acme']]);
  });

  it('is a row per language for several, with the bare string on the default one', () => {
    const html = render(
      ['organization.name'],
      { organization: { name: 'Acme' } },
      { locales: ['en', 'fr'] },
    );
    // With several languages a bare string is promoted to a map keyed by the default locale. The
    // two mean the same thing to the schema, but it is a shape change on an untouched save.
    expect(formToConfig(submission(html))).toEqual({ organization: { name: { en: 'Acme' } } });
    const filled = render(
      ['organization.name'],
      { organization: { name: { en: 'Acme', fr: 'Acmé' } } },
      { locales: ['en', 'fr'] },
    );
    expect(formToConfig(submission(filled))).toEqual({
      organization: { name: { en: 'Acme', fr: 'Acmé' } },
    });
    expect(
      all(filled, 'input')
        .filter((i) => attr(i, 'type') === 'text')
        .map((i) => attr(i, 'lang')),
    ).toEqual(['en', 'fr']);
  });

  it('keeps a translation that is not among the configured locales', () => {
    const html = render(
      ['organization.name'],
      { organization: { name: { en: 'Acme', de: 'Acme GmbH' } } },
      { locales: ['en', 'fr'] },
    );
    expect(formToConfig(submission(html))).toEqual({
      organization: { name: { en: 'Acme', de: 'Acme GmbH' } },
    });
  });
});

describe('a keyed map', () => {
  const values = {
    organization: {
      services: {
        roof: { name: { en: 'Roofing', fr: 'Toiture' }, price: 120, active: true },
        gutters: { name: 'Gutters', price: 40 },
      },
    },
  };

  it('offers a row per entry and one blank row, keyed by $key', () => {
    const html = render(['organization.services'], values, { locales: ['en', 'fr'] });
    const keys = submission(html).filter(([name]) => name.endsWith('$key'));
    expect(keys).toEqual([
      ['organization.services$map.0.$key', 'roof'],
      ['organization.services$map.1.$key', 'gutters'],
      ['organization.services$map.2.$key', ''],
    ]);
    expect(html).toContain('data-blank');
  });

  it('wraps the map in <wc-repeat> and writes each row as an open, titled <details>', () => {
    const html = render(['organization.services'], values, { locales: ['en'] });
    expect(html).toContain('<wc-repeat');
    expect(html).toContain('add-label="Add service"');
    const rows = all(html, 'details');
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => attr(row, 'open') !== undefined)).toBe(true);
    expect(html).toContain('<span class="field__row-title">roof</span>');
    expect(html).toContain('New service');
  });

  it('round-trips an untouched form to the document it started from', () => {
    const html = render(['organization.services'], values, { locales: ['en', 'fr'] });
    // Two shape changes are inherent to the wire format and documented: with several languages a
    // bare string becomes a map keyed by the default locale (`gutters.name`), and an unset switch
    // is saved as an explicit `false` (`gutters.active`), which means the same unless the schema
    // default is true (the next test). The blank row vanishes.
    expect(formToConfig(submission(html))).toEqual({
      organization: {
        services: {
          roof: { name: { en: 'Roofing', fr: 'Toiture' }, price: 120, active: true },
          gutters: { name: { en: 'Gutters' }, price: 40, active: false },
        },
      },
    });
  });

  it('puts a row error on the field of that row', () => {
    const html = render(['organization.services'], values, {
      locales: ['en'],
      errors: { 'organization.services.gutters.price': 'Must be at least 0.' },
    });
    expect(html).toContain('Must be at least 0.');
    const invalid = all(html, 'wc-field').filter((f) => attr(f, 'data-invalid') !== undefined);
    expect(invalid).toHaveLength(1);
  });

  it('never marks a row field natively required, since the blank row would block submit', () => {
    const html = render(['organization.services'], {}, { locales: ['en'] });
    expect(all(html, 'input').every((i) => attr(i, 'required') === undefined)).toBe(true);
  });
});

describe('notices, sections and steps', () => {
  const noticeProjection: Projection = {
    id: 'n',
    title: 'N',
    items: [{ kind: 'notice', id: 'accessibility.obligations' }, 'organization.email'],
  };
  const items = resolveProjection(SCHEMA, noticeProjection);

  it('renders the default notice for the accessibility step when the host supplies none', () => {
    expect(renderProjectionHtml(items)).toContain('not available here yet');
  });

  it("renders a host's notice instead, escaped when text and trusted when nodes", () => {
    const text = renderProjectionHtml(items, {
      notices: { 'accessibility.obligations': '<b>x</b>' },
    });
    expect(text).toContain('&lt;b&gt;x&lt;/b&gt;');
    const nodes = renderProjectionHtml(items, {
      notices: { 'accessibility.obligations': [{ tag: 'strong', children: ['AODA'] }] },
    });
    expect(nodes).toContain('<strong>AODA</strong>');
    expect(nodes).toContain('role="note"');
  });

  it('skips a notice nobody has content for', () => {
    const unknown = resolveProjection(SCHEMA, {
      id: 'x',
      title: 'X',
      items: [{ kind: 'notice', id: 'nope' }],
    });
    expect(renderProjectionHtml(unknown)).toBe('');
  });

  it('wraps a projection in a section named by its heading', () => {
    const html = renderProjectionSection(
      SCHEMA,
      {
        id: 'organization.identity',
        title: 'Your business',
        description: 'Intro.',
        items: ['organization.email'],
      },
      { headingLevel: 2 },
    );
    const [section] = all(html, 'section');
    const [heading] = all(html, 'h2');
    expect(attr(section!, 'aria-labelledby')).toBe(attr(heading!, 'id'));
    expect(text(heading!)).toBe('Your business');
    expect(html).toContain('field-section__intro');
  });

  it('renders every projection a step lists, and nothing for a review step', () => {
    const empty = renderStepHtml(SCHEMA, {
      id: 'review',
      title: 'R',
      intro: '',
      projections: [],
      review: true,
    });
    expect(empty).toBe('');
  });

  it('prefixes ids so two forms on one page cannot collide', () => {
    const a = render(['organization.email'], {}, { idPrefix: 'a' });
    const b = render(['organization.email'], {}, { idPrefix: 'b' });
    expect(attr(all(a, 'input')[0]!, 'id')).not.toBe(attr(all(b, 'input')[0]!, 'id'));
  });
});

describe('inlineMarkdownNodes', () => {
  it.each([
    'plain text',
    'a **strong** word',
    'an *emphasised* word',
    'code `bg-*` and `text-*` stay literal, so *this* is not wrapped',
    '**bold with `code` inside**',
    '5 < 6 & 7 > 4',
    'unterminated ** here',
  ])('renders %j like renderInlineMarkdown does', (source) => {
    expect(nodesToHtml(inlineMarkdownNodes(source) as never[])).toBe(renderInlineMarkdown(source));
  });

  it('escapes a double quote in text, as renderInlineMarkdown does not need to', () => {
    // Element text needs no quote escaping; only the attribute path does. Both are valid HTML.
    expect(nodesToHtml(inlineMarkdownNodes('say "hi"') as never[])).toBe('say "hi"');
  });
});
