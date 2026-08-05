/**
 * Reading and writing the `_ac` cookie, as functions over a cookie **string**.
 *
 * String in, string out, so one implementation serves both ends: the browser
 * passes `document.cookie`, the conversion handler passes the request's `Cookie`
 * header. A separate server-side parser would be a second thing to keep in step
 * with the writer, and the failure — attribution silently absent from a
 * notification — looks identical to a visitor who arrived organically.
 *
 * The same shape, for the same reason, as `@getvitops/core`'s consent store.
 */
import { TRACKING_COOKIE, TRACKING_COOKIE_DAYS } from './params.ts';
import type { TrackingData } from './types.ts';

/** Read one cookie out of a `document.cookie`-shaped string. */
export function readCookie(cookieString: string | null | undefined, name: string): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(';')) {
    const raw = part.trim();
    if (raw.slice(0, name.length + 1) === `${name}=`) return raw.slice(name.length + 1);
  }
  return null;
}

/**
 * Cookie header → attribution, or `null`.
 *
 * Anything unparseable reads as `null` — no attribution — rather than as a
 * partial record. A half-read cookie would attribute a conversion to whichever
 * fields happened to survive, which is worse than reporting it unattributed:
 * "we don't know" is actionable, a wrong campaign is not.
 */
export function parseTrackingCookie(cookieHeader: string | null | undefined): TrackingData | null {
  const raw = readCookie(cookieHeader, TRACKING_COOKIE);
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
    return data as TrackingData;
  } catch {
    return null;
  }
}

/** Attribution → cookie value (not the full `Set-Cookie` — see `cookieAttributes`). */
export function serializeTrackingCookie(data: TrackingData): string {
  // Undefined values would serialize as absent keys anyway; dropping them first
  // keeps the cookie small and the round-trip exact.
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  return encodeURIComponent(JSON.stringify(clean));
}

/**
 * Attributes for the attribution cookie.
 *
 * `SameSite=Lax` rather than `Strict`: the visitor arrives here by following a
 * link from the ad platform, and `Strict` withholds the cookie on exactly that
 * cross-site navigation — so a returning click would read as a fresh one. No
 * `HttpOnly`, because the capture script has to write it from the page.
 */
export function cookieAttributes(now: number, secure: boolean): string {
  const expires = new Date(now + TRACKING_COOKIE_DAYS * 864e5).toUTCString();
  return `;expires=${expires};path=/;SameSite=Lax${secure ? ';Secure' : ''}`;
}

/**
 * Fold a fresh capture into whatever was already stored.
 *
 * New values win, but `ts` is the **first** capture's — it dates the visitor's
 * original arrival, which is what a 90-day attribution window is measured from.
 * Taking the latest would restart the window on every visit and make the cookie
 * outlive the click it represents.
 */
export function mergeTracking(
  existing: TrackingData | null,
  captured: TrackingData,
  now: number,
): TrackingData {
  return { ...existing, ...captured, ts: existing?.ts ?? now };
}
