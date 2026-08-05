/**
 * Google OAuth2 token exchange — one request, two grants.
 *
 * Both of this package's Google modules need a bearer token, and both used to
 * mint one themselves. The two copies looked different because the *credentials*
 * differ, but everything after building the form body was identical: same
 * endpoint, same content-type, same "surface the response body as the error"
 * rule, same `access_token` extraction. So the seam is precise —
 * **credential → form params differs, params → token does not.**
 *
 * The two grants are kept because they are not accidental duplication; they track
 * how each command is actually run:
 *
 *   - **service account** (RS256 JWT bearer) for `search notify`, which runs on
 *     every deploy in CI. It never expires. A refresh token can be revoked, and
 *     for an OAuth client still in *Testing* publishing status Google expires it
 *     after 7 days — a bad property for a deploy step.
 *   - **user OAuth** (refresh-token grant) for `search setup`, which is a
 *     one-time human operation. Site verification makes the calling identity an
 *     *owner* of the property, and that should be a person, not a project robot.
 *
 * `googleapis` is deliberately not a dependency — this is one REST endpoint in a
 * CLI that installs into every consumer project. See AGENTS.md.
 *
 * Internal: not a published subpath. Both `./indexing` and `./onboarding` import
 * it, so it lands in a shared chunk, which is free for a Node library. (The
 * "don't create a shared chunk" rule in AGENTS.md is about browser bundles and
 * the consent gate.)
 */
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** The fields we need from a service-account JSON key. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** A user OAuth credential (refresh-token flow — never a service account). */
export interface GoogleOAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Which identity to act as.
 *
 * `scope` rides on the service-account variant because that grant carries its
 * scope in the signed assertion. A user OAuth token's scopes are fixed when the
 * refresh token is minted, so there is nothing to pass at exchange time — the
 * asymmetry is the protocol's, not ours.
 */
export type GoogleCredential =
  | { kind: 'service-account'; account: ServiceAccount; scope: string }
  | { kind: 'oauth'; oauth: GoogleOAuth };

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Sign the RS256 JWT assertion a service-account grant carries. */
function assertionFor(account: ServiceAccount, scope: string, now: number): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: account.client_email, scope, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  // `\n` survives most secret stores as a literal; normalise so a pasted key works.
  const pem = account.private_key.replace(/\\n/g, '\n');
  return `${header}.${claims}.${b64url(signer.sign(pem))}`;
}

/** The half that never differs: POST the grant, surface the cause, return the token. */
async function requestToken(body: URLSearchParams, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    // The body names the cause — clock skew, wrong audience or a revoked key for a
    // service account; `invalid_grant` / `invalid_client` for OAuth — and carries
    // no secret of ours: the assertion travels in the request, not the response.
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error('token exchange returned no access_token');
  return access_token;
}

/**
 * Exchange either credential for a short-lived access token.
 *
 * Throws rather than returning a result: nothing downstream can run without a
 * token, so there is no per-item decision for a caller to make. (The API calls
 * themselves do return structured results — those fail per domain.)
 *
 * `now` is a parameter so the assertion is testable without mocking the clock.
 */
export function googleAccessToken(
  credential: GoogleCredential,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<string> {
  const body =
    credential.kind === 'oauth'
      ? new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: credential.oauth.clientId,
          client_secret: credential.oauth.clientSecret,
          refresh_token: credential.oauth.refreshToken,
        })
      : new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: assertionFor(credential.account, credential.scope, now),
        });
  return requestToken(body, fetchImpl);
}

/** Scopes, named once so a caller never spells one out. */
export const SCOPES = {
  /** Search Console (`sitemaps.submit`, `urlInspection`, `sites`). */
  webmasters: 'https://www.googleapis.com/auth/webmasters',
  /** Site Verification API. */
  siteVerification: 'https://www.googleapis.com/auth/siteverification',
} as const;
