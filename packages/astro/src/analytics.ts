/**
 * The `<Analytics />` resolution layer — provider config in, the exact tags to
 * emit out.
 *
 * Kept separate from `Analytics.astro` for the same reason `seo.ts` is separate
 * from `Seo.astro`: everything decidable is a pure function and asserted in
 * `analytics.test.ts`, and the component only renders what this returns.
 *
 * Two properties here are the point of the whole file:
 *
 *  - **Which consent category a provider needs is derived, never declared.** It
 *    follows from whether that provider sets cookies, which follows from its own
 *    configuration (Matomo with `disableCookies` is genuinely cookieless; Matomo
 *    with `cookies: true` is not). A consumer cannot mark Google Analytics
 *    `necessary` to skip a banner, because `setsCookies` isn't theirs to set.
 *  - **The same fact drives the legal documents.** `@getvitops/generator`'s
 *    `legal/providers.ts` maps the *site config's* `analytics` block onto named
 *    processors with cookie lists. If a provider is configured here but not
 *    there, the site runs a tag its own cookie notice doesn't disclose — so the
 *    integration warns, and `warnings` is returned as data so that check is a
 *    test rather than a log line someone might scroll past.
 */

/**
 * When a tag is allowed to load. Third-party analytics is never worth a
 * millisecond of the critical path, so the default puts every tag after `load`.
 */
export type AnalyticsStrategy = 'idle' | 'async' | 'interaction';

/**
 * The consent vocabulary, mirroring `@getvitops/core`'s `consent/store.ts`.
 * Mirrored rather than imported because this value is `JSON.stringify`d into the
 * virtual module and the component reads it at build time, while core's copy is a
 * browser runtime — `consent.test.ts` and `analytics.test.ts` pin both ends.
 */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

export type OptionalConsentCategory = Exclude<ConsentCategory, 'necessary'>;

export interface GoogleAnalyticsOptions {
  /** Measurement ID, e.g. `G-XXXXXXXXXX`. */
  id: string;
  /**
   * Which category gates it (default `analytics`). Set `marketing` when the
   * property feeds Google Ads — the tag is the same, the permission isn't.
   */
  category?: OptionalConsentCategory;
  /** Extra `gtag('config', id, …)` parameters, e.g. `{ send_page_view: false }`. */
  config?: Record<string, string | number | boolean>;
}

export interface ClarityOptions {
  /** Clarity project ID. */
  id: string;
  category?: OptionalConsentCategory;
}

export interface MatomoOptions {
  /** Instance base URL — self-hosted, or `https://<you>.matomo.cloud`. */
  url: string;
  /** Site ID within that instance. */
  siteId: string | number;
  /**
   * Let Matomo set its cookies (default **false**).
   *
   * The default is what makes Matomo the cookieless option: with
   * `disableCookies` it stores no identifier on the device, needs no banner, and
   * the generated cookie notice can state positively that it sets none. Turning
   * this on gives you returning-visitor metrics and a consent obligation.
   */
  cookies?: boolean;
}

export interface PlausibleOptions {
  /** The domain as registered in Plausible, e.g. `example.com`. */
  domain: string;
  /** Script URL — override for a self-hosted instance or a custom-events build. */
  src?: string;
}

export interface GetvitopsAnalyticsOptions {
  googleAnalytics?: string | GoogleAnalyticsOptions;
  clarity?: string | ClarityOptions;
  matomo?: MatomoOptions;
  plausible?: string | PlausibleOptions;
  /** When tags load (default `'idle'`). */
  strategy?: AnalyticsStrategy;
}

/**
 * The consent gate, configured on the integration rather than inside `analytics`.
 *
 * That placement is the design, not an accident: analytics is one consumer of
 * consent, not its owner. A/B assignment, account personalisation and third-party
 * embeds gate on the same choice via `data-consent`, and a site can enable the
 * banner with no analytics configured at all.
 */
export interface GetvitopsConsentOptions {
  /**
   * Categories the banner offers. Defaults to the ones the configured providers
   * actually need — offering a choice nothing is waiting on is noise.
   */
  categories?: OptionalConsentCategory[];
  /** Link the banner to the cookie notice (`vitops legal` renders one). */
  policyUrl?: string;
}

