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
import type { IndexingConfig, SitemapEntry, Snapshot } from './types.ts';

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
}

export interface IndexingPlan {
  /** Set when the whole run is refused. Nothing is submitted. */
  blocked?: string;
  /** Always computed; `undefined` when nothing in the config resolves to one. */
  sitemapUrl: string | undefined;
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
  /** The sitemap as it stands now. */
  current: SitemapEntry[];
  /** The previous run's state, if any. */
  previous?: Snapshot | undefined;
  /** `--urls`: submit exactly these, skipping the diff. */
  explicitUrls?: string[] | undefined;
  /** `--all`: submit every URL in the sitemap. */
  all?: boolean | undefined;
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
 * Resolve the sitemap URL.
 *
 * `sitemap-index.xml` is @astrojs/sitemap's default filename and is what
 * `vitops({ sitemap })` registers, so it is the right default here. It resolves to
 * a flat `<urlset>` on a small site, which `parseSitemap` handles by reading the
 * root element rather than the name.
 */
export function resolveSitemapUrl(config: IndexingConfig): string | undefined {
  if (config.sitemapUrl) return config.sitemapUrl;
  if (!config.canonical) return undefined;
  return `${trimSlash(config.canonical)}/sitemap-index.xml`;
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

  const sitemapUrl = resolveSitemapUrl(config);
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
      urls: [],
      reason: 'diff',
      cold: false,
      indexNow: { enabled: false, skip: 'blocked', endpoint: INDEXNOW_ENDPOINT, batches: [] },
      searchConsole: { enabled: false, skip: 'blocked' },
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
   * The lastmod warning.
   *
   * Without per-URL lastmod the diff can still see pages appear and disappear, but
   * it cannot see one change — so an edited page is never resubmitted and the
   * command quietly does less than it appears to. Worth a note every run, because
   * the output otherwise looks identical to the healthy case.
   */
  if (reason === 'diff' || reason === 'cold') {
    const withLastmod = current.filter((e) => e.lastmod).length;
    if (current.length > 0 && withLastmod === 0)
      notes.push(
        'no <lastmod> in the sitemap — only added/removed pages can be detected, never an edit. Wire `gitLastmod()` into your sitemap options, or pass --all.',
      );
    else if (withLastmod < current.length)
      notes.push(
        `${current.length - withLastmod} of ${current.length} sitemap entries have no <lastmod> — edits to those pages cannot be detected.`,
      );
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
    searchConsole = { enabled: false, skip: 'not configured (seo.indexing.searchConsole)' };
  } else if (config.searchConsole.resubmitSitemap === false) {
    searchConsole = {
      enabled: false,
      skip: 'resubmitSitemap is false',
      siteUrl: config.searchConsole.siteUrl,
    };
  } else if (!sitemapUrl) {
    searchConsole = {
      enabled: false,
      skip: 'no sitemapUrl and no domains.canonical to derive one',
      siteUrl: config.searchConsole.siteUrl,
    };
  } else {
    searchConsole = { enabled: true, siteUrl: config.searchConsole.siteUrl };
  }

  return {
    sitemapUrl,
    urls,
    reason,
    cold,
    indexNow,
    searchConsole,
    check,
    notes,
  };
}

/** Render a plan as the human-readable block `--dry` prints. */
export function formatPlan(p: IndexingPlan): string {
  const lines: string[] = [];
  if (p.blocked) {
    lines.push(`✗ blocked — ${p.blocked}`);
    return lines.join('\n');
  }
  lines.push(`sitemap    ${p.sitemapUrl ?? '(none)'}`);
  lines.push(`urls       ${p.urls.length} (${p.reason})`);

  lines.push(
    p.indexNow.enabled
      ? `IndexNow   ${p.indexNow.batches.reduce((n, b) => n + b.length, 0)} URL(s) → ${p.indexNow.endpoint}`
      : `IndexNow   skipped — ${p.indexNow.skip}`,
  );
  lines.push(
    p.searchConsole.enabled
      ? `Search Console  resubmit sitemap → ${p.searchConsole.siteUrl}`
      : `Search Console  skipped — ${p.searchConsole.skip}`,
  );
  for (const n of p.notes) lines.push(`  ! ${n}`);
  return lines.join('\n');
}
