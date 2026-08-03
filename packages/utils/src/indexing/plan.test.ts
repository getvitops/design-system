import { describe, expect, it } from 'vitest';
import { INDEXNOW_BATCH, plan, resolveKeyLocation, resolveSitemapUrl } from './plan.ts';
import { toSnapshot } from './snapshot.ts';
import type { IndexingConfig, SitemapEntry } from './types.ts';

const CANONICAL = 'https://acme.ca';

// Explicit `undefined` is how a test says "this channel is unconfigured", so the
// override type has to admit it under exactOptionalPropertyTypes.
const config = (
  over: { [K in keyof IndexingConfig]?: IndexingConfig[K] } = {},
): IndexingConfig => ({
  canonical: CANONICAL,
  indexNow: { key: 'abc123def456' },
  searchConsole: { siteUrl: 'sc-domain:acme.ca' },
  ...over,
});

const entry = (path: string, lastmod?: string): SitemapEntry =>
  lastmod ? { loc: `${CANONICAL}${path}`, lastmod } : { loc: `${CANONICAL}${path}` };

const snap = (entries: SitemapEntry[]) =>
  toSnapshot(`${CANONICAL}/sitemap-index.xml`, entries, '2026-08-01T00:00:00Z');

describe('defaults', () => {
  it('derives the sitemap URL from the canonical origin', () => {
    expect(resolveSitemapUrl({ canonical: CANONICAL })).toBe(`${CANONICAL}/sitemap-index.xml`);
    // A trailing slash on the canonical must not produce a double slash.
    expect(resolveSitemapUrl({ canonical: 'https://acme.ca/' })).toBe(
      `${CANONICAL}/sitemap-index.xml`,
    );
  });

  it('prefers an explicit sitemapUrl', () => {
    expect(resolveSitemapUrl({ canonical: CANONICAL, sitemapUrl: 'https://x.test/s.xml' })).toBe(
      'https://x.test/s.xml',
    );
  });

  it('derives the key location from the canonical origin and the key', () => {
    expect(resolveKeyLocation(config())).toBe(`${CANONICAL}/abc123def456.txt`);
  });

  it('has no sitemap URL and no key location without a canonical', () => {
    expect(resolveSitemapUrl({})).toBeUndefined();
    expect(resolveKeyLocation({ indexNow: { key: 'k' } })).toBeUndefined();
  });
});

describe('the noindex gate', () => {
  /*
   * The consequential one. Submitting a staging host to IndexNow publishes it to
   * several engines and invites them to crawl it — a `noindex` directive does not
   * undo having asked.
   */
  it('refuses the whole run when the environment is noindex', () => {
    const p = plan({
      config: config({ robots: 'noindex,nofollow' }),
      current: [entry('/'), entry('/about')],
    });
    expect(p.blocked).toMatch(/noindex/);
    expect(p.urls).toEqual([]);
    expect(p.indexNow.enabled).toBe(false);
    expect(p.searchConsole.enabled).toBe(false);
    expect(p.check).toEqual([]);
  });

  it('blocks regardless of casing or surrounding directives', () => {
    for (const robots of ['NOINDEX', 'max-image-preview:large, noindex', 'noindex'])
      expect(plan({ config: config({ robots }), current: [entry('/')] }).blocked).toBeDefined();
  });

  it('does not block an ordinary index policy', () => {
    const p = plan({ config: config({ robots: 'index,follow' }), current: [entry('/')] });
    expect(p.blocked).toBeUndefined();
  });

  it('does not treat "index,nofollow" as noindex', () => {
    // Word-boundary matching, not substring: `nofollow` must not trip the gate.
    expect(
      plan({ config: config({ robots: 'index,nofollow' }), current: [entry('/')] }).blocked,
    ).toBeUndefined();
  });
});

describe('URL selection', () => {
  it('submits everything and says so when there is no snapshot', () => {
    const p = plan({ config: config(), current: [entry('/', 'a'), entry('/about', 'b')] });
    expect(p.reason).toBe('cold');
    expect(p.cold).toBe(true);
    expect(p.urls).toHaveLength(2);
    expect(p.notes.join(' ')).toMatch(/no previous snapshot/);
  });

  it('submits nothing when no lastmod moved', () => {
    const current = [entry('/', 'a'), entry('/about', 'b')];
    const p = plan({ config: config(), current, previous: snap(current) });
    expect(p.reason).toBe('diff');
    expect(p.urls).toEqual([]);
    expect(p.indexNow.enabled).toBe(false);
  });

  it('submits only the URL whose lastmod moved', () => {
    const previous = snap([entry('/', 'a'), entry('/about', 'b')]);
    const p = plan({
      config: config(),
      current: [entry('/', 'a'), entry('/about', 'B-NEW')],
      previous,
    });
    expect(p.urls).toEqual([`${CANONICAL}/about`]);
  });

  it('treats a URL absent from the snapshot as new', () => {
    const previous = snap([entry('/', 'a')]);
    const p = plan({ config: config(), current: [entry('/', 'a'), entry('/new', 'x')], previous });
    expect(p.urls).toEqual([`${CANONICAL}/new`]);
  });

  it('does not report a removed URL — there is nothing to submit for a dead page', () => {
    const previous = snap([entry('/', 'a'), entry('/gone', 'g')]);
    const p = plan({ config: config(), current: [entry('/', 'a')], previous });
    expect(p.urls).toEqual([]);
  });

  it('--all overrides the diff', () => {
    const current = [entry('/', 'a'), entry('/about', 'b')];
    const p = plan({ config: config(), current, previous: snap(current), all: true });
    expect(p.reason).toBe('all');
    expect(p.urls).toHaveLength(2);
  });

  it('--urls overrides everything, including --all', () => {
    const current = [entry('/', 'a')];
    const p = plan({
      config: config(),
      current,
      previous: snap(current),
      explicitUrls: [`${CANONICAL}/one-off`],
      all: true,
    });
    expect(p.reason).toBe('explicit');
    expect(p.urls).toEqual([`${CANONICAL}/one-off`]);
  });
});

