/**
 * Jobber OAuth2 refresh-token exchange.
 *
 * A plain `application/x-www-form-urlencoded` POST, same shape as Zoho's —
 * see `zoho-token.ts` for why that keeps this Worker-safe (no `node:crypto`,
 * unlike `google/token.ts`'s service-account JWT).
 *
 * One thing Zoho's grant never does: Jobber's Refresh Token Rotation is ON by
 * default for a new app, and when it's on, every exchange returns a *new*
 * refresh token and invalidates the old one. A Worker reading a static env
 * var (`VITOPS_JOBBER_REFRESH_TOKEN`) cannot persist that new value, so this
 * integration requires rotation turned OFF in the app's Developer Center
 * settings — a legitimate setup requirement, since a per-client private app
 * is never published to Jobber's Marketplace (where rotation ON is
 * mandatory). `zohoAccessToken`'s Zoho equivalent has no such failure mode to
 * detect, because Zoho's grant is long-lived by default.
 *
 * Cached per isolate, keyed on the refresh token, with an expiry margin —
 * same rationale as `zoho-token.ts`.
 */

const JOBBER_OAUTH_TOKEN_URL = 'https://api.getjobber.com/api/oauth/token';

/** Refresh a few seconds before Jobber actually expires it (access tokens
 * last 60 minutes), so a token that's about to lapse mid-request is never
 * handed out. */
const EXPIRY_MARGIN_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CachedToken>();

export interface JobberOAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Exchange a refresh token for a short-lived Jobber access token, reusing a
 * cached one while it's still valid.
 *
 * Throws a specific, actionable error when Jobber's response carries a
 * *different* refresh token than the one sent — the rotation case above.
 * Without this check, rotation surfaces an hour later as an opaque 401 on a
 * lead that is already lost; with it, the first submission after rotation
 * turns on names the fix.
 *
 * `now` is a parameter so cache expiry is testable without a fake clock, the
 * same convention `zoho-token.ts`'s `zohoAccessToken` uses.
 */
export async function jobberAccessToken(
  oauth: JobberOAuth,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<string> {
  const cached = cache.get(oauth.refreshToken);
  if (cached && cached.expiresAt > now) return cached.accessToken;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: oauth.refreshToken,
  });

  const res = await fetchImpl(JOBBER_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Jobber token exchange failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!json.access_token) {
    throw new Error(
      `Jobber token exchange returned no access_token: ${json.error ?? 'unknown error'}`,
    );
  }
  if (json.refresh_token && json.refresh_token !== oauth.refreshToken) {
    throw new Error(
      'Jobber returned a rotated refresh token. Turn Refresh Token Rotation off for this app ' +
        "in Jobber's Developer Center — a rotated token cannot be persisted from a stateless " +
        'Worker reading a static VITOPS_JOBBER_REFRESH_TOKEN.',
    );
  }

  const expiresAt = now + (json.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS;
  cache.set(oauth.refreshToken, { accessToken: json.access_token, expiresAt });
  return json.access_token;
}

/** Test-only: clear the module-level cache between cases. */
export function clearJobberTokenCache(): void {
  cache.clear();
}
