// Ad conversion tracking: capture click IDs from the landing URL, track tel:
// clicks. Form enhancement is in form-enhance.ts.
//
// Runs early and ungated on purpose. Reading the query string is not storage and
// needs nobody's permission; *keeping* it does. So the capture is synchronous —
// it has to be, the click ID is only in the URL on the landing page — and only
// the write to `_ac` waits on consent.
//
// The `_ac` cookie is a 90-day identifier tying a visitor to the ad that brought
// them, which is what `marketing` covers. Two things follow, and both matter:
//
//   - It **demands** the category rather than passively reading it. Nothing else
//     on a page would ask for `marketing`, so a passive `granted()` check is a
//     permanent no-op: the banner never offers it, so it is never granted, so
//     `_ac` is never written and no attribution ever reaches a notification —
//     silently, on every site that enabled the gate.
//   - It only demands when the URL actually carried something. A visitor arriving
//     organically has nothing to attribute, so they are never asked. That is the
//     whole point of a demand-driven banner applied to attribution: the one
//     arrival that needs the permission is the one that requests it.
//
// With no gate on the page it behaves as it always has — a site that has not
// adopted consent has made no promise for this to break.

const COOKIE_NAME = '_ac';
const COOKIE_DAYS = 90;
const AB_COOKIE = '_ab';

// Mirrors CLICK_ID_PARAMS/UTM_PARAMS in @getvitops/utils/tracking, deliberately
// copied rather than imported: this file is inlined into the document by
// <Tracking />, so a bare import would either fail or drag a module graph into
// the critical path. `tracking.test.ts` in this package pins the two lists.
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

function readCookie(): Record<string, unknown> | null {
  const match = document.cookie.split(';').find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
    return typeof data === 'object' && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function persist(): void {
  // Merge with any existing cookie data (don't overwrite prior click IDs from a
  // different session unless new ones are present). `ts` keeps the FIRST
  // capture: the 90-day window is measured from the original click, and taking
  // the latest would restart it on every visit.
  const existing = readCookie();
  const merged = {
    ...existing,
    ...trackingData,
    landingPage: location.pathname,
    referrer: document.referrer || undefined,
    ts: existing?.['ts'] ?? Date.now(),
  };

  // Remove undefined values before serializing
  const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined));

  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  const secure = location.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(clean),
  )};expires=${expires};path=/;SameSite=Lax${secure}`;
}

/** Typed locally: a global augmentation here would widen `Window` package-wide. */
interface ConsentLike {
  granted(c: string): boolean;
  require(c: string): boolean;
}
const gate = (): ConsentLike | undefined =>
  (window as unknown as { vitopsConsent?: ConsentLike }).vitopsConsent;

if (Object.keys(trackingData).length > 0) {
  // <Tracking /> writes the category onto this marker, which also carries
  // `data-consent-cookies` so revoking clears `_ac`.
  const marker = document.querySelector('[data-vitops-tracking]');
  const category = marker?.getAttribute('data-consent') ?? 'marketing';

  if (!gate()) {
    // No gate on this site: behave as it always has.
    persist();
  } else {
    // Ask. This is what raises the banner — without it nothing on the page ever
    // demands `marketing`, so it is never granted and `_ac` is never written.
    if (gate()?.require(category)) persist();

    // Then keep listening. A standing listener rather than acting on the one-shot
    // answer above, for two reasons that both bite: `window.vitopsConsent` may
    // still be the inline stub <Head /> emits — which queues `require()` and has
    // no `subscribe` at all — and the visitor may accept a moment later, in this
    // same page view, with the click ID still in the URL. The event fires either
    // way, and the runtime publishes once on startup after draining the stub.
    document.addEventListener('vitops:consent', () => {
      if (gate()?.granted(category)) persist();
    });
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
