/**
 * Every decision `vitops search notify` makes, as one pure function.
 *
 * Pure in the load-bearing sense: no `fetch`, no `fs`, no clock. Everything the
 * command could get wrong — submitting a staging URL, submitting nothing because a
 * cache was cold, submitting a URL IndexNow will reject for the wrong host — is
 * decided here and asserted in `plan.test.ts`. The I/O modules beside this one do
 * what they are told and nothing else.
 *
 * That split is the same one `@getvitops/core`'s consent store makes against its
 * DOM wiring, for the same reason: the consequential logic has to be testable
 * without the environment it runs in.
 */
import type {
  IndexingConfig,
  SitemapEntry,
  SitemapReport,
  SitemapRole,
  Snapshot,
} from './types.ts';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * IndexNow's own cap per submission. Batches larger than this are split rather
 * than truncated — a silently dropped tail is the failure mode this command is
 * meant to eliminate, not reproduce.
 */
export const INDEXNOW_BATCH = 10_000;

/** Why the URL set is what it is. */
export type UrlReason = 'explicit' | 'all' | 'cold' | 'diff';

/** A channel's decision: on, or off with a stated reason. */
export interface ChannelPlan {
  enabled: boolean;
  /** Why it's off. Present iff `enabled` is false. */
  skip?: string;
}

export interface IndexNowPlan extends ChannelPlan {
  endpoint: string;
  keyLocation?: string | undefined;
  key?: string | undefined;
  host?: string | undefined;
  /** URL batches, each within `INDEXNOW_BATCH`. */
  batches: string[][];
}

export interface SearchConsolePlan extends ChannelPlan {
  siteUrl?: string | undefined;
  /** Every sitemap to resubmit — one `sitemaps.submit` each. */
  sitemapUrls: string[];
}

export interface IndexingPlan {
  /** Set when the whole run is refused. Nothing is submitted. */
  blocked?: string;
  /** The first sitemap in use; `undefined` when nothing in the config resolves to one. */
  sitemapUrl: string | undefined;
  /** Every sitemap looked at, used or not — what the plan prints so nothing is submitted unseen. */
  sitemaps: SitemapReport[];
  /** URLs that changed and should be submitted. */
  urls: string[];
  reason: UrlReason;
  /** No usable previous snapshot — `urls` is everything. */
  cold: boolean;
  indexNow: IndexNowPlan;
  searchConsole: SearchConsolePlan;
  /** URLs `--check` will inspect. */
  check: string[];
  /** Things the operator needs to read. Printed by `--dry` and by a real run. */
  notes: string[];
}

