import { describe, expect, it } from 'vite-plus/test';
import { applyOps, checkTarget, fetchSchema } from './client.ts';
import {
  diffSchema,
  formatPlan,
  formatPlanMarkdown,
  hasChanges,
  hasDrift,
  needsReview,
  type SchemaCollection,
  type SchemaExport,
  type SchemaField,
} from './plan.ts';

const field = (slug: string, over: Partial<SchemaField> = {}): SchemaField => ({
  slug,
  label: slug,
  type: 'string',
  required: false,
  unique: false,
  ...over,
});
const col = (slug: string, fields: SchemaField[], supports = ['drafts']): SchemaCollection => ({
  slug,
  label: slug,
  labelSingular: slug,
  supports,
  fields,
});
const schema = (...collections: SchemaCollection[]): SchemaExport => ({
  version: 'v',
  collections,
});

describe('diffSchema', () => {
  it('is empty and not drifting when both sides match', () => {
    const s = schema(col('posts', [field('title')]));
    const plan = diffSchema(s, s);
    expect(plan.apply).toEqual([]);
    expect(hasDrift(plan)).toBe(false);
    expect(plan.unchanged).toBeGreaterThan(0);
  });

  it('adds a field present only on the source', () => {
    const plan = diffSchema(
      schema(col('posts', [field('title'), field('subtitle')])),
      schema(col('posts', [field('title')])),
    );
    expect(plan.apply).toEqual([
      expect.objectContaining({ kind: 'add-field', collection: 'posts', sortOrder: 1 }),
    ]);
    expect(hasChanges(plan)).toBe(true);
  });

  it('creates a missing collection before any field, so references resolve', () => {
    const plan = diffSchema(
      schema(
        col('posts', [field('author', { type: 'reference' })]),
        col('people', [field('name')]),
      ),
      schema(),
    );
    const kinds = plan.apply.map((o) => o.kind);
    expect(kinds).toEqual(['create-collection', 'create-collection', 'add-field', 'add-field']);
  });

  it('keeps the full field definition, not just type and label', () => {
    const f = field('tone', {
      type: 'select',
      options: [{ value: 'a' }],
      validation: { required: true },
      widget: 'radio',
    });
    const plan = diffSchema(schema(col('posts', [f])), schema(col('posts', [])));
    expect(plan.apply[0]).toMatchObject({ field: f });
  });

  it('reports, never applies, a field that differs on both sides', () => {
    const plan = diffSchema(
      schema(col('posts', [field('n', { type: 'integer' })])),
      schema(col('posts', [field('n', { type: 'string' })])),
    );
    expect(plan.apply).toEqual([]);
    expect(needsReview(plan)).toBe(true);
    expect(plan.notes[0]).toMatchObject({ kind: 'changed-field', field: 'n' });
  });

  it('ignores a label-only difference', () => {
    const plan = diffSchema(
      schema(col('posts', [field('t', { label: 'New label' })])),
      schema(col('posts', [field('t', { label: 'Old label' })])),
    );
    expect(hasDrift(plan)).toBe(false);
  });

  it('treats undefined, null and missing defaults as equal', () => {
    const plan = diffSchema(
      schema(col('p', [field('t', { defaultValue: null })])),
      schema(col('p', [field('t')])),
    );
    expect(hasDrift(plan)).toBe(false);
  });

  it('never plans a removal: target-only items are information, not work', () => {
    const plan = diffSchema(
      schema(col('posts', [field('a')])),
      schema(col('posts', [field('a'), field('legacy')]), col('extra', [])),
    );
    expect(plan.apply).toEqual([]);
    expect(plan.notes.map((n) => n.kind).sort()).toEqual([
      'target-only-collection',
      'target-only-field',
    ]);
    expect(plan.notes.every((n) => n.severity === 'info')).toBe(true);
    expect(hasDrift(plan)).toBe(false);
  });

  it('reports a collection whose capabilities differ', () => {
    const plan = diffSchema(
      schema(col('posts', [], ['drafts', 'revisions'])),
      schema(col('posts', [], ['drafts'])),
    );
    expect(plan.notes[0]).toMatchObject({ kind: 'changed-collection', severity: 'review' });
  });

  it('flags a block type that exists only on the source, since it cannot be replayed', () => {
    const plan = diffSchema(schema(), schema(), {
      fromBlockTypes: ['hero', 'faq'],
      toBlockTypes: ['faq'],
    });
    expect(plan.notes).toEqual([
      expect.objectContaining({ kind: 'block-type', severity: 'review' }),
    ]);
    expect(plan.notes[0]!.message).toContain('hero');
  });

  it('is idempotent: applying the plan then re-diffing leaves nothing', () => {
    const from = schema(col('posts', [field('a'), field('b')]), col('new', [field('x')]));
    let to = schema(col('posts', [field('a')]));
    for (const op of diffSchema(from, to).apply) {
      if (op.kind === 'create-collection') {
        to = { ...to, collections: [...to.collections, { ...op.collection, fields: [] }] };
      } else {
        to = {
          ...to,
          collections: to.collections.map((c) =>
            c.slug === op.collection ? { ...c, fields: [...c.fields, op.field] } : c,
          ),
        };
      }
    }
    expect(diffSchema(from, to).apply).toEqual([]);
  });
});

