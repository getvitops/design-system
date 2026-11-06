/**
 * Google Ads offline conversion upload — the server-side counterpart to the
 * client-side `gtag('event', 'conversion', …)` call `gtagBootstrap`
 * (`@getvitops/utils/ads`) wires up. Reads `site.ads.google.reporting: 'server'`
 * and a matching `conversionActionId` (see that field's own docblock for why
 * it is a different identifier from `conversionLabel`, not an alternate
 * spelling of it) and calls `ConversionUploadService.UploadClickConversions`
 * instead of relying on a visitor's browser to fire the tag.
 *
 * Same reasoning as `@getvitops/utils/crm`'s executors: credentials are a
 * structurally-typed shape the consumer's route supplies from env vars, never
 * config, and a failed upload is a `GoogleAdsUploadResult` to log or fold into
 * the notification email — never an exception, and never something that fails
 * the conversion request it's attached to. A lost ad report is not a lost
 * lead; the visitor has already submitted.
 *
 * **Structurally typed against Google's documented REST shape, not verified
 * against a live Ads account** — no developer-token/MCC access exists
 * anywhere in this toolchain's own setup to test against (the same blocker
 * `vitops ads provision` is waiting on). Same caveat, and the same reason, as
 * `@getvitops/utils/crm`'s Jobber executor: wrapped so a wrong guess about the
 * exact request/response shape degrades to a stated failure reason rather
 * than breaking. Re-verify against `googleads.googleapis.com`'s current API
 * version and `ClickConversion` message shape before depending on this in
 * production, and update this docblock with what was found.
 */
import { errorDetail, googleAccessToken, googleHeaders } from '../google/token.ts';
import type { GoogleOAuth } from '../google/token.ts';

/** Bumped independently of everything else here — the Ads API deprecates
 * versions on its own rolling schedule. Last checked against Google's public
 * docs at the time this file was written; not re-verified since. */
const API_VERSION = 'v17';

export interface GoogleAdsCredentials {
  /** Issued against a Google Ads manager (MCC) account — a Google review, not
   * a self-service toggle. Never config. */
  developerToken: string;
  oauth: GoogleOAuth;
  /** The MCC's own (dashes-or-not) customer id — required when `customerId`
   * in the upload input is a client account managed under it, which is the
   * common case for an agency running this on a client's behalf. */
  loginCustomerId?: string | undefined;
}

export interface GoogleAdsUploadInput {
  /** Google Ads customer id, as shown in the UI (`"123-456-7890"`) or bare
   * digits — either works, dashes are stripped before the call. */
  customerId: string;
  /** A numeric conversion action id, or a full
   * `customers/…/conversionActions/…` resource name. */
  conversionActionId: string;
  /** The click id captured on `_ac` — `getPrimaryClickId()`'s result. */
  clickId: { param: string; value: string };
  /** Epoch ms — converted to the Ads API's own
   * `"yyyy-MM-dd HH:mm:ss+00:00"` format. */
  at: number;
  conversionValue?: number | undefined;
  currencyCode?: string | undefined;
  orderId?: string | undefined;
}

/** Never thrown — an Ads API outage or a malformed request both come back as
 * `ok: false`, the same "structured result, not an exception" rule every
 * other executor in this toolchain follows. */
export interface GoogleAdsUploadResult {
  ok: boolean;
  reason?: string | undefined;
  code?: string | undefined;
}

function digitsOnly(id: string): string {
  return id.replace(/\D/g, '');
}

/** A bare numeric id becomes a full resource name under `customerId`; a value
 * already shaped like one (the escape hatch, matching `txtRecord`'s `=`
 * check in `@getvitops/utils/ads`) passes through unchanged. */
export function conversionActionResourceName(
  customerId: string,
  conversionActionId: string,
): string {
  if (conversionActionId.includes('customers/')) return conversionActionId;
  return `customers/${digitsOnly(customerId)}/conversionActions/${conversionActionId}`;
}

/** The Ads API's documented click-conversion datetime format, always
 * rendered in UTC — there is no per-account timezone lookup here to do
 * better, and UTC is unambiguous. */
export function toGoogleConversionDateTime(atMs: number): string {
  const d = new Date(atMs);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

/** The request field a click id param maps to — the API takes `gclid`/
 * `gbraid`/`wbraid` as distinct fields, not one generic "click id" field.
 * Anything else this toolchain's `PLATFORM_PARAMS` maps to Google (today,
 * only these three) falls back to `gclid`. */
function clickIdField(param: string): 'gclid' | 'gbraid' | 'wbraid' {
  if (param === 'gbraid' || param === 'wbraid') return param;
  return 'gclid';
}

/**
 * Upload one click conversion via `ConversionUploadService.UploadClickConversions`.
 *
 * `partialFailure: true` is always sent, and a 200 response carrying
 * `partialFailureError` is treated as a failure, not a success — a single-
 * conversion batch makes "partial" and "total" failure the same case, and
 * Google Ads API responses are 200 for a partial failure by design (silently
 * treating that as success is exactly the trap `@getvitops/utils/crm`'s
 * Jobber executor documents for its own GraphQL transport).
 */
export async function uploadClickConversion(
  input: GoogleAdsUploadInput,
  credentials: GoogleAdsCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleAdsUploadResult> {
  let token: string;
  try {
    token = await googleAccessToken({ kind: 'oauth', oauth: credentials.oauth }, fetchImpl);
  } catch (err) {
    return {
      ok: false,
      reason: `Google Ads token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const customerId = digitsOnly(input.customerId);
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:uploadClickConversions`;

  const body = {
    conversions: [
      {
        conversionAction: conversionActionResourceName(customerId, input.conversionActionId),
        [clickIdField(input.clickId.param)]: input.clickId.value,
        conversionDateTime: toGoogleConversionDateTime(input.at),
        ...(input.conversionValue != null ? { conversionValue: input.conversionValue } : {}),
        ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
      },
    ],
    partialFailure: true,
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: googleHeaders(token, {
        'developer-token': credentials.developerToken,
        'content-type': 'application/json',
        ...(credentials.loginCustomerId
          ? { 'login-customer-id': digitsOnly(credentials.loginCustomerId) }
          : {}),
      }),
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: `Google Ads request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: String(res.status),
      reason: await errorDetail(res, (status) =>
        status === 401
          ? 'Google Ads rejected the access token.'
          : status === 403
            ? 'Google Ads refused the request — check the developer token is approved and `login-customer-id` is set for an MCC-managed account.'
            : undefined,
      ),
    };
  }

  const json = (await res.json().catch(() => ({}))) as {
    partialFailureError?: { message?: string };
  };
  if (json.partialFailureError) {
    return {
      ok: false,
      reason: `Google Ads rejected the conversion: ${json.partialFailureError.message ?? 'no detail given'}`,
    };
  }

  return { ok: true };
}

/** A one-line delivery note, matching `describeCrmResult`'s shape — what
 * `conversion.ts` folds into the notification email's "Delivery" section. */
export function describeGoogleAdsOfflineResult(
  result: GoogleAdsUploadResult | null,
): string | null {
  if (!result) return null;
  if (result.ok) return 'Reported to Google Ads (server-side)';
  return `⚠ Not reported to Google Ads: ${result.reason ?? 'unknown reason'}`;
}