/** One tag, fully resolved. */
export interface ResolvedTag {
  key: 'googleAnalytics' | 'clarity' | 'matomo' | 'plausible';
  /** The provider as a reader would recognise it — used in warnings. */
  provider: string;
  category: ConsentCategory;
  setsCookies: boolean;
  /** Names (or `prefix*` patterns) to clear when consent is withdrawn. */
  cookies: string[];
  strategy: AnalyticsStrategy;
  /**
   * Emitted inert (`type="text/plain"`) for the runtime to activate, rather than
   * as a live `<script>`. False only for the one case that needs no runtime at
   * all: a cookieless provider with `strategy: 'async'`.
   */
  gated: boolean;
  /** Bootstrap JS. Runs before `src`, so a queue is populated before it drains. */
  inline: string;
  src: string | null;
  attrs: Record<string, string>;
}

export interface ResolvedAnalytics {
  tags: ResolvedTag[];
  /** Does anything here need `@getvitops/core/consent` loaded? */
  needsRuntime: boolean;
  /** Configuration problems, as prose. The integration logs these. */
  warnings: string[];
}

export interface ResolveAnalyticsContext {
  /** Is the consent gate enabled on this site (`getvitops({ consent })`)? */
  consent?: boolean;
}

/**
 * IDs land inside an inline `<script>`, so they are checked rather than trusted.
 * A `</script>` in a measurement ID is not a plausible accident, but the cost of
 * the guard is one regex and the cost of not having it is arbitrary script
 * injection from a config file.
 */
const SAFE_ID = /^[\w.-]+$/;

function bad(value: string): boolean {
  return !SAFE_ID.test(value);
}

/** JSON is a subset of JS object-literal syntax; `<` can't appear unescaped. */
function literal(value: Record<string, string | number | boolean>): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function googleAnalytics(input: string | GoogleAnalyticsOptions): ResolvedTag | string {
  const opts = typeof input === 'string' ? { id: input } : input;
  if (bad(opts.id)) return `googleAnalytics: "${opts.id}" is not a valid measurement ID. Skipped.`;
  const config = opts.config ? `,${literal(opts.config)}` : '';
  return {
    key: 'googleAnalytics',
    provider: 'Google Analytics',
    category: opts.category ?? 'analytics',
    setsCookies: true,
    cookies: ['_ga', '_ga_*', '_gid', '_gat', '_gat_*'],
    strategy: 'idle',
    gated: true,
    inline:
      `window.dataLayer=window.dataLayer||[];` +
      `function gtag(){dataLayer.push(arguments)}` +
      `gtag('js',new Date());` +
      `gtag('config','${opts.id}'${config});`,
    src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(opts.id)}`,
    attrs: {},
  };
}

function clarity(input: string | ClarityOptions): ResolvedTag | string {
  const opts = typeof input === 'string' ? { id: input } : input;
  if (bad(opts.id)) return `clarity: "${opts.id}" is not a valid project ID. Skipped.`;
  const category = opts.category ?? 'analytics';
  // Clarity's snippet injects its own <script>, so there is no `src` for us to
  // schedule — activation *is* the load.
  //
  // The consentv2 call is not redundant with having gated the tag: Microsoft
  // enforces consent signals for EEA/UK/CH traffic from the project side, and
  // without one Clarity degrades to no-consent mode even though the visitor
  // agreed. `ad_Storage` follows the category, because that is the only thing
  // that tells us whether this tag was permitted for advertising.
  return {
    key: 'clarity',
    provider: 'Microsoft Clarity',
    category,
    setsCookies: true,
    cookies: ['_clck', '_clsk', 'MUID', 'CLID', 'ANONCHK', 'SM'],
    strategy: 'idle',
    gated: true,
    inline:
      `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};` +
      `t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;` +
      `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})` +
      `(window,document,"clarity","script","${opts.id}");` +
      `window.clarity('consentv2',{ad_Storage:'${
        category === 'marketing' ? 'granted' : 'denied'
      }',analytics_Storage:'granted'});`,
    src: null,
    attrs: {},
  };
}

