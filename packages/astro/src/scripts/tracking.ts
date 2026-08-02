// Ad conversion tracking: capture click IDs, track tel: clicks.
// Form enhancement is in form-enhance.ts (loaded by FormRenderer.astro).
// Runs early (not deferred) so click IDs are captured before any navigation.
//
// The `_ac` cookie below is a 90-day identifier tying a visitor to the ad that
// brought them, which is squarely `marketing` consent. So when the consent gate
// is present (`getvitops({ consent })` loads @getvitops/core/consent), this defers
// to it; with no gate on the page it behaves as it always has, because a site
// that has not adopted consent has made no promise for this to break.

const COOKIE_NAME = '_ac';
const COOKIE_DAYS = 90;
const AB_COOKIE = '_ab';

/** All known ad platform click ID parameters */
const CLICK_ID_PARAMS = [
  'gclid',
  'gbraid',
  'wbraid', // Google Ads
  'fbclid', // Meta (Facebook/Instagram)
  'ttclid', // TikTok
  'rdt_cid', // Reddit
  'ScCid', // Snapchat
  'msclkid', // Microsoft/Bing
] as const;

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

// ---------------------------------------------------------------------------
// 1. Capture click IDs + UTMs from URL → cookie
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const trackingData: Record<string, string> = {};

for (const key of [...CLICK_ID_PARAMS, ...UTM_PARAMS]) {
  const value = params.get(key);
  if (value) trackingData[key] = value;
}

// Include A/B variant if assigned by the router Worker. A cookie present but
// valueless yields undefined, which must not be written into the record.
const abMatch = document.cookie.split(';').find((c) => c.trim().startsWith(`${AB_COOKIE}=`));
const abVariant = abMatch?.split('=')[1]?.trim();
if (abVariant) trackingData['ab_variant'] = abVariant;

function persist(): void {
  // Merge with any existing cookie data (don't overwrite prior click IDs
  // from a different session unless new ones are present)
  const existing = readCookie();
  const merged = {
    ...existing,
    ...trackingData,
    landingPage: location.pathname,
    referrer: document.referrer || undefined,
    ts: existing?.ts ?? Date.now(),
  };

  // Remove undefined values before serializing
  const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));

  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(clean))};expires=${expires};path=/;SameSite=Lax`;
}

if (Object.keys(trackingData).length > 0) {
  // `trackingData` is already captured from the URL above, so waiting on consent
  // costs nothing: the query string is read synchronously and only the *write*
  // is deferred. If the visitor accepts later in the same page view the
  // subscription fires and the click ID is still there to record.
  // Typed inline rather than via a global augmentation: this file is a plain
  // script, so a top-level `interface Window` here would widen the type for
  // everything in the package whether or not the gate is actually loaded.
  const consent = (
    window as unknown as {
      vitopsConsent?: { granted(c: string): boolean; subscribe(fn: () => void): () => void };
    }
  ).vitopsConsent;
  if (consent) consent.subscribe(() => void (consent.granted('marketing') && persist()));
  else persist();
}

function readCookie(): Record<string, any> | null {
  const match = document.cookie.split(';').find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Tel: click tracking via sendBeacon
// ---------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const link = (e.target as Element).closest?.('a[href^="tel:"]') as HTMLAnchorElement | null;
  if (!link) return;

  // Fire-and-forget beacon; don't block the tel: navigation
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', JSON.stringify({ event: 'call', phone: link.href }));
  }
});