describe('formatting', () => {
  const plan = diffSchema(
    schema(col('posts', [field('a'), field('b', { required: true })])),
    schema(col('posts', [field('a')]), col('only', [])),
  );
  it('lists additions and what is ahead in text', () => {
    const text = formatPlan(plan);
    expect(text).toContain('+ add field "posts.b" (string, required)');
    expect(text).toContain('Target is ahead');
  });
  it('says so plainly when nothing is to be done', () => {
    expect(formatPlanMarkdown(diffSchema(schema(), schema()))).toBe('No schema changes to apply.');
  });
  it('renders markdown additions', () => {
    expect(formatPlanMarkdown(plan)).toContain('- add field "posts.b"');
  });
});

describe('client', () => {
  const target = { baseUrl: 'https://dev.example.com/', token: 't0ken' };

  it('refuses to send a token over http to a remote host, or without a token', () => {
    expect(checkTarget({ baseUrl: 'http://example.com', token: 'x' })).toMatch(/https/);
    expect(checkTarget({ baseUrl: 'http://localhost:4321', token: 'x' })).toBeUndefined();
    expect(checkTarget({ baseUrl: 'https://a.com', token: '' })).toMatch(/token/);
    expect(checkTarget({ baseUrl: 'nope', token: 'x' })).toMatch(/not a URL/);
  });

  it('GETs the schema with a bearer token and unwraps data', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ data: schema() }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await fetchSchema(target, f);
    expect(res).toEqual({ ok: true, value: schema() });
    expect(seen!.url).toBe('https://dev.example.com/_emdash/api/schema');
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer t0ken');
  });

  it('sends the CSRF marker and origin on mutations, and posts the whole field', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: {} }), { status: 201 });
    }) as unknown as typeof fetch;
    const ops = diffSchema(
      schema(col('posts', [field('t', { type: 'select', options: ['a'] })])),
      schema(),
    ).apply;
    const results = await applyOps(target, ops, f);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(calls[0]!.url).toBe('https://dev.example.com/_emdash/api/schema/collections');
    expect(calls[1]!.url).toBe(
      'https://dev.example.com/_emdash/api/schema/collections/posts/fields',
    );
    const h = calls[1]!.init.headers as Record<string, string>;
    expect(h['X-EmDash-Request']).toBe('1');
    expect(h.Origin).toBe('https://dev.example.com');
    expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({
      slug: 't',
      options: ['a'],
      sortOrder: 0,
    });
  });

  it('stops at the first failure and names it', async () => {
    let n = 0;
    const f = (async () =>
      ++n === 1
        ? new Response(JSON.stringify({ data: {} }), { status: 201 })
        : new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'exists' } }), {
            status: 409,
          })) as unknown as typeof fetch;
    const ops = diffSchema(schema(col('a', [field('x'), field('y')])), schema()).apply;
    const results = await applyOps(target, ops, f);
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ ok: false });
    expect(results[1]!.message).toContain('409 CONFLICT');
  });

  it('turns a network error into a result, not a throw', async () => {
    const f = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchSchema(target, f)).toMatchObject({ ok: false });
  });
});
