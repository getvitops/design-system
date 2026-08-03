/**
 * The indexing module's own option surface.
 *
 * Deliberately structural rather than `SiteConfig['seo']['indexing']` imported
 * from `@getvitops/generator`: the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field, so the CLI's adapter is a flat map — the same arrangement, and for the
 * same reason, as `GetvitopsSeoOptions` in `@getvitops/astro`.
 */

/*
 * Optional fields are written `?: T | undefined` throughout.
 *
 * `exactOptionalPropertyTypes` is on, and these types describe a *parsed JSON
 * config* — the shape `zod/mini` infers for the site-config `seo.indexing` block,
 * where an absent key and an explicit `undefined` are the same thing. Writing
 * `?: T` here would make the CLI's adapter unassignable for no gain in safety.
 */

/** IndexNow submission settings. The key is public by design — see `key`. */
export interface IndexNowConfig {
  /**
   * The IndexNow key. **Not a secret**: the engine fetches it back from
   * `keyLocation` to prove you control the host, so it is published either way.
   */
  key: string;
  /** Absolute URL of the key file. Defaults to `<canonical>/<key>.txt`. */
  keyLocation?: string | undefined;
  /** Endpoint (default `https://api.indexnow.org/indexnow`). */
  endpoint?: string | undefined;
}

/** Google Search Console property settings. The credential never lives here. */
export interface SearchConsoleConfig {
  /** `sc-domain:acme.ca`, or the URL-prefix form `https://acme.ca/`. */
  siteUrl: string;
  /** Re-submit the sitemap on each run (default true). */
  resubmitSitemap?: boolean | undefined;
}

/** Everything `plan()` needs to decide what to do. */
export interface IndexingConfig {
  /** `domains.canonical` — the origin every default is derived from. */
  canonical?: string | undefined;
  /** Overrides the derived `<canonical>/sitemap-index.xml`. */
  sitemapUrl?: string | undefined;
  indexNow?: IndexNowConfig | undefined;
  searchConsole?: SearchConsoleConfig | undefined;
  /** Pages `--check` verifies. Explicit because URL Inspection is quota-bound. */
  priorityUrls?: string[] | undefined;
  /**
   * The resolved environment's robots policy. A value containing `noindex` blocks
   * the entire run — see `plan()`.
   */
  robots?: string | undefined;
}

/** One `<url>` (or `<sitemap>`) entry. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

/** The previous run's sitemap state, as written by `writeSnapshot`. */
export interface Snapshot {
  version: 1;
  sitemapUrl: string;
  takenAt: string;
  /** `loc` → `lastmod`, or `''` when the entry carried none. */
  entries: Record<string, string>;
}
