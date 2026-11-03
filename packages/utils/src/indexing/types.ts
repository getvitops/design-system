/**
 * The indexing module's own option surface.
 *
 * The `IndexNow` and `SearchConsole` blocks are the schema's own types, from `@getvitops/config`.
 * `IndexingConfig` is NOT the `seo.indexing` block: it adds the origin and robots policy the CLI
 * resolves before planning.
 */

/*
 * Optional fields are written `?: T | undefined` throughout.
 *
 * `exactOptionalPropertyTypes` is on, and these types describe a *parsed JSON
 * config* — the shape `@zod/mini` infers for the site-config `seo.indexing` block,
 * where an absent key and an explicit `undefined` are the same thing. Writing
 * `?: T` here would make the CLI's adapter unassignable for no gain in safety.
 */

import type { IndexNowConfig, SearchConsoleConfig } from '@getvitops/config';

// The two leaf blocks are the config schema's own types (`@getvitops/config`), re-exported so this
// module stays the one place indexing's types are looked up. `IndexingConfig` below is NOT the
// schema's `seo.indexing` block: it is that block plus the derived origin and robots policy the
// CLI resolves before planning, so it stays a hand-written shape built from the two.
export type { IndexNowConfig, SearchConsoleConfig };

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
