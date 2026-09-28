/**
 * Zoho OAuth2 refresh-token exchange, for Bigin.
 *
 * Not `google/token.ts`: that module imports `node:crypto` to sign the
 * service-account JWT assertion, which makes it unusable in a Worker. Zoho's
 * self-client grant is a plain `application/x-www-form-urlencoded` POST, so
 * this module has no such dependency and can run on every submission.
 *
 * Cached per isolate, keyed on the refresh token, with an expiry margin — a
 * Worker isolate can field many submissions before it's recycled, and minting
 * a fresh access token on every one would be a needless round trip Bigin's
 * own rate limit does not forgive kindly.
 */

export interface ZohoDataCenterHosts {
  accounts: string;
}

const ZOHO_ACCOUNTS_HOSTS: Record<string, string> = {
  com: 'accounts.zoho.com',
  ca: 'accounts.zohocloud.ca',
  eu: 'accounts.zoho.eu',
  in: 'accounts.zoho.in',
  'com.au': 'accounts.zoho.com.au',
  jp: 'accounts.zoho.jp',
};

export function zohoAccountsHost(dataCenter: string): string {
  return ZOHO_ACCOUNTS_HOSTS[dataCenter] ?? ZOHO_ACCOUNTS_HOSTS.com!;
}

/** Refresh a few seconds before Zoho actually expires it, so a token that's
 * about to lapse mid-request is never handed out. */
const EXPIRY_MARGIN_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const cache = new Map<string, CachedToken>();

export interface ZohoOAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Exchange a refresh token for a short-lived Bigin access token, reusing a
 * cached one while it's still valid.
 *
 * `now` is a parameter so cache expiry is testable without a fake clock, the
 * same convention `google/token.ts`'s `googleAccessToken` uses.
 */
export async function zohoAccessToken(
  oauth: ZohoOAuth,
  dataCenter: string,
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

  const res = await fetchImpl(`https://${zohoAccountsHost(dataCenter)}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Zoho token exchange failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!json.access_token) {
    throw new Error(
      `Zoho token exchange returned no access_token: ${json.error ?? 'unknown error'}`,
    );
  }

  const expiresAt = now + (json.expires_in ?? 3600) * 1000 - EXPIRY_MARGIN_MS;
  cache.set(oauth.refreshToken, { accessToken: json.access_token, expiresAt });
  return json.access_token;
}

/** Test-only: clear the module-level cache between cases. */
export function clearZohoTokenCache(): void {
  cache.clear();
}
