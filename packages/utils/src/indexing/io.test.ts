/**
 * The I/O modules' decisions — not their transport.
 *
 * These two files are meant to be thin, so what is worth asserting is the small
 * amount of judgment they still carry: which HTTP statuses mean "your key file is
 * wrong" rather than "your URLs are wrong", and which Google verdict counts as
 * indexed. Both are places where a plausible reading is the wrong one.
 */
import { describe, expect, it } from 'vitest';
import { keyFileContents, newKey, submitBatch, verifyKeyFile } from './indexnow.ts';
import { inspectUrl, parseServiceAccount, submitSitemap } from './gsc.ts';
import type { IndexNowPlan } from './plan.ts';

const res = (status: number, body: unknown = '') =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const stub = (fn: (url: string, init?: RequestInit) => Response) =>
  (async (url: string | URL | Request, init?: RequestInit) =>
    fn(String(url), init)) as unknown as typeof fetch;

const indexNowPlan: IndexNowPlan = {
  enabled: true,
  endpoint: 'https://api.indexnow.org/indexnow',
  keyLocation: 'https://acme.ca/key.txt',
  key: 'key',
  host: 'acme.ca',
  batches: [],
};

describe('newKey', () => {
  it('is 32 hex characters and not repeated', () => {
    const a = newKey();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(newKey());
  });

  it('writes the key file as the bare key', () => {
    expect(keyFileContents('abc')).toBe('abc\n');
  });
});

