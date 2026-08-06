/**
 * What each ad platform actually lets a build tool do — the table every `vitops ads`
 * subcommand reads.
 *
 * Written the way the indexing module was written: start from what the platforms
 * accept, because it is much narrower than it looks, and record the *absence* of a
 * path as a fact rather than leaving it as a gap.
 *
 *  - **Four platforms verify a domain by DNS TXT** (Meta, TikTok, Pinterest,
 *    Snapchat). That record is the one thing here that can be created for you.
 *  - **Four have no domain verification at all** (Google Ads, LinkedIn, Reddit,
 *    Microsoft Ads). Linking is the tag and the account id, nothing else. Those
 *    resolve to a skip *plus* a named reason — a silent omission would read as
 *    "already done".
 *  - **No platform Marketing API is called.** Meta's Business Management
 *    `verify_domain` needs a system-user token; the Google Ads API needs an
 *    approved developer token and puts the consumer's own account on the line.
 *    That is the same reasoning that keeps the Google Indexing API unwired: a
 *    toolchain other people install must not ship a documented path to a terms
 *    violation. The final "Verify" click stays a reminder.
 *
 * The verification token is **not a secret** — it is published in DNS, and the
 * platform fetching it back is the ownership proof, exactly like the IndexNow key.
 * So it lives in the config while credentials stay in the environment.
 *
 * Each tag is the platform's documented bootstrap reduced to its queue stub, with
 * the remote library on `data-src` for the consent gate to attach after the
 * bootstrap has run (`@getvitops/core`'s `activateScript` emits the inline body
 * first for exactly this reason). Two platforms — Microsoft and Pinterest — ship a
 * snippet that creates its own `<script>`; those declare no `src`, and their body
 * stays inert until activation, so an undecided visitor still issues no request.
 */
import type { AdConsentCategory, AdProvider, AdPropertySetup } from './types.ts';

/** How a platform proves you own the domain. */
export interface AdVerificationSpec {
  method: 'dns-txt' | 'none';
  /**
   * Prefix prepended to a bare token to form the record content. Owned here so a
   * config holds the token the platform shows, not a hand-assembled record — but
   * see `txtRecord`: a value already containing `=` passes through whole, which is
   * the escape hatch when a platform changes its spelling.
   */
  txtPrefix?: string;
  /** Where in the platform UI the token is found. Printed when asking for it. */
  where?: string;
  /** Why there is nothing to automate. Required when `method` is `none`. */
  reason?: string;
}

/** The tag, and which config field carries its id. */
export interface AdTagSpec {
  /** Which field the tag id comes from — and therefore what to ask for when absent. */
  needs: 'pixelId' | 'accountId';
  /** The remote library. Absent when the platform's own bootstrap loads itself. */
  src?: (id: string) => string;
  /** The inline bootstrap, which the gate runs before attaching `src`. */
  bootstrap: (id: string, entry: AdPropertySetup) => string;
  /**
   * Cookies the tag sets, for `data-consent-cookies` (what a revoke clears) and
   * for the generated cookie notice. A `*` suffix is a prefix match.
   */
  cookies: string[];
  /** The provider's own privacy policy, for the cookie notice. */
  privacyUrl: string;
  /** A visitor-facing opt-out, where the platform offers one. */
  optOut?: string;
}

export interface AdPlatform {
  /** The platform as a reader would recognise it. */
  name: string;
  /**
   * The jurisdiction that can compel this platform to produce what it receives —
   * where the contracting entity is established. Feeds the generated privacy
   * policy's cross-border transfer disclosure, which is a claim about foreign
   * *access*, not foreign storage (see `Processor.operatorCountry` in the
   * generator's `legal/providers.ts`). A consumer whose contracting entity differs
   * declares their own processor entry instead.
   */
  operatorCountry: string;
  /** Click-ID parameters this platform stamps on an ad landing URL. */
  clickIdParams: string[];
  /** Where the operator manages the property. */
  consoleUrl: string;
  verification: AdVerificationSpec;
  tag: AdTagSpec;
  /** Follow-ups no API covers, given this entry. */
  manualSteps: (entry: AdPropertySetup) => string[];
}

