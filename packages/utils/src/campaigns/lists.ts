/**
 * Live list vocabulary, for `vitops campaigns check`: which lists the account actually has, so a
 * `listKey`/`listId` that does not exist is caught at check time, not as a failed signup.
 *
 * Read-only. Worker-safe like the rest of the module, though only the CLI calls it.
 *
 * Unverified against a live account, and said so rather than guessed: SendFox's `GET /lists` is
 * documented as `{ data: [{ id, name }] }` and paginated, but the pagination keys come from a
 * third-party mirror (this follows a Laravel-style `next_page_url` when present). Zoho's
 * `getmailinglists` returns `list_of_details[{ listkey, listname }]`, paged by `fromindex`/`range`.
 */
import { zohoAccessToken } from '../crm/zoho-token.ts';
import { zohoCampaignsHost } from './zoho-campaigns.ts';
import type { CampaignsConfig, SendFoxCredentials, ZohoCampaignsCredentials } from './types.ts';

export interface LiveList {
  /** Zoho's `listkey` or SendFox's numeric id, as a string, so one comparison serves both. */
  id: string;
  name: string;
}

/** A hard stop so a misbehaving pagination cannot loop forever. */
const MAX_PAGES = 20;

export async function fetchSendFoxLists(
  credentials: SendFoxCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveList[]> {
  const out: LiveList[] = [];
  let url: string | null = 'https://api.sendfox.com/lists';
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${credentials.accessToken}`, accept: 'application/json' },
    });
    if (res.status === 402)
      throw new Error('SendFox API access needs a paid plan (402 on the Free plan)');
    if (res.status === 401) throw new Error('SendFox rejected the access token (401)');
    if (!res.ok)
      throw new Error(`SendFox lists lookup failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as {
      data?: { id?: number | string; name?: string }[];
      next_page_url?: string | null;
    };
    for (const l of json.data ?? [])
      if (l.id !== undefined) out.push({ id: String(l.id), name: l.name ?? '' });
    // Only follow a link that stays on SendFox's API host, never one a response could redirect.
    url =
      typeof json.next_page_url === 'string' &&
      json.next_page_url.startsWith('https://api.sendfox.com/')
        ? json.next_page_url
        : null;
  }
  return out;
}

export async function fetchZohoCampaignsLists(
  credentials: ZohoCampaignsCredentials,
  dataCenter: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveList[]> {
  const token = await zohoAccessToken(credentials, dataCenter, fetchImpl);
  const range = 100;
  const out: LiveList[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({
      resfmt: 'JSON',
      fromindex: String(page * range + 1),
      range: String(range),
    });
    const res = await fetchImpl(
      `https://${zohoCampaignsHost(dataCenter)}/api/v1.1/getmailinglists?${query}`,
      { headers: { authorization: `Zoho-oauthtoken ${token}` } },
    );
    if (!res.ok)
      throw new Error(`Zoho Campaigns lists lookup failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as {
      list_of_details?: { listkey?: string; listname?: string }[];
      status?: string;
      message?: string;
    };
    // Zoho answers 200 with an error body, e.g. code 2401 when the account has no list yet.
    if (json.status === 'error') throw new Error(`Zoho Campaigns: ${json.message ?? 'error'}`);
    const batch = json.list_of_details ?? [];
    for (const l of batch) if (l.listkey) out.push({ id: l.listkey, name: l.listname ?? '' });
    if (batch.length < range) break;
  }
  return out;
}

export interface ListProblem {
  /** The key a form submits (`waitlist`). */
  key: string;
  /** The provider id the config asserts. */
  id: string;
  message: string;
}

/** The configured id of one list for the active provider. */
function configuredId(config: CampaignsConfig, key: string): string | undefined {
  const list = config.lists[key]!;
  const id =
    config.provider === 'zoho-campaigns' ? list.zohoCampaigns?.listKey : list.sendfox?.listId;
  return id === undefined ? undefined : String(id);
}

/**
 * Every configured list whose id is not in the live set. Pure.
 *
 * Both providers *reject or silently misfile* a subscribe to an id that does not exist, and
 * nothing in the config can tell you, which is the whole reason a `check` exists.
 */
export function missingLists(config: CampaignsConfig, live: LiveList[]): ListProblem[] {
  const known = new Set(live.map((l) => l.id));
  const problems: ListProblem[] = [];
  for (const key of Object.keys(config.lists)) {
    const id = configuredId(config, key);
    if (id === undefined) continue; // `validateConfig` already reports a missing id
    if (!known.has(id))
      problems.push({
        key,
        id,
        message: `list "${key}" (${id}) does not exist in this ${
          config.provider === 'zoho-campaigns' ? 'Zoho Campaigns' : 'SendFox'
        } account`,
      });
  }
  return problems;
}