describe('the lastmod warning', () => {
  /*
   * Without lastmod the diff still sees pages appear and disappear, so the command
   * looks healthy while being unable to detect the common case — an edit. The note
   * is the only thing distinguishing the two.
   */
  it('warns loudly when no entry carries a lastmod', () => {
    const current = [entry('/'), entry('/about')];
    const p = plan({ config: config(), current, previous: snap(current) });
    expect(p.notes.join(' ')).toMatch(/no <lastmod>/);
    expect(p.notes.join(' ')).toMatch(/gitLastmod/);
  });

  it('warns about partial coverage with a count', () => {
    const current = [entry('/', 'a'), entry('/about'), entry('/x')];
    const p = plan({ config: config(), current, previous: snap(current) });
    expect(p.notes.join(' ')).toMatch(/2 of 3/);
  });

  it('stays quiet when every entry has a lastmod', () => {
    const current = [entry('/', 'a'), entry('/about', 'b')];
    const p = plan({ config: config(), current, previous: snap(current) });
    expect(p.notes.join(' ')).not.toMatch(/lastmod/);
  });

  it('does not warn when the URL set was given explicitly', () => {
    const p = plan({
      config: config(),
      current: [entry('/')],
      explicitUrls: [`${CANONICAL}/x`],
    });
    expect(p.notes.join(' ')).not.toMatch(/lastmod/);
  });
});

describe('IndexNow', () => {
  it('is skipped, not failed, when unconfigured', () => {
    const p = plan({ config: config({ indexNow: undefined }), current: [entry('/', 'a')] });
    expect(p.indexNow.enabled).toBe(false);
    expect(p.indexNow.skip).toMatch(/not configured/);
    // The other channel is unaffected — one missing credential must not stop the run.
    expect(p.searchConsole.enabled).toBe(true);
  });

  it('drops URLs that are not on the key file host, and names them', () => {
    const p = plan({
      config: config(),
      current: [],
      explicitUrls: [`${CANONICAL}/ok`, 'https://other.test/nope'],
    });
    expect(p.indexNow.batches.flat()).toEqual([`${CANONICAL}/ok`]);
    expect(p.notes.join(' ')).toMatch(/dropped 1 URL/);
  });

  it('is off when every URL was dropped', () => {
    const p = plan({
      config: config(),
      current: [],
      explicitUrls: ['https://other.test/nope'],
    });
    expect(p.indexNow.enabled).toBe(false);
  });

  it('splits a large submission into batches rather than truncating', () => {
    const urls = Array.from({ length: INDEXNOW_BATCH + 5 }, (_, i) => `${CANONICAL}/p/${i}`);
    const p = plan({ config: config(), current: [], explicitUrls: urls });
    expect(p.indexNow.batches).toHaveLength(2);
    expect(p.indexNow.batches.flat()).toHaveLength(urls.length);
  });

  it('is off with an explanation when no key location can be derived', () => {
    const p = plan({
      config: { indexNow: { key: 'k' }, sitemapUrl: 'https://acme.ca/s.xml' },
      current: [],
      explicitUrls: [`${CANONICAL}/a`],
    });
    expect(p.indexNow.enabled).toBe(false);
    expect(p.indexNow.skip).toMatch(/canonical/);
  });
});

describe('Search Console', () => {
  it('resubmits the sitemap even when no URL changed', () => {
    // There is no per-URL submission to gate on — Google exposes none — so the
    // sitemap resubmit is independent of the diff.
    const current = [entry('/', 'a')];
    const p = plan({ config: config(), current, previous: snap(current) });
    expect(p.urls).toEqual([]);
    expect(p.searchConsole.enabled).toBe(true);
  });

  it('honours resubmitSitemap: false', () => {
    const p = plan({
      config: config({ searchConsole: { siteUrl: 'sc-domain:acme.ca', resubmitSitemap: false } }),
      current: [entry('/', 'a')],
    });
    expect(p.searchConsole.enabled).toBe(false);
    expect(p.searchConsole.skip).toMatch(/resubmitSitemap/);
  });

  it('is skipped when unconfigured', () => {
    const p = plan({ config: config({ searchConsole: undefined }), current: [entry('/', 'a')] });
    expect(p.searchConsole.enabled).toBe(false);
    expect(p.indexNow.enabled).toBe(true);
  });
});

describe('check', () => {
  it('passes priorityUrls through', () => {
    const urls = [`${CANONICAL}/`, `${CANONICAL}/services`];
    const p = plan({ config: config({ priorityUrls: urls }), current: [] });
    expect(p.check).toEqual(urls);
  });

  it('is empty when none are declared', () => {
    expect(plan({ config: config(), current: [] }).check).toEqual([]);
  });
});
