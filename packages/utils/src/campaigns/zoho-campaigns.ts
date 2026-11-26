/**
 * Zoho Campaigns executor — `listsubscribe`, one call per list. Decides nothing.
 *
 * Reuses `crm/zoho-token.ts`: the OAuth refresh-token grant is the same across Zoho products,
 * only the scope and the API host differ. Needs its own refresh token, minted with scope
 * `ZohoCampaigns.contact.CREATE`. Double opt-in is a property of the Zoho list (its signup
 * confirmation setting), not of this request.
 *
 * Open item: Zoho's Campaigns docs name no Canadian host, so `ZOHO_CAMPAIGNS_DATA_CENTERS`
 * deliberately has no `ca`. Verify against a live Canadian-DC account before adding one.
 */
import { zohoAccessToken } from '../crm/zoho-token.ts';
import type {
  CampaignListOutcome,
  CampaignSubscriber,
  ZohoCampaignsConfig,
  ZohoCampaignsCredentials,
} from './types.ts';

const CAMPAIGNS_HOSTS: Record<string, string> = {
  com: 'campaigns.zoho.com',
  eu: 'campaigns.zoho.eu',
  in: 'campaigns.zoho.in',
  'com.au': 'campaigns.zoho.com.au',
  jp: 'campaigns.zoho.jp',
};

export function zohoCampaignsHost(dataCenter: string): string {
  return CAMPAIGNS_HOSTS[dataCenter] ?? CAMPAIGNS_HOSTS.com!;
}

/** Zoho's `contactinfo` uses its own display names for the standard fields. */
function contactInfo(subscriber: CampaignSubscriber): string {
  return JSON.stringify({
    'Contact Email': subscriber.email,
    ...(subscriber.firstName ? { 'First Name': subscriber.firstName } : {}),
    ...(subscriber.lastName ? { 'Last Name': subscriber.lastName } : {}),
  });
}

/**
 * Subscribe one contact to one list. Never throws.
 *
 * Zoho answers HTTP 200 for most failures and says so in the body (`status: "error"` with a
 * `code`), so success is classified on the body, never the status — the same lesson `jobber.ts` records.
 */
export async function subscribeToZohoCampaigns(
  subscriber: CampaignSubscriber,
  listKey: string,
  config: ZohoCampaignsConfig,
  credentials: ZohoCampaignsCredentials,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
  listName = listKey,
): Promise<CampaignListOutcome> {
  let token: string;
  try {
    token = await zohoAccessToken(credentials, config.dataCenter, fetchImpl);
  } catch (err) {
    return {
      key: listName,
      ok: false,
      reason: `Zoho token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const body = new URLSearchParams({
    resfmt: 'JSON',
    listkey: listKey,
    contactinfo: contactInfo(subscriber),
  });

  let res: Response;
  try {
    res = await fetchImpl(
      `https://${zohoCampaignsHost(config.dataCenter)}/api/v1.1/json/listsubscribe`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Zoho-oauthtoken ${token}`,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (err) {
    return {
      key: listName,
      ok: false,
      reason: `Zoho Campaigns request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const text = await res.text().catch(() => '');
  if (!res.ok)
    return { key: listName, ok: false, reason: `Zoho Campaigns responded ${res.status}: ${text}` };

  let json: { status?: string; code?: string | number; message?: string };
  try {
    json = JSON.parse(text);
  } catch {
    return {
      key: listName,
      ok: false,
      reason: `Zoho Campaigns returned an unparsable response: ${text}`,
    };
  }

  if (json.status !== 'success')
    return {
      key: listName,
      ok: false,
      reason: `Zoho Campaigns rejected the subscribe (${json.code ?? 'no code'}): ${json.message ?? text}`,
    };

  return { key: listName, ok: true };
}
