/**
 * Cloudflare DNS — the one thing this command writes.
 *
 * Scoped to exactly what onboarding needs and nothing more: find a zone by name,
 * read the apex TXT records, and *create* the verification TXT when it is missing.
 * There is deliberately no update and no delete — the command's contract is that it
 * never removes a DNS record, so the destructive verbs are simply absent rather
 * than guarded.
 *
 * The token is a `Zone:DNS:Edit` credential from the environment
 * (`CLOUDFLARE_API_TOKEN`); listing a zone by name also needs `Zone:Read`, which
 * Cloudflare's standard "Edit zone DNS" token template already bundles. As with the
 * indexing executors, `fetchImpl` is injected so the request shape is testable
 * without the network, and every call returns a structured result rather than
 * throwing — the caller decides what a failure means per domain.
 */
const API = 'https://api.cloudflare.com/client/v4';

interface CfEnvelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: T;
}

const cfError = (status: number, body: CfEnvelope<unknown>): string => {
  const first = body.errors?.[0];
  return first ? `${first.code} ${first.message}` : `HTTP ${status}`;
};

/** Find the zone id for a domain (`GET /zones?name=`). */
export async function findZoneId(
  token: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; zoneId?: string; message?: string }> {
  const res = await fetchImpl(`${API}/zones?name=${encodeURIComponent(domain)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as CfEnvelope<{ id: string; name: string }[]>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  const zone = body.result?.[0];
  if (!zone)
    return {
      ok: false,
      status: res.status,
      // Name the scope: this lookup is a GET /zones?name=, which needs
      // `Zone:Read` — a token carrying only `Zone:DNS:Edit` reaches here and
      // reads as "the zone isn't in this account", which sends you to the
      // wrong dashboard.
      message: `no Cloudflare zone named "${domain}" (is it in this account, and does the token carry Zone:Read as well as Zone:DNS:Edit? The "Edit zone DNS" template covers both.)`,
    };
  return { ok: true, status: res.status, zoneId: zone.id };
}

/** List the apex TXT record contents for a zone. */
export async function listApexTxt(
  token: string,
  zoneId: string,
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; contents: string[]; message?: string }> {
  const res = await fetchImpl(
    `${API}/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(domain)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await res.json()) as CfEnvelope<{ content: string }[]>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, contents: [], message: cfError(res.status, body) };
  // Cloudflare returns TXT content quoted; normalise so an exact compare works.
  const contents = (body.result ?? []).map((r) => r.content.replace(/^"|"$/g, ''));
  return { ok: true, status: res.status, contents };
}

/**
 * Create an apex TXT record. **Create only** — never called when one already
 * exists (the planner decides that), and there is no sibling that edits or removes.
 */
export async function createApexTxt(
  token: string,
  zoneId: string,
  domain: string,
  content: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'TXT', name: domain, content }),
  });
  const body = (await res.json()) as CfEnvelope<{ id: string }>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  return { ok: true, status: res.status };
}
