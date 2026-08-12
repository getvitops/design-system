/**
 * `robots.txt`, generated from the same fact the indexing gate and the
 * `<meta name="robots">` tag already read.
 *
 * Before this, nothing in the toolchain emitted one at all — a staging
 * environment with `robots: "noindex,nofollow"` got a `<meta>` tag and a
 * blocked `search notify` run, but a crawler reading `/robots.txt` directly
 * saw nothing and was free to index it anyway. `plan()`
 * (`@getvitops/utils/indexing`) already treats `noindex` in the resolved
 * environment's directive as a hard stop for notifying search engines; this is
 * the same fact, read the same way, applied to the file crawlers actually ask
 * for first.
 *
 * A sibling of `generateLegal`, not a `generate()` format: this renders from a
 * **`Config`** (a `site.environments` entry), not a `DesignSystem`, so bolting
 * it onto `generate()` would be a format that ignores its own input.
 *
 * Pure: no filesystem, no clock, no shared state. The CLI writes it to stdout
 * or `--out`; the Astro integration writes `public/robots.txt` directly,
 * mirroring how it already writes the IndexNow key file.
 */
import { resolveSitemapUrl } from '@getvitops/utils/indexing';
import type { Config } from './config.ts';

export interface RenderRobotsOptions {
  /** Which `site.environments` entry to render for. Default `'production'`. */
  env?: string;
}

/**
 * A directive string (`site.environments[env].robots` or `site.seo.robots`)
 * blocks indexing if it contains `noindex` — matching `plan()`'s own check in
 * `@getvitops/utils/indexing`, so the two can't read the same fact two ways.
 */
function isBlocked(directive: string | undefined): boolean {
  return /noindex/i.test(directive ?? '');
}

/**
 * Render `robots.txt` for one environment.
 *
 * A blocked environment gets `Disallow: /` for every user agent and no sitemap
 * line — publishing the sitemap of a site asking not to be indexed would be
 * the more damaging way to get this wrong, handing every listed URL to a
 * crawler that then finds itself blocked from all of them, but has already
 * seen where they are. An allowed environment gets a permissive robots.txt
 * plus a `Sitemap:` line, using the exact URL `vitops search notify` would
 * submit — `site.seo.indexing.sitemapUrl`, or `<canonical>/sitemap-index.xml`,
 * the same default `@astrojs/sitemap` produces.
 */
export function renderRobotsTxt(cfg: Config, options: RenderRobotsOptions = {}): string {
  const envName = options.env ?? 'production';
  const site = cfg.site;
  const env = site.environments?.[envName];
  const directive = env?.robots ?? site.seo?.robots;

  const lines = ['User-agent: *'];

  if (isBlocked(directive)) {
    lines.push('Disallow: /');
    return lines.join('\n') + '\n';
  }

  lines.push('Allow: /');

  const sitemapUrl = resolveSitemapUrl({
    canonical: env?.url ?? site.domains?.canonical,
    sitemapUrl: site.seo?.indexing?.sitemapUrl,
  });
  if (sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`);

  return lines.join('\n') + '\n';
}