describe('verifyKeyFile', () => {
  /*
   * The reason this check exists: IndexNow accepts a submission with a 202 and
   * then discards it when the key file's contents don't match. Only a prior GET
   * distinguishes "submitted" from "submitted and ignored".
   */
  it('passes when the file contains exactly the key', async () => {
    const r = await verifyKeyFile(
      'https://acme.ca/k.txt',
      'abc',
      stub(() => res(200, 'abc\n')),
    );
    expect(r.ok).toBe(true);
  });

  it('fails, naming the status, when the file is missing', async () => {
    const r = await verifyKeyFile(
      'https://acme.ca/k.txt',
      'abc',
      stub(() => res(404)),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/404/);
  });

  it('fails when the contents are a different key', async () => {
    const r = await verifyKeyFile(
      'https://acme.ca/k.txt',
      'abc',
      stub(() => res(200, 'stale')),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/does not contain/);
  });

  it('fails rather than throwing when the host is unreachable', async () => {
    const r = await verifyKeyFile(
      'https://acme.ca/k.txt',
      'abc',
      stub(() => {
        throw new Error('ENOTFOUND');
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ENOTFOUND/);
  });
});

describe('submitBatch', () => {
  it('posts host, key, keyLocation and the URL list', async () => {
    let seen: RequestInit | undefined;
    await submitBatch(
      indexNowPlan,
      ['https://acme.ca/a'],
      stub((_u, init) => {
        seen = init;
        return res(200);
      }),
    );
    expect(JSON.parse(String(seen?.body))).toEqual({
      host: 'acme.ca',
      key: 'key',
      keyLocation: 'https://acme.ca/key.txt',
      urlList: ['https://acme.ca/a'],
    });
  });

  it('treats 202 as success — it is the normal IndexNow response', async () => {
    const r = await submitBatch(
      indexNowPlan,
      ['https://acme.ca/a'],
      stub(() => res(202)),
    );
    expect(r.ok).toBe(true);
    expect(r.message).toBeUndefined();
  });

  it('explains 403 and 422 as key-file problems, not URL problems', async () => {
    const forbidden = await submitBatch(
      indexNowPlan,
      ['x'],
      stub(() => res(403)),
    );
    expect(forbidden.ok).toBe(false);
    expect(forbidden.message).toMatch(/key file/);

    const unprocessable = await submitBatch(
      indexNowPlan,
      ['x'],
      stub(() => res(422)),
    );
    expect(unprocessable.message).toMatch(/key file host|key does not match/);
  });

  it('reports the URL count so a caller can total across batches', async () => {
    const r = await submitBatch(
      indexNowPlan,
      ['a', 'b', 'c'],
      stub(() => res(200)),
    );
    expect(r.urls).toBe(3);
  });
});

describe('parseServiceAccount', () => {
  it('accepts a well-formed key', () => {
    const a = parseServiceAccount(JSON.stringify({ client_email: 'a@b.iam', private_key: 'PEM' }));
    expect(a).toEqual({ client_email: 'a@b.iam', private_key: 'PEM' });
  });

  it('rejects non-JSON with a message about JSON, not about fields', () => {
    expect(() => parseServiceAccount('not json')).toThrow(/valid JSON/);
  });

  it('rejects a JSON object missing either field', () => {
    expect(() => parseServiceAccount(JSON.stringify({ client_email: 'a' }))).toThrow(/private_key/);
    expect(() => parseServiceAccount(JSON.stringify({ private_key: 'p' }))).toThrow(/client_email/);
  });
});

describe('submitSitemap', () => {
  it('PUTs to the webmasters endpoint with both path segments encoded', async () => {
    let seenUrl = '';
    let seenMethod = '';
    await submitSitemap(
      'tok',
      'sc-domain:acme.ca',
      'https://acme.ca/sitemap-index.xml',
      stub((u, init) => {
        seenUrl = u;
        seenMethod = String(init?.method);
        return res(200);
      }),
    );
    expect(seenMethod).toBe('PUT');
    expect(seenUrl).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aacme.ca/sitemaps/https%3A%2F%2Facme.ca%2Fsitemap-index.xml',
    );
  });

  it('explains a 403 as a property/ownership mismatch', async () => {
    // The likeliest cause by far, and nothing in a bare "403" says so.
    const r = await submitSitemap(
      'tok',
      'sc-domain:acme.ca',
      'https://acme.ca/s.xml',
      stub(() => res(403)),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/matches the Search Console property/);
  });
});

describe('inspectUrl', () => {
  const inspection = (indexStatusResult: Record<string, string>) =>
    stub(() => res(200, { inspectionResult: { indexStatusResult } }));

  it('reports PASS as indexed', async () => {
    const r = await inspectUrl(
      'tok',
      'sc-domain:acme.ca',
      'https://acme.ca/',
      inspection({ verdict: 'PASS', coverageState: 'Submitted and indexed' }),
    );
    expect(r.indexed).toBe(true);
    expect(r.coverageState).toBe('Submitted and indexed');
  });

  /*
   * The one that matters. NEUTRAL covers "discovered — currently not indexed" and
   * "excluded by canonical" — both mean *not indexed*. Reading NEUTRAL as success
   * would make --check pass on exactly the pages it exists to catch.
   */
  it('reports NEUTRAL as NOT indexed', async () => {
    const r = await inspectUrl(
      'tok',
      'sc-domain:acme.ca',
      'https://acme.ca/new',
      inspection({ verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed' }),
    );
    expect(r.indexed).toBe(false);
  });

  it('reports FAIL as not indexed', async () => {
    const r = await inspectUrl('tok', 's', 'u', inspection({ verdict: 'FAIL' }));
    expect(r.indexed).toBe(false);
  });

  it('surfaces an API error instead of reporting indexed', async () => {
    const r = await inspectUrl(
      'tok',
      's',
      'https://acme.ca/',
      stub(() => res(429, 'quota')),
    );
    expect(r.indexed).toBe(false);
    expect(r.error).toMatch(/429/);
  });

  it('reports not-indexed when the response carries no verdict', async () => {
    const r = await inspectUrl(
      'tok',
      's',
      'u',
      stub(() => res(200, {})),
    );
    expect(r.indexed).toBe(false);
    expect(r.verdict).toBeUndefined();
  });
});