function matomo(opts: MatomoOptions): ResolvedTag | string {
  const siteId = String(opts.siteId);
  if (bad(siteId)) return `matomo: "${siteId}" is not a valid site ID. Skipped.`;
  let base: URL;
  try {
    base = new URL(opts.url);
  } catch {
    return `matomo: "${opts.url}" is not a valid URL. Skipped.`;
  }
  const url = `${base.origin}${base.pathname.replace(/\/*$/, '')}/`;
  const cookies = opts.cookies === true;

  // `disableCookies` must be pushed *before* trackPageView, or the first request
  // of the visit sets the cookies this option exists to avoid.
  return {
    key: 'matomo',
    provider: 'Matomo',
    category: cookies ? 'analytics' : 'necessary',
    setsCookies: cookies,
    cookies: cookies ? ['_pk_id*', '_pk_ses*', '_pk_ref*', '_pk_cvar*', '_pk_hsr*'] : [],
    strategy: 'idle',
    gated: true,
    inline:
      `var _paq=window._paq=window._paq||[];` +
      (cookies ? '' : `_paq.push(['disableCookies']);`) +
      `_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);` +
      `(function(){var u="${url}";` +
      `_paq.push(['setTrackerUrl',u+'matomo.php']);_paq.push(['setSiteId','${siteId}']);` +
      `var d=document,g=d.createElement('script'),s=d.getElementsByTagName('script')[0];` +
      `g.async=true;g.src=u+'matomo.js';s.parentNode.insertBefore(g,s)})();`,
    src: null,
    attrs: {},
  };
}

function plausible(input: string | PlausibleOptions): ResolvedTag | string {
  const opts = typeof input === 'string' ? { domain: input } : input;
  if (bad(opts.domain)) return `plausible: "${opts.domain}" is not a valid domain. Skipped.`;
  return {
    key: 'plausible',
    provider: 'Plausible Analytics',
    // Cookieless and storing no cross-site identifier, so there is nothing for a
    // banner to ask about. It still goes through the runtime for scheduling.
    category: 'necessary',
    setsCookies: false,
    cookies: [],
    strategy: 'idle',
    gated: true,
    inline: '',
    src: opts.src ?? 'https://plausible.io/js/script.js',
    attrs: { 'data-domain': opts.domain },
  };
}

/**
 * Resolve the configured providers into the tags to emit.
 *
 * An invalid provider is dropped with a warning rather than throwing: one
 * malformed ID should not take down a build, and a missing tag is visible in the
 * output while a failed build is just a red wall.
 */
export function resolveAnalytics(
  opts: GetvitopsAnalyticsOptions | undefined,
  ctx: ResolveAnalyticsContext = {},
): ResolvedAnalytics {
  const warnings: string[] = [];
  const tags: ResolvedTag[] = [];
  if (!opts) return { tags, needsRuntime: false, warnings };

  const strategy = opts.strategy ?? 'idle';
  const results = [
    opts.googleAnalytics === undefined ? null : googleAnalytics(opts.googleAnalytics),
    opts.clarity === undefined ? null : clarity(opts.clarity),
    opts.matomo === undefined ? null : matomo(opts.matomo),
    opts.plausible === undefined ? null : plausible(opts.plausible),
  ];

  for (const result of results) {
    if (result === null) continue;
    if (typeof result === 'string') {
      warnings.push(result);
      continue;
    }
    // A cookieless tag on `async` needs nothing from the runtime, so it is emitted
    // as an ordinary <script async> and that site ships no consent bundle at all.
    const gated = result.category !== 'necessary' || strategy !== 'async';
    tags.push({ ...result, strategy, gated });
  }

  const setting = tags.filter((t) => t.setsCookies);
  if (setting.length && !ctx.consent) {
    warnings.push(
      `${setting.map((t) => t.provider).join(' and ')} ${setting.length === 1 ? 'sets' : 'set'} ` +
        `cookies (${setting.flatMap((t) => t.cookies).join(', ')}) and \`consent\` is off, so ` +
        `${setting.length === 1 ? 'it loads' : 'they load'} for every visitor with no way to ` +
        'decline. Set `consent: true`, or switch to a cookieless provider (Plausible, or Matomo ' +
        'with its default `cookies: false`).',
    );
  }

  return { tags, needsRuntime: tags.some((t) => t.gated), warnings };
}

/** Which optional categories a set of tags actually needs a visitor to decide. */
export function consentCategories(tags: ResolvedTag[]): OptionalConsentCategory[] {
  const used = new Set<OptionalConsentCategory>();
  for (const tag of tags) {
    if (tag.category !== 'necessary') used.add(tag.category);
  }
  return (['analytics', 'marketing', 'preferences'] as const).filter((c) => used.has(c));
}
