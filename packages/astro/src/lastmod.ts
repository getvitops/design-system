/**
 * Real per-page `<lastmod>` for the sitemap, derived from git.
 *
 * This is the one lever that reliably moves Google. It is also load-bearing for
 * `vitops indexing`, which decides what to submit by diffing lastmod against the
 * previous build — with no lastmod, that diff can see pages appear and disappear
 * but never see one *change*, so an edited page is never resubmitted.
 *
 * A plain exported helper rather than magic inside the `sitemap` option, because
 * it carries a caveat the caller needs to see: it shells out to `git`, so it
 * returns nothing useful from a shallow CI clone (`fetch-depth: 1` — the default
 * in actions/checkout) or from a tarball with no history. In that case it warns
 * and emits no dates at all.
 *
 *     import vitops, { gitLastmod } from '@getvitops/astro';
 *     export default defineConfig({
 *       site: 'https://acme.ca',
 *       integrations: [vitops({ sitemap: { serialize: await gitLastmod() } })],
 *     });
 *
 * **No date beats a wrong date.** An unmatched URL is left alone rather than
 * stamped with the build time: Google weighs lastmod only while it stays
 * consistent with what actually changed, and a site that stamps every page on
 * every deploy teaches it to stop believing the field — site-wide, not just for
 * the pages that were wrong.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import type { GetvitopsSitemapEntry } from './integration.ts';

const exec = promisify(execFile);

/** Route-bearing sources: file-based pages, and the collections they render. */
const DEFAULT_DIRS = ['src/pages', 'src/content', 'src/data'];

const PAGE_EXT = /\.(astro|md|mdx|markdown|html)$/;
const CONTENT_EXT = /\.(md|mdx|markdown|json|yaml|yml)$/;

export interface GitLastmodOptions {
  /** Directories to read history from (default `src/pages`, `src/content`, `src/data`). */
  dirs?: string[];
  /** Repository root (default `process.cwd()`). */
  cwd?: string;
  /** Called with a human-readable reason when no dates could be derived. */
  onWarn?: (message: string) => void;
}

/**
 * `src/pages/blog/index.astro` → `/blog`; `src/pages/index.astro` → `/`.
 *
 * Dynamic routes return `undefined`: one source file backs many URLs, and its
 * commit date describes the template rather than any of them. Stamping every
 * generated page with the template's date is exactly the "wrong date" case above.
 */
export function routeFromPage(file: string): string | undefined {
  const m = /(?:^|\/)src\/pages\/(.+)$/.exec(file);
  if (!m) return undefined;
  let rest = m[1]!;
  if (!PAGE_EXT.test(rest)) return undefined;
  if (rest.includes('[')) return undefined; // dynamic route
  rest = rest.replace(PAGE_EXT, '');
  if (rest === 'index') return '/';
  rest = rest.replace(/\/index$/, '');
  return `/${rest}`;
}

/** The slug a content entry is most likely published under. */
export function slugFromContent(file: string): string | undefined {
  const m = /(?:^|\/)src\/(?:content|data)\/(.+)$/.exec(file);
  if (!m) return undefined;
  const rest = m[1]!;
  if (!CONTENT_EXT.test(rest)) return undefined;
  const base = rest.split('/').pop()!.replace(CONTENT_EXT, '');
  // `index` names the collection's directory, not a slug of its own.
  return base === 'index' ? undefined : base;
}

const normalise = (pathname: string): string => {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
};

/**
 * Most recent commit date per file, from one `git log` pass.
 *
 * One process rather than one per file: a `git log -1` per page is fine for
 * twenty pages and unusable for two thousand. `--name-only` interleaves each
 * commit's date with its files, and because `git log` is newest-first the first
 * time a path appears is its latest change.
 */
async function commitDates(dirs: string[], cwd: string): Promise<Map<string, string>> {
  const dates = new Map<string, string>();
  const { stdout } = await exec(
    'git',
    ['log', '--date-order', '--pretty=format:%x00%cI', '--name-only', '--', ...dirs],
    { cwd, maxBuffer: 64 * 1024 * 1024 },
  );

  let current: string | undefined;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('\0')) {
      current = line.slice(1).trim();
      continue;
    }
    const file = line.trim();
    if (!file || !current) continue;
    if (!dates.has(file)) dates.set(file, current);
  }
  return dates;
}

/**
 * Build a `serialize` function that stamps `lastmod` from git history.
 *
 * Resolution order per URL: an exact file-based route first, then a unique
 * content slug. "Unique" is doing real work — a slug appearing in two collections
 * is dropped rather than guessed at, since picking either one would be a coin
 * flip presented as a fact.
 */
export async function gitLastmod(
  options: GitLastmodOptions = {},
): Promise<(item: GetvitopsSitemapEntry) => GetvitopsSitemapEntry> {
  const cwd = options.cwd ?? process.cwd();
  const warn = options.onWarn ?? ((m: string) => console.warn(`[vitops] gitLastmod: ${m}`));
  const dirs = (options.dirs ?? DEFAULT_DIRS).filter((d) => existsSync(`${cwd}/${d}`));

  const identity = (item: GetvitopsSitemapEntry) => item;

  if (dirs.length === 0) {
    warn(`none of ${(options.dirs ?? DEFAULT_DIRS).join(', ')} exist — no dates emitted`);
    return identity;
  }

  let dates: Map<string, string>;
  try {
    dates = await commitDates(dirs, cwd);
  } catch (err) {
    warn(`git log failed (${(err as Error).message}) — no dates emitted`);
    return identity;
  }

  if (dates.size === 0) {
    // The shallow-clone case, and the one most likely to go unnoticed: the build
    // succeeds, the sitemap is valid, and every lastmod is simply missing.
    warn(
      'git history has no commits touching your source — a shallow clone? Set fetch-depth: 0 in your checkout step. No dates emitted.',
    );
    return identity;
  }

  const byRoute = new Map<string, string>();
  const bySlug = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const [file, date] of dates) {
    const route = routeFromPage(file);
    if (route) {
      byRoute.set(route, date);
      continue;
    }
    const slug = slugFromContent(file);
    if (!slug) continue;
    if (bySlug.has(slug)) ambiguous.add(slug);
    else bySlug.set(slug, date);
  }
  for (const slug of ambiguous) bySlug.delete(slug);

  /*
   * No coverage warning here on purpose. `serialize` is called once per entry
   * with no completion signal, so any "matched N of M" it emitted would be a
   * running total printed mid-stream. The same fact is reported properly one step
   * later: `vitops indexing` counts entries without a `<lastmod>` and says so
   * against the finished sitemap.
   */
  return (item: GetvitopsSitemapEntry): GetvitopsSitemapEntry => {
    // An explicit lastmod from the caller wins — they know something we inferred.
    if (item.lastmod) return item;

    let pathname: string;
    try {
      pathname = normalise(new URL(item.url).pathname);
    } catch {
      return item;
    }

    const date = byRoute.get(pathname) ?? bySlug.get(pathname.split('/').pop() ?? '');
    return date ? { ...item, lastmod: date } : item;
  };
}
