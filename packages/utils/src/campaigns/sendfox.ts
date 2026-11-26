/**
 * SendFox executor — `POST /contacts` with the list ids in the body. Decides nothing.
 *
 * Double opt-in is an account-level SendFox setting, not a request flag, so it is a documented
 * setup requirement rather than something this call can assert.
 *
 * Unverified against a live account: SendFox's help centre shows `lists[]` as form pairs, its
 * developer docs describe an array of integers. This sends JSON with an integer array; confirm
 * on a test account and update this docblock with what was found.
 */
import type { CampaignListOutcome, CampaignSubscriber, SendFoxCredentials } from './types.ts';

const SENDFOX_CONTACTS_URL = 'https://api.sendfox.com/contacts';

export async function subscribeToSendFox(
  subscriber: CampaignSubscriber,
  listIds: number[],
  keys: string[],
  credentials: SendFoxCredentials,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<CampaignListOutcome[]> {
  const failAll = (reason: string): CampaignListOutcome[] =>
    keys.map((key) => ({ key, ok: false, reason }));

  let res: Response;
  try {
    res = await fetchImpl(SENDFOX_CONTACTS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        email: subscriber.email,
        ...(subscriber.firstName ? { first_name: subscriber.firstName } : {}),
        ...(subscriber.lastName ? { last_name: subscriber.lastName } : {}),
        lists: listIds,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return failAll(`SendFox request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return failAll(
      res.status === 401
        ? 'SendFox rejected the access token (401).'
        : res.status === 402
          ? 'SendFox API access needs a paid plan (402 on the Free plan).'
          : `SendFox responded ${res.status}: ${text}`,
    );
  }

  // One request covers every list, so one verdict does too.
  return keys.map((key) => ({ key, ok: true }));
}
