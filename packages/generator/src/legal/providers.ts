/**
 * What the config already tells us about third parties that receive personal
 * information.
 *
 * A privacy policy's riskiest sentence is the one naming service providers: if
 * it says "Plausible" while the site runs Google Analytics, the document is a
 * compliance defect, not a typo. The site config already records which analytics
 * ID is set, whether Turnstile is deployed and where the site is hosted — so the
 * sentence derives from those signals rather than from a hand-maintained string
 * that drifts the moment someone swaps providers.
 *
 * Presence of the key is the signal, matching how `analytics` already works
 * (provider identity is implied by which ID is set, not by an enum).
 *
 * This table is deliberately small and covers only what the schema can imply.
 * Everything else — payment processors, CRMs, mail senders — is declared by the
 * consumer in `legal.privacyPolicy.processors`, which flows through the same
 * pipeline. This is not a directory of the web; it's the set of providers the
 * toolchain itself can vouch for.
 */
import type { SiteConfig } from '../site.ts';

export interface Processor {
  /** The provider as a reader would recognise it. */
  name: string;
  /** Reads after "for": "…to Stripe for payment processing". */
  purpose: string;
  /** Reads inside a sentence: "…including the United States". */
  country?: string | undefined;
  privacyUrl?: string | undefined;
  /**
   * Cookies this provider sets. An empty array is meaningful and not the same as
   * `undefined`: it asserts the provider is cookieless (Plausible), which the
   * cookie notice states positively rather than omitting.
   */
  cookies?: string[] | undefined;
  /** A user-facing opt-out, when the provider offers one. */
  optOut?: string | undefined;
}

/**
 * The providers the config can imply. Keyed for testability — a test can assert
 * a given config resolves to a given key without matching on prose.
 */
export const KNOWN_PROCESSORS = {
  googleAnalytics: {
    name: 'Google Analytics',
    purpose: 'website analytics',
    country: 'the United States',
    privacyUrl: 'https://policies.google.com/privacy',
    cookies: ['_ga', '_gid'],
    optOut: 'https://tools.google.com/dlpage/gaoptout',
  },
  googleTagManager: {
    name: 'Google Tag Manager',
    purpose: 'tag management',
    country: 'the United States',
    privacyUrl: 'https://policies.google.com/privacy',
    cookies: [],
  },
  plausible: {
    name: 'Plausible Analytics',
    purpose: 'website analytics',
    country: 'the European Union',
    privacyUrl: 'https://plausible.io/privacy',
    // Plausible sets no cookies and stores no cross-site identifiers. Stated as
    // an empty list rather than omitted, so the cookie notice can say so.
    cookies: [],
  },
  turnstile: {
    name: 'Cloudflare Turnstile',
    purpose: 'bot protection on forms',
    country: 'the United States',
    privacyUrl: 'https://www.cloudflare.com/privacypolicy/',
    cookies: ['cf_clearance'],
  },
  cloudflare: {
    name: 'Cloudflare',
    purpose: 'website hosting and content delivery',
    country: 'the United States',
    privacyUrl: 'https://www.cloudflare.com/privacypolicy/',
    cookies: [],
  },
  vercel: {
    name: 'Vercel',
    purpose: 'website hosting',
    country: 'the United States',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
    cookies: [],
  },
  netlify: {
    name: 'Netlify',
    purpose: 'website hosting',
    country: 'the United States',
    privacyUrl: 'https://www.netlify.com/privacy/',
    cookies: [],
  },
} satisfies Record<string, Processor>;

export type KnownProcessorKey = keyof typeof KNOWN_PROCESSORS;

/** Substring → hosting provider. `deployment.platform` is a free-form string. */
const HOSTING_PATTERNS: [RegExp, KnownProcessorKey][] = [
  [/cloudflare|workers|pages\.dev/i, 'cloudflare'],
  [/vercel/i, 'vercel'],
  [/netlify/i, 'netlify'],
];

/**
 * Which known providers this config implies, in a stable order (analytics →
 * security → hosting) so the rendered sentence doesn't churn between builds.
 *
 * Returns keys rather than processors so a caller can test the detection
 * independently of the prose attached to it.
 */
export function detectProcessorKeys(site: SiteConfig): KnownProcessorKey[] {
  const keys: KnownProcessorKey[] = [];
  const analytics = site.analytics;
  if (analytics?.googleAnalyticsId) keys.push('googleAnalytics');
  if (analytics?.googleTagManagerId) keys.push('googleTagManager');
  if (analytics?.plausibleDomain) keys.push('plausible');
  if (site.security?.turnstile?.siteKey) keys.push('turnstile');

  const platform = site.deployment?.platform;
  const hosting = platform && HOSTING_PATTERNS.find(([re]) => re.test(platform))?.[1];
  // Turnstile already names Cloudflare; listing it twice reads as sloppy and
  // implies two relationships where there is one.
  if (hosting && !keys.includes(hosting)) keys.push(hosting);
  return keys;
}

/**
 * Every processor this policy must disclose: the ones implied by the config,
 * then the ones the consumer declared.
 *
 * Consumer entries come last and are never deduplicated against the built-ins —
 * an explicit declaration is a statement of fact we have no grounds to drop.
 */
export function resolveProcessors(site: SiteConfig): Processor[] {
  const detected = detectProcessorKeys(site).map((k) => KNOWN_PROCESSORS[k] as Processor);
  const declared = site.legal?.privacyPolicy?.processors ?? [];
  return [...detected, ...declared];
}