/** `gtag` is shared by every Google tag; the id shape (`AW-…`) is what differs. */
const gtagBootstrap = (id: string): string =>
  `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}` +
  `gtag('js',new Date());gtag('config','${id}');`;

/** The queue-stub shape shared by fbq/ttq/rdt/snaptr/pintrk. */
const queueStub = (global: string, methods: string): string =>
  `window.${global}=window.${global}||function(){(window.${global}.q=window.${global}.q||[]).push(arguments)};` +
  `window.${global}.methods=${methods};`;

export const AD_PLATFORMS: Record<AdProvider, AdPlatform> = {
  google: {
    name: 'Google Ads',
    operatorCountry: 'the United States',
    clickIdParams: ['gclid', 'gbraid', 'wbraid'],
    consoleUrl: 'https://ads.google.com/',
    verification: {
      method: 'none',
      reason:
        'Google Ads has no domain verification — the conversion tag is the link. (Merchant Center claims a website; that is a different product.)',
    },
    tag: {
      // The customer id (`123-456-7890`) is not the tag id: the conversion tag is
      // `AW-…`, which is why this asks for `pixelId` rather than reusing accountId.
      needs: 'pixelId',
      src: (id) => `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`,
      bootstrap: gtagBootstrap,
      cookies: ['_gcl_au', '_gcl_aw', '_gcl_dc', '_gac_*'],
      privacyUrl: 'https://policies.google.com/privacy',
      optOut: 'https://adssettings.google.com/',
    },
    manualSteps: (e) => [
      ...(e.conversionLabel
        ? []
        : ['create a conversion action in Google Ads and record its label as `conversionLabel`']),
      'link the Google Ads account to Search Console / GA4 in the UI if you want imported conversions',
    ],
  },

  meta: {
    name: 'Meta',
    operatorCountry: 'the United States',
    clickIdParams: ['fbclid'],
    consoleUrl: 'https://business.facebook.com/settings/owned-domains',
    verification: {
      method: 'dns-txt',
      txtPrefix: 'facebook-domain-verification=',
      where: 'Business settings → Brand safety → Domains → Add → DNS verification',
    },
    tag: {
      needs: 'pixelId',
      src: () => 'https://connect.facebook.net/en_US/fbevents.js',
      bootstrap: (id) =>
        `${queueStub('fbq', `['init','track','trackCustom','consent']`)}` +
        `fbq('init','${id}');fbq('track','PageView');`,
      cookies: ['_fbp', '_fbc'],
      privacyUrl: 'https://www.facebook.com/privacy/policy/',
      optOut: 'https://www.facebook.com/adpreferences/ad_settings',
    },
    manualSteps: () => [
      'click Verify on the domain in Business settings once the TXT record has propagated — the Business Management API needs a system-user token and is deliberately not called',
    ],
  },

  linkedin: {
    name: 'LinkedIn',
    operatorCountry: 'the United States',
    clickIdParams: ['li_fat_id'],
    consoleUrl: 'https://www.linkedin.com/campaignmanager/',
    verification: {
      method: 'none',
      reason:
        'LinkedIn Ads has no domain verification — the Insight Tag is the link. (Verifying a LinkedIn *Page* is a separate, unrelated flow.)',
    },
    tag: {
      needs: 'accountId',
      src: () => 'https://snap.licdn.com/li.lms-analytics/insight.min.js',
      bootstrap: (id) =>
        `window._linkedin_partner_id='${id}';` +
        `window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];` +
        `window._linkedin_data_partner_ids.push('${id}');`,
      cookies: ['li_sugr', 'li_gc', 'bcookie', 'lidc', 'UserMatchHistory'],
      privacyUrl: 'https://www.linkedin.com/legal/privacy-policy',
      optOut: 'https://www.linkedin.com/psettings/guest-controls/retargeting-opt-out',
    },
    manualSteps: () => [
      'add conversions in Campaign Manager — the Insight Tag alone records page visits, not conversions',
    ],
  },

  reddit: {
    name: 'Reddit',
    operatorCountry: 'the United States',
    clickIdParams: ['rdt_cid'],
    consoleUrl: 'https://ads.reddit.com/',
    verification: {
      method: 'none',
      reason: 'Reddit Ads has no domain verification — the Reddit Pixel is the link.',
    },
    tag: {
      needs: 'pixelId',
      src: () => 'https://www.redditstatic.com/ads/pixel.js',
      bootstrap: (id) =>
        `${queueStub('rdt', `['init','track']`)}rdt('init','${id}');rdt('track','PageVisit');`,
      cookies: ['_rdt_uuid'],
      privacyUrl: 'https://www.reddit.com/policies/privacy-policy',
    },
    manualSteps: () => [],
  },

  tiktok: {
    name: 'TikTok',
    operatorCountry: 'Singapore',
    clickIdParams: ['ttclid'],
    consoleUrl: 'https://ads.tiktok.com/',
    verification: {
      method: 'dns-txt',
      txtPrefix: 'tiktok-developers-site-verification=',
      where: 'Ads Manager → Assets → Events → Web events → Verify domain → DNS',
    },
    tag: {
      needs: 'pixelId',
      src: (id) =>
        `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`,
      bootstrap: (id) =>
        `window.TiktokAnalyticsObject='ttq';` +
        `${queueStub('ttq', `['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie']`)}` +
        `ttq('init','${id}');ttq('page');`,
      cookies: ['_ttp'],
      privacyUrl: 'https://www.tiktok.com/legal/privacy-policy',
    },
    manualSteps: () => [],
  },

  microsoft: {
    name: 'Microsoft Ads',
    operatorCountry: 'the United States',
    clickIdParams: ['msclkid'],
    consoleUrl: 'https://ads.microsoft.com/',
    verification: {
      method: 'none',
      reason: 'Microsoft Ads has no domain verification — the UET tag is the link.',
    },
    tag: {
      needs: 'pixelId',
      // No `src`: UET must be constructed *after* bat.js evaluates, so the
      // platform's own snippet attaches an onload handler to a script it creates.
      // Inert until activation all the same — the body is never parsed before then.
      bootstrap: (id) =>
        `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:'${id}',enableAutoSpaTracking:true};` +
        `o.q=w[u],w[u]=new UET(o),w[u].push('pageLoad')},n=d.createElement(t),n.src=r,n.async=1,` +
        `n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=='loaded'&&s!=='complete'||(f(),n.onload=n.onreadystatechange=null)},` +
        `i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,'script','https://bat.bing.com/bat.js','uetq');`,
      cookies: ['_uetsid', '_uetvid', 'MUID'],
      privacyUrl: 'https://privacy.microsoft.com/privacystatement',
      optOut: 'https://account.microsoft.com/privacy/ad-settings',
    },
    manualSteps: () => [],
  },

  pinterest: {
    name: 'Pinterest',
    operatorCountry: 'the United States',
    clickIdParams: ['epik'],
    consoleUrl: 'https://ads.pinterest.com/',
    verification: {
      method: 'dns-txt',
      txtPrefix: 'pinterest-site-verification=',
      where: 'Business hub → Claim → Websites → Claim → Add TXT record',
    },
    tag: {
      needs: 'pixelId',
      // Pinterest's stub creates the script itself once `pintrk('load')` runs.
      bootstrap: (id) =>
        `${queueStub('pintrk', `['load','page','track']`)}` +
        `!function(){var t=document.createElement('script');t.async=!0,t.src='https://s.pinimg.com/ct/core.js';` +
        `var e=document.getElementsByTagName('script')[0];e.parentNode.insertBefore(t,e)}();` +
        `pintrk('load','${id}');pintrk('page');`,
      cookies: ['_pinterest_ct_ua', '_pin_unauth', '_epik'],
      privacyUrl: 'https://policy.pinterest.com/privacy-policy',
    },
    manualSteps: () => [
      'confirm the claim in Business hub → Claim once the TXT record has propagated',
    ],
  },

  snapchat: {
    name: 'Snapchat',
    operatorCountry: 'the United States',
    clickIdParams: ['ScCid'],
    consoleUrl: 'https://ads.snapchat.com/',
    verification: {
      method: 'dns-txt',
      txtPrefix: 'snap-domain-verification=',
      where: 'Business Manager → Public Profiles / Domains → Verify domain → DNS',
    },
    tag: {
      needs: 'pixelId',
      src: () => 'https://sc-static.net/scevent.min.js',
      bootstrap: (id) =>
        `${queueStub('snaptr', `['init','track']`)}snaptr('init','${id}');snaptr('track','PAGE_VIEW');`,
      cookies: ['_scid', '_scid_r', 'sc_at'],
      privacyUrl: 'https://snap.com/privacy/privacy-policy',
    },
    manualSteps: () => [],
  },
};

