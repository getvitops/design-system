/**
 * Cloudflare Email Sending — read-only state plus the one write this module makes
 * (`POST … /subdomains`, enable a sending name).
 *
 * `wrangler email sending list` has no `--json` (checked against wrangler 4.119.0),
 * so this calls the same REST endpoints wrangler itself does rather than scraping
 * its text table — the same reasoning `onboarding/cloudflare.ts` states for why it
 * calls the API directly instead of shelling to a CLI.
 *
 * `fetchImpl` is injected, every call returns a structured result rather than
 * throwing, and the caller decides what a failure means — the same contract as
 * `onboarding/cloudflare.ts` and `ads/plan.ts`'s executor.
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

interface RawSubdomain {
  name: string;
  enabled: boolean;
  tag: string;
  dkim_selector?: string;
  return_path_domain?: string;
}

const fromRaw = (s: RawSubdomain) => ({
  name: s.name,
  enabled: s.enabled,
  tag: s.tag,
  ...(s.dkim_selector ? { dkimSelector: s.dkim_selector } : {}),
  ...(s.return_path_domain ? { returnPathDomain: s.return_path_domain } : {}),
});

/**
 * Find the zone a host belongs to, walking labels from most to least specific —
 * the same walk `wrangler`'s own `resolveDomain` does, because a sending name is
 * usually a subdomain (`send.example.com`) and Cloudflare zones are registered at
 * the apex. Tries `send.example.com`, then `example.com`, stopping at the first
 * match. No public-suffix list: Cloudflare simply won't have a zone at a bare
 * suffix like `co.uk`, so the walk is safe without one.
 */
export async function findZoneForHost(
  token: string,
  host: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; zoneId?: string; zoneName?: string; message?: string }> {
  const labels = host.split('.');
  let lastStatus = 0;
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join('.');
    const res = await fetchImpl(`${API}/zones?name=${encodeURIComponent(candidate)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as CfEnvelope<{ id: string; name: string }[]>;
    lastStatus = res.status;
    if (!res.ok || !body.success)
      return { ok: false, status: res.status, message: cfError(res.status, body) };
    const zone = body.result?.[0];
    if (zone) return { ok: true, status: res.status, zoneId: zone.id, zoneName: zone.name };
  }
  return {
    ok: false,
    status: lastStatus,
    message: `no Cloudflare zone found for "${host}" or any parent domain (is it in this account, and does the token carry Zone:Read?)`,
  };
}

/** Every sending name onboarded in one zone (`GET /zones/{id}/email/sending/subdomains`). */
export async function listSendingSubdomains(
  token: string,
  zoneId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  status: number;
  subdomains: {
    name: string;
    enabled: boolean;
    tag: string;
    dkimSelector?: string;
    returnPathDomain?: string;
  }[];
  message?: string;
}> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/email/sending/subdomains`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as CfEnvelope<RawSubdomain[]>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, subdomains: [], message: cfError(res.status, body) };
  return { ok: true, status: res.status, subdomains: (body.result ?? []).map(fromRaw) };
}

/**
 * Enable Email Sending for a name (`POST … /subdomains`). Create only — there is
 * no update/delete verb here, matching every other onboarding executor's
 * never-remove contract; disabling a live sending domain is left to the operator.
 */
export async function enableSending(
  token: string,
  zoneId: string,
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; tag?: string; message?: string }> {
  const res = await fetchImpl(`${API}/zones/${zoneId}/email/sending/subdomains`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as CfEnvelope<RawSubdomain>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, message: cfError(res.status, body) };
  // `tag` doubles as the subdomain id `sendingDns` addresses — Cloudflare's
  // response names it `tag`, not `id`.
  return { ok: true, status: res.status, ...(body.result?.tag ? { tag: body.result.tag } : {}) };
}

interface RawDnsRecord {
  type: string;
  name: string;
  content: string;
  priority?: number;
}

/** The DNS records Cloudflare expects for one sending name (`… /subdomains/{id}/dns`). */
export async function sendingDns(
  token: string,
  zoneId: string,
  subdomainId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{
  ok: boolean;
  status: number;
  records: { type: 'MX' | 'TXT'; name: string; content: string; priority?: number }[];
  message?: string;
}> {
  const res = await fetchImpl(
    `${API}/zones/${zoneId}/email/sending/subdomains/${subdomainId}/dns`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await res.json()) as CfEnvelope<RawDnsRecord[]>;
  if (!res.ok || !body.success)
    return { ok: false, status: res.status, records: [], message: cfError(res.status, body) };
  const records = (body.result ?? [])
    .filter((r): r is RawDnsRecord & { type: 'MX' | 'TXT' } => r.type === 'MX' || r.type === 'TXT')
    .map((r) => ({
      type: r.type,
      name: r.name,
      // Cloudflare returns TXT content quoted; normalise so an exact compare works.
      content: r.type === 'TXT' ? r.content.replace(/^"|"$/g, '') : r.content,
      ...(r.priority != null ? { priority: r.priority } : {}),
    }));
  return { ok: true, status: res.status, records };
}
