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
  /**
   * Explicit sitemap URL(s). Set, discovery is off and exactly these are read; unset, the CLI
   * discovers them (see `sitemapCandidates`).
   */
  sitemapUrl?: string | string[] | undefined;
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

/**
 * Why a sitemap is being read — drives the label `search notify` prints beside it.
 *
 * - `configured`: listed in `seo.indexing.sitemapUrl` or passed as `--sitemap`.
 * - `astro`: `<canonical>/sitemap-index.xml`, what `@astrojs/sitemap` writes.
 * - `cms`: `<canonical>/sitemap.xml`, what EmDash serves from its database.
 * - `pages`: `<canonical>/pages-sitemap.xml`, the build-time sitemap `vitops()` writes for the
 *   routes a CMS sitemap cannot see (`src/pages`).
 */
export type SitemapRole = 'configured' | 'astro' | 'cms' | 'pages';

/** One sitemap `search notify` looked at, and what it found there. */
export interface SitemapReport {
  url: string;
  role: SitemapRole;
  /** Fetched, parsed and held at least one `<url>`. Only these are submitted and diffed. */
  used: boolean;
  /** Entries found (0 when not `used`). */
  entries: number;
  /** Why it was not used, when it was not: `not found`, `empty`, … */
  skip?: string | undefined;
}
