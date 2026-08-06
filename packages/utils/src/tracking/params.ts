/**
 * The ad-platform vocabulary — the one place that says which URL parameters mean
 * "this visit came from an ad", and which platform each belongs to.
 *
 * Single source of truth on purpose: the capture script reads it to know what to
 * pull off the URL, and the notification renderer reads it to name the platform.
 * Two lists would drift into a cookie holding a click ID nothing can attribute.
 */

/**
 * Click-ID parameters, in identification precedence.
 *
 * Order matters: `identifyPlatform` and `getPrimaryClickId` return the first
 * match, and a URL can legitimately carry more than one (a Google Ads link
 * retargeted through Meta arrives with both `gclid` and `fbclid`). Google first
 * because its click IDs are the ones that survive redirects intact.
 *
 * This table must cover every `clickIdParams` entry in `ads/providers.ts`, and
 * `ads/providers.test.ts` asserts it does. A configured ad property whose click ID
 * is not captured here means every conversion from that platform arrives
 * unattributed — silently, since an unattributed conversion looks exactly like an
 * organic one. `li_fat_id` and `epik` were missing for precisely that reason.
 */
export const PLATFORM_PARAMS: Readonly<Record<string, string>> = {
  gclid: 'Google Ads',
  gbraid: 'Google Ads',
  wbraid: 'Google Ads',
  fbclid: 'Meta',
  ttclid: 'TikTok',
  rdt_cid: 'Reddit',
  ScCid: 'Snapchat',
  msclkid: 'Microsoft Ads',
  li_fat_id: 'LinkedIn',
  epik: 'Pinterest',
};

/** Just the parameter names, in the same precedence order. */
export const CLICK_ID_PARAMS: readonly string[] = Object.keys(PLATFORM_PARAMS);

export const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

/** Everything the capture script pulls off the landing URL. */
export const TRACKED_PARAMS: readonly string[] = [...CLICK_ID_PARAMS, ...UTM_PARAMS];

/**
 * The attribution cookie.
 *
 * First-party and same-site: it is read by this site's own conversion handler and
 * never sent anywhere. It is still a persistent identifier, which is why writing
 * it waits on consent.
 */
export const TRACKING_COOKIE = '_ac';

/** 90 days — an ad click and the conversion it produces are rarely further apart. */
export const TRACKING_COOKIE_DAYS = 90;

/** The A/B variant cookie, assigned by the router when a site runs experiments. */
export const AB_COOKIE = '_ab';
