/**
 * Cloudflare Turnstile server-side verification.
 *
 * `site.security.turnstile.siteKey` is public and lives in the config; the
 * matching **secret** key never does — same rule as every other credential in
 * this toolchain (`CLOUDFLARE_API_TOKEN`, the Google OAuth/service-account
 * grants) and the same reason: an env var, injected by the caller, never
 * imported here. Before this module existed, `siteKey` was read by the legal
 * templates (`legal/providers.ts`, `legal/derive.ts`) to *name* Turnstile in the
 * generated privacy policy, with nothing in the toolchain that verified a token
 * — a config field asserting a fact the site didn't actually implement, which is
 * exactly what the legal system's own rule ("the config records facts; the
 * template owns prose") argues against. `verifyTurnstileToken` plus
 * `createConversionRoute()`'s `turnstile` option (`@getvitops/astro/routes`) is
 * what lets that field describe something real.
 *
 * A separate `@getvitops/utils/security` subpath for the same reason
 * `notify`/`tracking` are: this runs in a **Worker**, on every submission, and
 * must not pull in anything build-time.
 *
 * The widget itself — `<script src="https://challenges.cloudflare.com/turnstile/
 * v0/api.js" async defer></script>` plus a `<div class="cf-turnstile"
 * data-sitekey="…">` — is the consumer's own markup, on their own hand-written
 * form. There is no `FormRenderer` (removed 2026-07-27, see `AGENTS.md`) for this
 * to hook into generically, so wiring the widget follows the same pattern a
 * consumer already uses for the rest of their form: write the HTML, submit it to
 * `createConversionRoute()`.
 */

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  /** Cloudflare's own codes (e.g. `timeout-or-duplicate`), present iff not successful. */
  errorCodes?: string[];
}

/**
 * Verify a submitted `cf-turnstile-response` token against Cloudflare's
 * siteverify endpoint.
 *
 * Never throws — a network failure or a malformed response both come back as
 * `{ success: false }` with an error code the caller can log, the same
 * "structured result, not an exception" rule `indexing`/`notify` follow. A
 * failed verification is not this module's business to act on; the caller
 * (`createConversionRoute`) decides what a failure means for the request.
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerifyResult> {
  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  let res: Response;
  try {
    res = await fetchImpl(VERIFY_ENDPOINT, { method: 'POST', body });
  } catch (e) {
    return { success: false, errorCodes: [`network-error: ${(e as Error).message}`] };
  }
  if (!res.ok) return { success: false, errorCodes: [`http-${res.status}`] };

  let data: { success?: boolean; 'error-codes'?: string[] };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { success: false, errorCodes: ['malformed-response'] };
  }

  return data.success === true
    ? { success: true }
    : { success: false, errorCodes: data['error-codes'] ?? ['unknown-error'] };
}