/** Every provider, in table order — the one place iteration order is decided. */
export const AD_PROVIDER_KEYS = Object.keys(AD_PLATFORMS) as AdProvider[];

/** Whether a string names a known provider (for CLI arg validation). */
export const isAdProvider = (value: string): value is AdProvider => value in AD_PLATFORMS;

/**
 * The DNS TXT record content for a token.
 *
 * A value already containing `=` is taken as the whole record and left alone. That
 * is the same escape hatch an icon name containing `:` gets: a platform can change
 * its prefix spelling without waiting on a toolchain release, and an operator who
 * pasted the full record from the UI gets what they meant rather than a
 * double-prefixed record that verifies against nothing.
 */
export function txtRecord(provider: AdProvider, token: string): string {
  const trimmed = token.trim();
  if (trimmed.includes('=')) return trimmed;
  return `${AD_PLATFORMS[provider].verification.txtPrefix ?? ''}${trimmed}`;
}

/** The tag id for an entry, or undefined when the field it needs is unset. */
export function tagId(entry: AdPropertySetup): string | undefined {
  const field = AD_PLATFORMS[entry.provider].tag.needs;
  return entry[field];
}

/** The consent category gating an entry's tag. `marketing` unless stated otherwise. */
export const categoryOf = (entry: AdPropertySetup): AdConsentCategory =>
  entry.category ?? 'marketing';

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * One provider's tag, rendered as a **consent-gated, inert** `<script>`.
 *
 * `type="text/plain"` with the URL on `data-src` is what makes the gate real: the
 * browser neither parses the body nor fetches the library, so an undecided
 * visitor's page issues no third-party request. Never give one of these a live
 * `src` — a gate that instead asks a loaded tracker not to track is a promise.
 *
 * Returns null when the entry has no tag id, so a caller can report the gap rather
 * than emit a snippet that initialises `undefined`.
 */
export function renderTag(
  entry: AdPropertySetup,
  strategy: 'idle' | 'async' | 'interaction' = 'idle',
): string | null {
  const platform = AD_PLATFORMS[entry.provider];
  const id = tagId(entry);
  if (!id) return null;
  const attrs = [
    'type="text/plain"',
    'data-vitops-tag',
    `data-consent="${categoryOf(entry)}"`,
    `data-strategy="${strategy}"`,
    ...(platform.tag.src ? [`data-src="${escapeAttr(platform.tag.src(id))}"`] : []),
    `data-consent-cookies="${escapeAttr(platform.tag.cookies.join(','))}"`,
  ];
  return `<!-- ${platform.name} — gated on ${categoryOf(entry)} consent -->\n<script ${attrs.join(' ')}>${platform.tag.bootstrap(id, entry)}</script>`;
}
