/**
 * `vitops setup turnstile` — create a Cloudflare Turnstile widget and record its public site
 * key in `site.json`.
 *
 * A separate subpath (`@getvitops/utils/turnstile`), matching `./ads` and `./hosting`. It is
 * build-time tooling, unlike `@getvitops/utils/security` (the Worker-side verifier): keep the
 * two apart so a conversion route never pulls this in.
 *
 * The layering is the repo's usual one: `plan.ts` decides everything and touches nothing;
 * `cloudflare.ts` executes and decides nothing.
 */
export { MAX_DOMAINS, formatPlan, formatSummary, hasDrift, plan } from './plan.ts';
export type { StepAction, StepPlan, StepStatus, TurnstilePlan, TurnstileResult } from './plan.ts';
export { createWidget, listWidgets, resolveAccountId } from './cloudflare.ts';
export type { TurnstileSetup, TurnstileState, WidgetSummary } from './types.ts';

/**
 * Hostnames a widget should cover, from the site config: the canonical domain and every
 * environment's URL. Cloudflare matches subdomains too, so `example.com` already covers
 * `dev.example.com`. Deduplicated, lowercase, no scheme or port. `localhost` is never added:
 * Cloudflare publishes always-pass test keys for local development.
 */
export function deriveDomains(site: {
  domains?: { canonical?: string | undefined } | undefined;
  environments?: Record<string, { url?: string | undefined } | undefined> | undefined;
}): string[] {
  const urls = [
    site.domains?.canonical,
    ...Object.values(site.environments ?? {}).map((e) => e?.url),
  ];
  const hosts = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host && host !== 'localhost') hosts.add(host);
    } catch {
      // a malformed URL is the config validator's business, not a reason to create a widget for it
    }
  }
  // Drop hostnames already covered by a parent in the set (dev.example.com under example.com).
  return [...hosts].filter((h) => ![...hosts].some((p) => p !== h && h.endsWith(`.${p}`)));
}

/**
 * Merge the site key into a **raw, on-disk** config object — the rule `ads setup`'s
 * `patchRaw` follows: never write from the resolved object, so `extends` and shorthand
 * shapes are not normalised into a copy nothing builds from. Everything outside
 * `site.security.turnstile.siteKey` is left exactly as it was.
 */
export function patchSiteKey(raw: unknown, siteKey: string): unknown {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw))
    throw new Error('config is not an object');
  const root = raw as Record<string, unknown>;
  const site = (root['site'] ?? {}) as Record<string, unknown>;
  const security = (site['security'] ?? {}) as Record<string, unknown>;
  const turnstile = (security['turnstile'] ?? {}) as Record<string, unknown>;
  return {
    ...root,
    site: { ...site, security: { ...security, turnstile: { ...turnstile, siteKey } } },
  };
}
