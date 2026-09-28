/**
 * DNS-over-HTTPS propagation probe.
 *
 * Nothing in this repo uses `node:dns` (checked before adding this file — see
 * `AGENTS.md`'s Conversion tracking section for the same reasoning applied to
 * onboarding), and a DNS resolution needs no credential, so DoH is a plain
 * `fetch` rather than a new runtime dependency. This confirms the records
 * Cloudflare's API says it created actually resolve — the Cloudflare API telling
 * you a record exists and the internet being able to see it are different facts,
 * and only the second one lets a visitor's mail actually authenticate.
 *
 * Polling policy (how many attempts, how long between them) is not here —
 * `onboarding/plan.ts`'s `backoffSchedule()` already is, and the CLI does the
 * sleeping, exactly as `search setup`'s DNS_TXT verification retry does.
 */
const DOH = 'https://cloudflare-dns.com/dns-query';

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

/** Resolve TXT records for a name over DoH. `NXDOMAIN`/no-answer both return `[]`. */
export async function resolveTxt(
  name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; contents: string[]; message?: string }> {
  const res = await fetchImpl(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) return { ok: false, contents: [], message: `HTTP ${res.status}` };
  const body = (await res.json()) as DohResponse;
  const contents = (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ''));
  return { ok: true, contents };
}
