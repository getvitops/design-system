/**
 * Which phone number a visitor should be shown — the pure decision behind call tracking.
 *
 * `site.tracking.phoneNumbers` records facts: the real number, and one number per ad
 * platform the client has provisioned with a call-tracking provider (Twilio, CallRail,
 * …), each forwarding to the real line. This module decides which one a given arrival
 * gets. It touches no DOM, cookie or clock, so it runs in a Worker and in a test, and
 * `scripts/tracking.ts` in `@getvitops/astro` mirrors it (that file is inlined into the
 * document and cannot import) — `tracking.test.ts` there pins the two.
 *
 * Google is deliberately absent from the swap when `site.ads.google.callTracking` is
 * set: Google's own tag fetches and inserts its forwarding number, and swapping a second
 * number on top would show a visitor one number and attribute the call to another.
 */
import { AD_PLATFORMS } from '../ads/providers.ts';
import type { AdProvider } from '../ads/types.ts';
import type { TrackingData } from './types.ts';

/** The fallback key: any paid visit with no platform-specific number. */
export const DEFAULT_PAID = 'default-paid';

export interface PhoneNumbersConfig {
  /** The real number, exactly as it is displayed on the page. */
  number: string;
  /** One tracking number per platform, plus an optional `default-paid` fallback. */
  sources: Readonly<Record<string, string | undefined>>;
}

export interface SelectedNumber {
  /** The number to display, in the format it was configured in. */
  number: string;
  /** The `sources` key that matched, for the conversion notification. */
  source: string;
}

/** Click-ID parameter → the `site.ads` provider key it belongs to. */
export const PROVIDER_BY_PARAM: Readonly<Record<string, AdProvider>> = Object.fromEntries(
  (Object.keys(AD_PLATFORMS) as AdProvider[]).flatMap((provider) =>
    AD_PLATFORMS[provider].clickIdParams.map((param) => [param, provider] as const),
  ),
);

/**
 * `utm_source` values people actually write → provider key. A UTM is self-declared, so
 * this is matched loosely; a click ID needs no such help.
 */
export const UTM_SOURCE_ALIASES: Readonly<Record<string, AdProvider>> = {
  google: 'google',
  facebook: 'meta',
  instagram: 'meta',
  meta: 'meta',
  fb: 'meta',
  ig: 'meta',
  bing: 'microsoft',
  microsoft: 'microsoft',
  linkedin: 'linkedin',
  reddit: 'reddit',
  tiktok: 'tiktok',
  pinterest: 'pinterest',
  snapchat: 'snapchat',
  snap: 'snapchat',
};

/** `utm_medium` values that mean "paid" and so qualify for `default-paid`. */
export const PAID_MEDIUM = /^(cpc|ppc|paid.*|cpm|display|paidsocial|paid_social)$/i;

/**
 * The digits of a phone number with a leading North American `1` removed, so
 * `+1 (613) 555-0100`, `613-555-0100` and `tel:+16135550100` all compare equal.
 */
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

/** Do two displayed numbers name the same line? Empty never matches. */
export function samePhone(a: string, b: string): boolean {
  const da = phoneDigits(a);
  return da.length > 0 && da === phoneDigits(b);
}

/**
 * The `tel:` URI for a displayed number. A bare ten-digit number is North American
 * (this toolchain's market) and gets `+1`; anything already carrying a country code
 * keeps it.
 */
export function telUri(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:+${digits}`;
}

/** Which provider a set of tracking data points at, by click ID first and `utm_source` second. */
function providerOf(data: TrackingData): AdProvider | null {
  for (const [param, provider] of Object.entries(PROVIDER_BY_PARAM)) {
    if (data[param]) return provider;
  }
  const source = data['utm_source'];
  return typeof source === 'string'
    ? (UTM_SOURCE_ALIASES[source.trim().toLowerCase()] ?? null)
    : null;
}

function isPaid(data: TrackingData): boolean {
  for (const param of Object.keys(PROVIDER_BY_PARAM)) if (data[param]) return true;
  const medium = data['utm_medium'];
  return typeof medium === 'string' && PAID_MEDIUM.test(medium.trim());
}

/**
 * Pick the number for this visit, or null to leave the real one alone.
 *
 * `current` is what this page's URL carried and `stored` is the `_ac` cookie. The URL
 * wins: a visitor arriving from a Meta ad today with a stale Google click ID stored
 * from last month is a Meta visitor now. An organic visit (neither carries anything)
 * always returns null — nobody is shown a tracking number they were not sent to.
 *
 * `googleNative` is true when `site.ads.google.callTracking` is configured; Google's
 * tag owns that swap, so a Google visit returns null here rather than competing.
 */
export function selectPhoneNumber(
  current: TrackingData | null,
  stored: TrackingData | null,
  config: PhoneNumbersConfig | undefined,
  opts: { googleNative?: boolean } = {},
): SelectedNumber | null {
  if (!config) return null;
  for (const data of [current, stored]) {
    if (!data) continue;
    const provider = providerOf(data);
    if (provider === 'google' && opts.googleNative) return null;
    const specific = provider ? config.sources[provider] : undefined;
    if (specific && !samePhone(specific, config.number)) {
      return { number: specific, source: provider! };
    }
    if (isPaid(data) || provider) {
      const fallback = config.sources[DEFAULT_PAID];
      if (
        fallback &&
        !samePhone(fallback, config.number) &&
        !(provider === 'google' && opts.googleNative)
      ) {
        return { number: fallback, source: DEFAULT_PAID };
      }
      return null;
    }
  }
  return null;
}
