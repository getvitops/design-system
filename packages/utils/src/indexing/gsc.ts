/**
 * Google Search Console — the two things its API will actually do.
 *
 * Worth stating plainly, because the gap between what people expect and what
 * exists is the whole reason this module is small: **there is no "request
 * indexing" endpoint.** The button in the Search Console UI is not exposed in the
 * API or anywhere else, and the sitemap ping endpoint was removed in 2023. What
 * remains is `sitemaps.submit` (write) and `urlInspection` (read).
 *
 * The Indexing API is deliberately not wired here. It is scoped to `JobPosting`
 * and `BroadcastEvent`; it accepts other URLs and discards them, and using it for
 * general pages violates its terms with the consumer's own GCP project on the
 * line. A toolchain should not ship that as a documented path.
 *
 * Auth is minted by hand with `node:crypto` rather than through `googleapis`,
 * which would be an enormous dependency in a CLI that installs into every consumer
 * project, for two endpoints.
 */
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters';

/** The fields this module needs from a service-account JSON key. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Parse a service-account credential from its two supported sources.
 *
 * `VITOPS_GSC_SERVICE_ACCOUNT` holds the JSON inline (what a CI secret store
 * gives you); `GOOGLE_APPLICATION_CREDENTIALS` holds a path (Google's own
 * convention, and what a local `gcloud` setup already has). Supporting both means
 * neither environment has to be reshaped to fit the tool.
 */
export function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccount>;
  } catch {
    throw new Error('service account is not valid JSON');
  }
  if (!parsed.client_email || !parsed.private_key)
    throw new Error('service account JSON is missing client_email or private_key');
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

/**
 * Exchange a service-account key for an access token (RS256 JWT bearer flow).
 *
 * `now` is a parameter so this is testable without mocking the clock.
 */
export async function getAccessToken(
  account: ServiceAccount,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<string> {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  // `\n` survives most secret stores as a literal; normalise so a pasted key works.
  const pem = account.private_key.replace(/\\n/g, '\n');
  const assertion = `${header}.${claims}.${b64url(signer.sign(pem))}`;

  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    // The body names the cause (clock skew, wrong audience, revoked key) and
    // contains no secret — the assertion is in the request, not the response.
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error('token exchange returned no access_token');
  return access_token;
}

const encodeSite = (siteUrl: string) => encodeURIComponent(siteUrl);

/**
 * Re-submit a sitemap — the automated form of the manual resubmit in the UI.
 *
 * A `403` here almost always means `siteUrl` doesn't match the property exactly
 * (`sc-domain:acme.ca` vs `https://acme.ca/`) or the service account isn't an
 * owner of it, rather than that the sitemap is bad.
 */
export async function submitSitemap(
  token: string,
  siteUrl: string,
  sitemapUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeSite(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const res = await fetchImpl(url, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) return { ok: true, status: res.status };
  const detail =
    res.status === 403
      ? `403 — check that siteUrl "${siteUrl}" matches the Search Console property exactly and that the service account is an owner of it`
      : `${res.status}: ${await res.text()}`;
  return { ok: false, status: res.status, message: detail };
}

/** What the URL Inspection API said about one page. */
export interface InspectionResult {
  url: string;
  /** Google's verdict, e.g. `PASS`, `NEUTRAL`, `FAIL`. */
  verdict?: string;
  /** e.g. `INDEXING_ALLOWED`, `BLOCKED_BY_ROBOTS_TXT`. */
  coverageState?: string;
  lastCrawlTime?: string;
  /** True when Google reports the page as indexed. */
  indexed: boolean;
  error?: string;
}

/**
 * Inspect one URL. **Read-only** — this reports what Google did, it cannot ask for
 * anything. Quota is 2000 queries/day per property, which is why the caller works
 * from an explicit `priorityUrls` list rather than the whole sitemap.
 */
export async function inspectUrl(
  token: string,
  siteUrl: string,
  inspectionUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InspectionResult> {
  const res = await fetchImpl(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ inspectionUrl, siteUrl }),
    },
  );
  if (!res.ok)
    return { url: inspectionUrl, indexed: false, error: `${res.status}: ${await res.text()}` };

  const body = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string };
    };
  };
  const r = body.inspectionResult?.indexStatusResult ?? {};
  return {
    url: inspectionUrl,
    ...(r.verdict ? { verdict: r.verdict } : {}),
    ...(r.coverageState ? { coverageState: r.coverageState } : {}),
    ...(r.lastCrawlTime ? { lastCrawlTime: r.lastCrawlTime } : {}),
    // `PASS` is the only verdict that means indexed. `NEUTRAL` covers "discovered,
    // not indexed" and "excluded by canonical" — both are *not indexed*, and
    // reading them as success would make --check pass on the exact pages it exists
    // to catch.
    indexed: r.verdict === 'PASS',
  };
}
