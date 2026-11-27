/**
 * Where a build learns its public origin, for Astro's `site`.
 *
 * Block images only become a responsive AVIF `srcset` when the image service knows the origin the
 * media is served from (`BlockImage` reads `Astro.site`). A prerendered page has no real request,
 * so without a `site` the origin is `localhost`, the service hands the URL back unchanged, and the
 * page ships the full-size original with no width or height. That failure is silent, which is why
 * the origin is derived here rather than left for each site to remember.
 *
 * Precedence: an explicit Astro `site` (the site's own say) wins, then `EMDASH_SITE_URL` (what the
 * deploy workflow exports per environment), then the config's `site.environments[env].url`, then
 * `site.domains.canonical` for production. Placeholder hosts are skipped: authorizing
 * `example.com` would be worse than authorizing nothing.
 */

export type SiteOriginSource = 'env' | 'environment' | 'canonical';

export interface SiteOriginInput {
  /** `process.env.EMDASH_SITE_URL`. */
  env?: string | undefined;
  /** `site.environments[siteEnv].url`. */
  environmentUrl?: string | undefined;
  /** `site.domains.canonical`, used for `production` only. */
  canonical?: string | undefined;
  siteEnv: string;
}

export interface SiteOrigin {
  origin: string;
  source: SiteOriginSource;
}

const PLACEHOLDER_HOST = /(^|\.)(example\.(com|org|net)|invalid|localhost)$|\.example$/i;

/** `https://host` for a usable public origin, otherwise `undefined`. */
export function usableOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (PLACEHOLDER_HOST.test(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** The origin this build should treat as its own, and where it came from. */
export function resolveSiteOrigin(input: SiteOriginInput): SiteOrigin | undefined {
  const env = usableOrigin(input.env);
  if (env) return { origin: env, source: 'env' };
  const environment = usableOrigin(input.environmentUrl);
  if (environment) return { origin: environment, source: 'environment' };
  if (input.siteEnv === 'production') {
    const canonical = usableOrigin(input.canonical);
    if (canonical) return { origin: canonical, source: 'canonical' };
  }
  return undefined;
}
