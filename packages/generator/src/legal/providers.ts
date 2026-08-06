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
import { AD_PLATFORMS, AD_PROVIDER_KEYS } from '@getvitops/utils/ads';
import type { Config } from '../config.ts';

/** One place a provider holds information, and which information if not all of it. */
export interface ProcessorStorage {
  /** Reads inside a sentence: "…including the United States". */
  country: string;
  /**
   * Reads after "in the case of". Present means this location holds only SOME of
   * what the provider receives, which is a narrower claim than an unscoped entry —
   * so the template gives it its own sentence rather than folding it into the list,
   * where a reader would take it to cover everything.
   */
  scope?: string | undefined;
}

export interface Processor {
  /** The provider as a reader would recognise it. */
  name: string;
  /** Reads after "for": "…to Stripe for payment processing". */
  purpose: string;
  /**
   * Shorthand asserting BOTH `storage` and `operatorCountry` are this one country.
   *
   * Kept for the common case (and because it is public API), but note it is the
   * field whose *meaning* was never defined — its old doc comment described how it
   * READ, not what it asserted, which is how one string came to stand for two
   * different facts. Prefer the explicit pair when they differ.
   */
  country?: string | undefined;
  /**
   * Where the information actually rests. Feeds the "stored or processed outside
   * of <jurisdiction>" disclosure and nothing else.
   */
  storage?: ProcessorStorage[] | undefined;
  /**
   * The jurisdiction that can compel this provider to produce the information —
   * where it is established, or from which it is controlled. Reads after "the laws
   * of".
   *
   * A separate fact from `storage`, and the one privacy law actually turns on: the
   * OPC's concern is foreign *access*, not foreign storage. Azure in a Canadian
   * region is `storage: [{ country: 'Canada' }]`, `operatorCountry: 'the United
   * States'` — the bytes never move and US law still reaches them.
   */
  operatorCountry?: string | undefined;
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
  clarity: {
    name: 'Microsoft Clarity',
    purpose: 'session replay and heatmaps',
    country: 'the United States',
    privacyUrl: 'https://privacy.microsoft.com/privacystatement',
    // Clarity records what a visitor does on the page, not just that they were
    // here, so the purpose says "session replay" rather than "analytics" — a
    // reader deciding whether to consent needs to know they may be recorded.
    cookies: ['_clck', '_clsk', 'MUID'],
    optOut: 'https://privacy.microsoft.com/privacystatement',
  },
  // Matomo appears twice on purpose: whether it sets cookies is a *configuration*
  // choice (`analytics.matomo.cookies`), and the notice says something materially
  // different in each case. One entry with a conditional cookie list would put
  // that branch in the prose layer, where the rule is that templates own wording
  // and never facts.
  matomo: {
    name: 'Matomo',
    purpose: 'website analytics',
    privacyUrl: 'https://matomo.org/privacy-policy/',
    cookies: ['_pk_id', '_pk_ses'],
  },
  matomoCookieless: {
    name: 'Matomo',
    purpose: 'website analytics',
    privacyUrl: 'https://matomo.org/privacy-policy/',
    // `disableCookies` is on: Matomo stores no identifier on the device. The
    // empty list is the assertion — see the Processor.cookies note above.
    cookies: [],
  },
  // ── Edge / hosting: operator jurisdiction, NOT storage ──────────────────────
  //
  // These four asserted `country: 'the United States'` into a sentence that says
  // "stored or processed in" — a claim about the wrong fact. Cloudflare is anycast:
  // a request from Toronto is answered from a Toronto PoP, and Workers/R2 have
  // residency controls the config cannot see. Vercel and Netlify are region-
  // configurable in the same way.
  //
  // What is true regardless of which PoP or region served the request is that a US
  // company can be compelled under US law. So that is what they now assert, and
  // they assert nothing about where the bytes rest. This generalises the rule the
  // Matomo note below already stated: "we don't know" is a fact. A consumer who
  // pins a region should declare `storage` on a processor of their own.
  turnstile: {
    name: 'Cloudflare Turnstile',
    purpose: 'bot protection on forms',
    operatorCountry: 'the United States',
    privacyUrl: 'https://www.cloudflare.com/privacypolicy/',
    cookies: ['cf_clearance'],
  },
  cloudflare: {
    name: 'Cloudflare',
    purpose: 'website hosting and content delivery',
    operatorCountry: 'the United States',
    privacyUrl: 'https://www.cloudflare.com/privacypolicy/',
    cookies: [],
  },
  vercel: {
    name: 'Vercel',
    purpose: 'website hosting',
    operatorCountry: 'the United States',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
    cookies: [],
  },
  netlify: {
    name: 'Netlify',
    purpose: 'website hosting',
    operatorCountry: 'the United States',
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
export function detectProcessorKeys(cfg: Config): KnownProcessorKey[] {
  const site = cfg.site;
  const keys: KnownProcessorKey[] = [];
  const analytics = site.analytics;
  if (analytics?.googleAnalyticsId) keys.push('googleAnalytics');
  if (analytics?.googleTagManagerId) keys.push('googleTagManager');
  if (analytics?.plausibleDomain) keys.push('plausible');
  if (analytics?.clarityId) keys.push('clarity');
  // Cookieless is the default, matching the tag the Astro integration emits
  // (`_paq.push(['disableCookies'])` unless `cookies: true`). The two must agree:
  // a notice claiming no cookies while the tag sets them is the defect this whole
  // table exists to prevent.
  if (analytics?.matomo) keys.push(analytics.matomo.cookies ? 'matomo' : 'matomoCookieless');
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
export function resolveProcessors(cfg: Config): Processor[] {
  const detected = detectProcessorKeys(cfg).map((k) =>
    matomoLocation(KNOWN_PROCESSORS[k] as Processor, cfg.site),
  );
  const declared = cfg.site.legal?.privacyPolicy?.processors ?? [];
  return [...detected, ...adProcessors(cfg), ...declared].map(desugarCountry);
}

/**
 * The ad platforms `site.ads` links this site to, as processors.
 *
 * Derived from `AD_PLATFORMS` rather than written out here, because the cookie
 * names, the privacy URL and the opt-out are the *same facts* `vitops ads tags`
 * writes into `data-consent-cookies` — and the one failure that matters is those
 * two disagreeing. A pixel that sets `_fbp` while the notice omits it is a
 * compliance defect, and a revoke that clears a cookie the notice never mentioned
 * is the same defect seen from the other end.
 *
 * `enabled: false` keeps a property on record without emitting its tag, so nothing
 * is set and nothing is disclosed. Everything else with an id is live.
 */
function adProcessors(cfg: Config): Processor[] {
  const ads = cfg.site.ads ?? {};
  return AD_PROVIDER_KEYS.filter((provider) => {
    const entry = ads[provider];
    return entry != null && entry.enabled !== false && (entry.pixelId ?? entry.accountId) != null;
  }).map((provider) => {
    const platform = AD_PLATFORMS[provider];
    return {
      name: platform.name,
      purpose: 'advertising measurement and retargeting',
      operatorCountry: platform.operatorCountry,
      privacyUrl: platform.tag.privacyUrl,
      cookies: platform.tag.cookies,
      ...(platform.tag.optOut ? { optOut: platform.tag.optOut } : {}),
    } satisfies Processor;
  });
}

/**
 * `country` → both facts it has always asserted.
 *
 * The sentence it fed claimed storage *and* legal reach in one breath ("may be
 * stored or processed in … including X. As a result … access requests from
 * governments … in those jurisdictions"). So expanding it to storage alone would
 * silently retract half of a claim consumers have already published. Expanding to
 * both is also what keeps the rendered output byte-identical for every config that
 * used the shorthand.
 *
 * `country` is left in place — it is public API and `PolicyVars.countries` still
 * reports it. When the explicit fields are present they win; `validateConfig`
 * rejects that combination, so it is unreachable through a validated config, but
 * `resolveProcessors` is exported and needs a defined answer regardless.
 */
function desugarCountry(p: Processor): Processor {
  if (!p.country) return p;
  return {
    ...p,
    storage: p.storage ?? [{ country: p.country }],
    operatorCountry: p.operatorCountry ?? p.country,
  };
}

/**
 * Processors the config discloses but places nowhere.
 *
 * Such a processor cannot appear in the transfer disclosure — there is nothing true
 * to say about it — and today it vanishes from that section in silence, which is the
 * tidy-looking failure. Names only, and deliberately NOT on `PolicyVars`: that type
 * is the facts a template renders from, and a document must not editorialise about
 * its own gaps. The CLI reports these on stderr instead.
 *
 * Not a `validateConfig` error either: a bare `{ name, purpose }` validates today,
 * so rejecting it would make this a breaking change.
 */
export function processorsMissingLocation(cfg: Config): string[] {
  return resolveProcessors(cfg)
    .filter((p) => !p.operatorCountry && !p.storage?.length)
    .map((p) => p.name);
}

/**
 * Matomo is the one provider whose location the config actually knows.
 *
 * Matomo Cloud is hosted in the EU; a self-hosted instance is wherever the
 * consumer put it, which is very often their own infrastructure in their own
 * country. So the cross-border transfer sentence is asserted only for the case we
 * can see. Naming a transfer that isn't happening is the same class of error as
 * omitting one that is — the config records facts, and "we don't know" is a fact.
 *
 * This sets `storage`, not `operatorCountry`: Matomo Cloud genuinely holds the data
 * in the EU. InnoCraft is New Zealand-based, but nothing in the config sees that, so
 * no operator jurisdiction is asserted — the same rule, applied to the other fact.
 */
function matomoLocation(processor: Processor, site: Config['site']): Processor {
  if (processor.name !== 'Matomo') return processor;
  const url = site.analytics?.matomo?.url ?? '';
  return /\.matomo\.cloud/i.test(url)
    ? { ...processor, storage: [{ country: 'the European Union' }] }
    : processor;
}
