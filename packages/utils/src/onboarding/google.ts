/**
 * Google — the two APIs onboarding drives, and the user-OAuth token behind both.
 *
 * Auth here is a **user OAuth refresh token**, not a service account: verifying a
 * site and adding a Search Console property act *as a person* who can own them, not
 * as a project robot. That makes the token exchange simpler than the indexing
 * module's — a `refresh_token` grant, no JWT and no `node:crypto` — but it needs
 * broader scope, granted when the refresh token is minted:
 *   - `https://www.googleapis.com/auth/siteverification`  (Site Verification API)
 *   - `https://www.googleapis.com/auth/webmasters`        (Search Console API)
 *
 * The exchange itself lives in `../google/token.ts`, shared with `indexing/gsc.ts`
 * — the grants differ, everything after building the form body did not. It throws
 * (nothing downstream can run without a token) while every API call below returns
 * a structured result and lets the caller decide per domain. `googleapis` is
 * deliberately not a dependency — these are a handful of REST endpoints in a CLI
 * that installs into every consumer.
 */
import { googleAccessToken, type GoogleOAuth } from '../google/token.ts';

const SITEVERIFICATION = 'https://www.googleapis.com/siteVerification/v1';
const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';

/** Exchange a user OAuth refresh token for a short-lived access token. */
export function refreshTokenGrant(
  oauth: GoogleOAuth,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  return googleAccessToken({ kind: 'oauth', oauth }, fetchImpl);
}

const inetSite = (domain: string) => ({ type: 'INET_DOMAIN', identifier: domain });

/**
 * Ask the Site Verification API for the DNS_TXT token for a domain.
 *
 * Returns the full `google-site-verification=…` value that goes in the apex TXT
 * record. It is deterministic per (user, domain), so re-fetching it and comparing
 * against DNS is what makes the TXT step idempotent.
 */
export async function getVerificationToken(
  token: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; token?: string; message?: string }> {
  const res = await fetchImpl(`${SITEVERIFICATION}/token`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ verificationMethod: 'DNS_TXT', site: inetSite(domain) }),
  });
  if (!res.ok) return { ok: false, status: res.status, message: await res.text() };
  const body = (await res.json()) as { token?: string };
  if (!body.token) return { ok: false, status: res.status, message: 'no token in response' };
  return { ok: true, status: res.status, token: body.token };
}

/**
 * Look up the verified web resource for a domain, if any.
 *
 * Uses `webResource.list` rather than a `get` by id, because the id format for an
 * INET_DOMAIN resource is awkward to construct by hand and the list only ever
 * contains resources the user already owns — so a hit *is* the verified state, and
 * carries the id and owners the later steps need.
 */
export async function getWebResource(
  token: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  status: number;
  exists: boolean;
  id?: string;
  owners: string[];
  message?: string;
}> {
  const res = await fetchImpl(`${SITEVERIFICATION}/webResource`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    return { ok: false, status: res.status, exists: false, owners: [], message: await res.text() };
  const body = (await res.json()) as {
    items?: { id?: string; site?: { type?: string; identifier?: string }; owners?: string[] }[];
  };
  const match = body.items?.find(
    (it) => it.site?.type === 'INET_DOMAIN' && it.site?.identifier === domain,
  );
  if (!match) return { ok: true, status: res.status, exists: false, owners: [] };
  return {
    ok: true,
    status: res.status,
    exists: true,
    ...(match.id ? { id: match.id } : {}),
    owners: match.owners ?? [],
  };
}

/** Verify ownership (DNS_TXT). Succeeds only once the TXT record has propagated. */
export async function verifyWebResource(
  token: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; id?: string; owners: string[]; message?: string }> {
  const res = await fetchImpl(`${SITEVERIFICATION}/webResource?verificationMethod=DNS_TXT`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ site: inetSite(domain), verificationMethod: 'DNS_TXT' }),
  });
  if (!res.ok) return { ok: false, status: res.status, owners: [], message: await res.text() };
  const body = (await res.json()) as { id?: string; owners?: string[] };
  return {
    ok: true,
    status: res.status,
    ...(body.id ? { id: body.id } : {}),
    owners: body.owners ?? [],
  };
}

/**
 * Set the owners of a verified web resource to a given list.
 *
 * The API replaces the owner set, so the caller passes the **union** of the
 * current owners and the ones to add — never a bare list of new owners, which
 * would drop everyone already there.
 */
export async function updateOwners(
  token: string,
  id: string,
  domain: string,
  owners: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${SITEVERIFICATION}/webResource/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ id, site: inetSite(domain), owners }),
  });
  if (!res.ok) return { ok: false, status: res.status, message: await res.text() };
  return { ok: true, status: res.status };
}

const encodeSite = (siteUrl: string) => encodeURIComponent(siteUrl);

/** Whether a Search Console property already exists (`GET sites/{siteUrl}`). */
export async function getSite(
  token: string,
  siteUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; exists: boolean; message?: string }> {
  const res = await fetchImpl(`${WEBMASTERS}/sites/${encodeSite(siteUrl)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) return { ok: true, status: res.status, exists: true };
  if (res.status === 404) return { ok: true, status: res.status, exists: false };
  return { ok: false, status: res.status, exists: false, message: await res.text() };
}

/**
 * Add a Search Console property (`PUT sites/{siteUrl}`).
 *
 * A `403` here almost always means the domain is not yet verified for this user
 * rather than a transient error — property creation is gated on ownership.
 */
export async function addSite(
  token: string,
  siteUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${WEBMASTERS}/sites/${encodeSite(siteUrl)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) return { ok: true, status: res.status };
  const detail =
    res.status === 403
      ? `403 — "${siteUrl}" is not verified for this account yet, or the OAuth token lacks the webmasters scope`
      : `${res.status}: ${await res.text()}`;
  return { ok: false, status: res.status, message: detail };
}