export interface PlanInput {
  config: IndexingConfig;
  current: SitemapEntry[];
  previous?: Snapshot | undefined;
  /** `--urls`: submit exactly these, skipping the diff. */
  explicitUrls?: string[] | undefined;
  /** `--all`: submit every URL in the sitemap. */
  all?: boolean | undefined;
  /**
   * What reading the sitemaps found. Supplied by the CLI (which did the fetching); absent in a
   * caller that only has `config.sitemapUrl`, in which case the configured URLs stand in.
   */
  sitemaps?: SitemapReport[] | undefined;
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Resolve the sitemap URLs a config names, without looking at the network.
 *
 * Explicit wins and is exact: a string or a list, each one `configured`. Unset, this is the
 * Astro default — `sitemap-index.xml` is `@astrojs/sitemap`'s filename and what
 * `vitops({ sitemap })` registers; it resolves to a flat `<urlset>` on a small site, which
 * `parseSitemap` handles by reading the root element rather than the name. `vitops robots` uses
 * this directly: it cannot probe, so it states what a build is known to produce.
 */
export function resolveSitemapUrls(config: IndexingConfig): string[] {
  const explicit = config.sitemapUrl;
  if (explicit) return Array.isArray(explicit) ? explicit : [explicit];
  if (!config.canonical) return [];
  return [`${trimSlash(config.canonical)}/sitemap-index.xml`];
}

/** The first of `resolveSitemapUrls` — the sitemap a single-sitemap caller means. */
export function resolveSitemapUrl(config: IndexingConfig): string | undefined {
  return resolveSitemapUrls(config)[0];
}

/**
 * Every sitemap worth looking for, in the order they are read.
 *
 * Explicit `sitemapUrl` turns discovery off — an author who lists URLs gets exactly those. Unset,
 * three conventional places, each judged by whether it exists and holds a `<url>`:
 *
 * - `sitemap-index.xml` — Astro (`@astrojs/sitemap`).
 * - `sitemap.xml` — EmDash, which serves a database-driven index there.
 * - `pages-sitemap.xml` — the companion `vitops()` writes for `src/pages` routes an EmDash
 *   sitemap cannot see. The name must not match `sitemap-*.xml`: EmDash claims that route
 *   pattern, and a file under it silently loses to the CMS's own document.
 *
 * Nothing here is "required": a CMS-only site has no pages sitemap, and a 404 there is the
 * expected answer rather than a failure. The CLI refuses to run only when none exist.
 */
export function sitemapCandidates(config: IndexingConfig): { url: string; role: SitemapRole }[] {
  if (config.sitemapUrl)
    return resolveSitemapUrls(config).map((url) => ({ url, role: 'configured' }));
  if (!config.canonical) return [];
  const origin = trimSlash(config.canonical);
  return [
    { url: `${origin}/sitemap-index.xml`, role: 'astro' },
    { url: `${origin}/sitemap.xml`, role: 'cms' },
    { url: `${origin}/pages-sitemap.xml`, role: 'pages' },
  ];
}

/**
 * The words printed beside a sitemap.
 *
 * `pages` is "required for non-EmDash content" because that is the reason it exists, and the
 * reason a reader seeing a second sitemap in Search Console needs. `cms` is only called EmDash
 * once the pages companion is in use: `/sitemap.xml` alone could be any generator, and naming a
 * platform the evidence doesn't support would be a guess printed as a fact.
 */
export function describeSitemap(r: SitemapReport, all: SitemapReport[]): string {
  switch (r.role) {
    case 'pages':
      return 'required for non-EmDash content (src/pages)';
    case 'cms':
      return all.some((o) => o.role === 'pages' && o.used) ? 'EmDash content' : 'derived';
    case 'astro':
      return 'Astro pages';
    case 'configured':
      return 'configured';
  }
}

/** Resolve the IndexNow key file URL. */
export function resolveKeyLocation(config: IndexingConfig): string | undefined {
  const indexNow = config.indexNow;
  if (!indexNow) return undefined;
  if (indexNow.keyLocation) return indexNow.keyLocation;
  if (!config.canonical) return undefined;
  return `${trimSlash(config.canonical)}/${indexNow.key}.txt`;
}

/** Which URLs differ from the snapshot. */
function diff(current: SitemapEntry[], previous: Snapshot): string[] {
  const changed: string[] = [];
  for (const e of current) {
    const before = previous.entries[e.loc];
    // Absent from the snapshot → new. Present with a different lastmod → updated.
    // A removed URL is deliberately not reported: there is nothing to submit for a
    // page that no longer exists, and IndexNow has no deletion semantics.
    if (before === undefined || before !== (e.lastmod ?? '')) changed.push(e.loc);
  }
  return changed;
}

/**
 * Decide what this run should do.
 *
 * Ordering of the URL-selection rules matters and is not arbitrary: an explicit
 * `--urls` is an operator overriding the tool, `--all` is an operator overriding
 * the diff, a cold snapshot is the tool having no basis to narrow, and the diff is
 * the normal path. Each is reported in `reason` so `--dry` explains itself.
 */
export function plan(input: PlanInput): IndexingPlan {
  const { config, current, previous, explicitUrls, all } = input;
  const notes: string[] = [];

  const sitemaps: SitemapReport[] =
    input.sitemaps ??
    resolveSitemapUrls(config).map((url) => ({
      url,
      role: 'configured' as const,
      used: true,
      entries: current.length,
    }));
  const used = sitemaps.filter((r) => r.used).map((r) => r.url);
  const sitemapUrl = used[0] ?? resolveSitemapUrl(config);
  const check = config.priorityUrls ?? [];

  /*
   * The robots gate, before anything else.
   *
   * `environments.<env>.robots` already states whether a deployment is meant to be
   * indexed. Submitting a `noindex` environment's URLs to IndexNow is not a
   * no-op that the directive later undoes — it publishes the staging host to
   * several search engines and their AI crawlers, and asks them to come look. The
   * config knows the answer, so the tool must not need to be told twice.
   */
  if (config.robots && /\bnoindex\b/i.test(config.robots)) {
    return {
      blocked: `environment robots policy is "${config.robots}" — refusing to ask search engines to index an environment marked noindex`,
      sitemapUrl,
      sitemaps,
      urls: [],
      reason: 'diff',
      cold: false,
      indexNow: { enabled: false, skip: 'blocked', endpoint: INDEXNOW_ENDPOINT, batches: [] },
      searchConsole: { enabled: false, skip: 'blocked', sitemapUrls: [] },
      check: [],
      notes,
    };
  }

  const cold = !explicitUrls && !all && !previous;

  let urls: string[];
  let reason: UrlReason;
  if (explicitUrls?.length) {
    urls = explicitUrls;
    reason = 'explicit';
  } else if (all) {
    urls = current.map((e) => e.loc);
    reason = 'all';
  } else if (!previous) {
    urls = current.map((e) => e.loc);
    reason = 'cold';
    notes.push(
      `no previous snapshot — treating all ${urls.length} URLs as changed. Persist ${'`.vitops/`'} between runs (a CI cache) so later runs submit only what moved.`,
    );
  } else {
    urls = diff(current, previous);
    reason = 'diff';
  }

  /*
   * The foreign-sitemap check.
   *
   * A 404 fails loudly; a sitemap that is well-formed and *someone else's* does
   * not. A downstream site's sitemap route collided with its CMS's, so the URL
   * returned 200 with a valid document listing pages that were not theirs, and
   * the run reported a healthy cold submission. Nothing downstream can catch
   * this — the URLs parse, the diff works, the submission succeeds.
   *
   * Compared against the resolved environment origin rather than the canonical,
   * for the same reason `toIndexingConfig` derives the origin that way: on a
   * staging run the canonical IS the foreign host.
   */
  if (config.canonical && urls.length) {
    const own = hostOf(`${trimSlash(config.canonical)}/`);
    const foreign = [...new Set(urls.map(hostOf).filter((h): h is string => !!h && h !== own))];
    if (foreign.length)
      notes.push(
        `sitemap contains ${urls.length - urls.filter((u) => hostOf(u) === own).length} URL(s) on ` +
          `${foreign.join(', ')} rather than ${own} — check that ${used.join(', ') || sitemapUrl} ` +
          `is this site's own sitemap and not another route answering that path.`,
      );
  }

  /*
   * The lastmod warning.
   *
   * Without per-URL lastmod the diff can still see pages appear and disappear, but
   * it cannot see one change — so an edited page is never resubmitted and the
   * command quietly does less than it appears to. Worth a note every run, because
   * the output otherwise looks identical to the healthy case.
   */
  if (reason === 'diff' || reason === 'cold') {
    const undated = current.filter((e) => !e.lastmod);
    if (current.length > 0 && undated.length === current.length)
      notes.push(
        'no <lastmod> in the sitemap — only added/removed pages can be detected, never an edit. ' +
          'Routes outside the CMS get git dates from `vitops({ sitemap })` (an EmDash site writes ' +
          '`pages-sitemap.xml` for them); on a plain Astro site pass `gitLastmod()` as the sitemap ' +
          '`serialize`. Or pass --all.',
      );
    else if (undated.length > 0) {
      const shown = undated.slice(0, 3).map((e) => e.loc);
      const more = undated.length - shown.length;
      notes.push(
        `${undated.length} of ${current.length} sitemap entries have no <lastmod> — edits to those pages cannot be detected ` +
          `(${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}). ` +
          'A page outside the CMS needs `vitops({ sitemap })` so it is listed with a git date; a CMS entry is dated by the CMS.',
      );
    }
  }

  // ── IndexNow ────────────────────────────────────────────────────────────────
  const keyLocation = resolveKeyLocation(config);
  const keyHost = keyLocation ? hostOf(keyLocation) : undefined;
  let indexNow: IndexNowPlan;
  if (!config.indexNow) {
    indexNow = {
      enabled: false,
      skip: 'not configured (seo.indexing.indexNow)',
      endpoint: INDEXNOW_ENDPOINT,
      batches: [],
    };
  } else if (!keyLocation) {
    indexNow = {
      enabled: false,
      skip: 'no keyLocation and no domains.canonical to derive one',
      endpoint: config.indexNow.endpoint ?? INDEXNOW_ENDPOINT,
      key: config.indexNow.key,
      batches: [],
    };
  } else {
    /*
     * IndexNow requires every URL in a submission to share the key file's host.
     * A mixed batch is rejected whole, so the off-host URLs are dropped here and
     * named — silently sending them would fail the on-host ones too.
     */
    const onHost = urls.filter((u) => hostOf(u) === keyHost);
    const offHost = urls.length - onHost.length;
    if (offHost > 0)
      notes.push(
        `IndexNow: dropped ${offHost} URL(s) not on ${keyHost} — a submission must match its key file's host.`,
      );
    indexNow = {
      enabled: onHost.length > 0,
      ...(onHost.length === 0 ? { skip: 'no URLs to submit' } : {}),
      endpoint: config.indexNow.endpoint ?? INDEXNOW_ENDPOINT,
      keyLocation,
      key: config.indexNow.key,
      ...(keyHost ? { host: keyHost } : {}),
      batches: chunk(onHost, INDEXNOW_BATCH),
    };
  }

  // ── Search Console ──────────────────────────────────────────────────────────
  // Independent of `urls`: resubmitting the sitemap is what tells Google to
  // re-read it, and it is worth doing whenever the sitemap was rebuilt — there is
  // no per-URL submission to gate on, because Google exposes none.
  let searchConsole: SearchConsolePlan;
  if (!config.searchConsole) {
    searchConsole = {
      enabled: false,
      skip: 'not configured (seo.indexing.searchConsole)',
      sitemapUrls: [],
    };
  } else if (config.searchConsole.resubmitSitemap === false) {
    searchConsole = {
      enabled: false,
      skip: 'resubmitSitemap is false',
      siteUrl: config.searchConsole.siteUrl,
      sitemapUrls: [],
    };
  } else if (used.length === 0) {
    searchConsole = {
      enabled: false,
      skip: 'no sitemapUrl and no domains.canonical to derive one',
      siteUrl: config.searchConsole.siteUrl,
      sitemapUrls: [],
    };
  } else {
    searchConsole = { enabled: true, siteUrl: config.searchConsole.siteUrl, sitemapUrls: used };
  }

  return {
    sitemapUrl,
    sitemaps,
    urls,
    reason,
    cold,
    indexNow,
    searchConsole,
    check,
    notes,
  };
}

/**
 * The `sitemaps` block: every sitemap looked at, why it is there, and what was found.
 *
 * One line per sitemap so a second one in Search Console is never a surprise, and an absent
 * companion is said once rather than left to be inferred from a missing line.
 */
function formatSitemaps(sitemaps: SitemapReport[]): string[] {
  if (sitemaps.length === 0) return ['sitemaps   (none)'];
  const used = sitemaps.filter((r) => r.used);
  const lines: string[] = [];
  const width = Math.max(...used.map((r) => r.url.length), 0);
  used.forEach((r, i) => {
    lines.push(
      `${i === 0 ? 'sitemaps  ' : '          '} ${r.url.padEnd(width)}  ${describeSitemap(r, sitemaps)} · ${r.entries} url${r.entries === 1 ? '' : 's'}`,
    );
  });
  if (used.length === 0) lines.push('sitemaps   (none found)');
  const pages = sitemaps.find((r) => r.role === 'pages');
  if (pages && !pages.used && pages.skip === 'not found')
    lines.push(
      `           ${pages.url.split('/').pop()} not found — no non-EmDash content, the other sitemap covers the site`,
    );
  else if (pages && !pages.used)
    lines.push(`           ${pages.url.split('/').pop()} skipped — ${pages.skip}`);
  return lines;
}

/** Render a plan as the human-readable block `--dry` prints. */
export function formatPlan(p: IndexingPlan): string {
  const lines: string[] = [];
  if (p.blocked) {
    lines.push(`✗ blocked — ${p.blocked}`);
    return lines.join('\n');
  }
  lines.push(...formatSitemaps(p.sitemaps));
  lines.push(`urls       ${p.urls.length} (${p.reason})`);

  lines.push(
    p.indexNow.enabled
      ? `IndexNow   ${p.indexNow.batches.reduce((n, b) => n + b.length, 0)} URL(s) → ${p.indexNow.endpoint}`
      : `IndexNow   skipped — ${p.indexNow.skip}`,
  );
  lines.push(
    p.searchConsole.enabled
      ? `Search Console  resubmit ${p.searchConsole.sitemapUrls.length} sitemap(s) → ${p.searchConsole.siteUrl}`
      : `Search Console  skipped — ${p.searchConsole.skip}`,
  );
  for (const n of p.notes) lines.push(`  ! ${n}`);
  return lines.join('\n');
}
