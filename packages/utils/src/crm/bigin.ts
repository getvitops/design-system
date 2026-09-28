/**
 * Zoho Bigin executor — decides nothing except the one thing it must refuse
 * to send: a record with no derivable last name (see `deriveLastName` in
 * `map.ts`). Everything else is "build the request, post it, classify the
 * response."
 *
 * `upsert` with `duplicate_check_fields: ['Email']` (configurable) rather than
 * plain `Contacts` create — a visitor resubmitting the same form (a second
 * enquiry, a retried failed submission) should update one contact, not create
 * a duplicate every time.
 */
import { deriveLastName } from './map.ts';
import type { BiginConfig, BiginCredentials, CrmRecord, CrmResult } from './types.ts';
import { zohoAccessToken } from './zoho-token.ts';

const ZOHO_API_HOSTS: Record<string, string> = {
  com: 'www.zohoapis.com',
  ca: 'www.zohoapis.ca',
  eu: 'www.zohoapis.eu',
  in: 'www.zohoapis.in',
  'com.au': 'www.zohoapis.com.au',
  jp: 'www.zohoapis.jp',
};

export function zohoApiHost(dataCenter: string): string {
  return ZOHO_API_HOSTS[dataCenter] ?? ZOHO_API_HOSTS.com!;
}

function biginFields(record: CrmRecord, lastName: string): Record<string, unknown> {
  return {
    Last_Name: lastName,
    ...(record.firstName ? { First_Name: record.firstName } : {}),
    ...(record.email ? { Email: record.email } : {}),
    ...(record.phone ? { Phone: record.phone } : {}),
    ...(record.company ? { Account_Name: record.company } : {}),
    ...(record.message ? { Description: record.message } : {}),
    ...record.extra,
    ...record.attribution,
    Lead_Source: 'Website',
  };
}

/**
 * Write one record to Bigin. Never throws — a token-exchange failure, a
 * network error and a rejected response all come back as `CrmResult`.
 */
export async function submitToBigin(
  record: CrmRecord,
  config: BiginConfig,
  credentials: BiginCredentials,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<CrmResult> {
  const derived = deriveLastName({
    firstName: record.firstName,
    lastName: record.lastName,
    fullName: [record.firstName, record.lastName].filter(Boolean).join(' ') || record.email || '',
    email: record.email,
  });
  if ('refusal' in derived) {
    return { ok: false, provider: 'bigin', reason: derived.refusal };
  }

  let token: string;
  try {
    token = await zohoAccessToken(credentials, config.dataCenter, fetchImpl);
  } catch (err) {
    return {
      ok: false,
      provider: 'bigin',
      reason: `Zoho token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const host = zohoApiHost(config.dataCenter);
  const url = `https://${host}/bigin/v2/Contacts/upsert`;
  const body = {
    data: [biginFields(record, derived.lastName)],
    duplicate_check_fields: [config.duplicateCheckField ?? 'Email'],
    trigger: ['workflow'],
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Zoho-oauthtoken ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      provider: 'bigin',
      reason: `Bigin request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return {
      ok: false,
      provider: 'bigin',
      code: String(res.status),
      reason: `Bigin responded ${res.status}: ${text}`,
    };
  }

  let json: { data?: { code?: string; status?: string; details?: { id?: string } }[] };
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      provider: 'bigin',
      reason: `Bigin returned an unparsable response: ${text}`,
    };
  }

  const entry = json.data?.[0];
  if (!entry || entry.status !== 'success') {
    return {
      ok: false,
      provider: 'bigin',
      code: entry?.code,
      reason: `Bigin upsert did not succeed: ${text}`,
    };
  }

  const contactId = entry.details?.id;

  // The pipeline write is additive and best-effort: the contact already
  // exists, so a failure here is a lost pipeline card, not a lost lead. It
  // never downgrades the overall `ok: true` the contact write already earned.
  if (config.pipeline?.enabled && contactId) {
    await createPipelineRecord(record, config, contactId, host, token, fetchImpl, timeoutMs).catch(
      () => undefined,
    );
  }

  return { ok: true, provider: 'bigin', recordId: contactId };
}

async function createPipelineRecord(
  record: CrmRecord,
  config: BiginConfig,
  contactId: string,
  host: string,
  token: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<void> {
  const pipeline = config.pipeline!;
  const body = {
    data: [
      {
        Pipeline_Name: record.company || record.email || 'Website enquiry',
        Contact_Name: contactId,
        ...(pipeline.subPipeline ? { Sub_Pipeline: pipeline.subPipeline } : {}),
        ...(pipeline.stage ? { Stage: pipeline.stage } : {}),
      },
    ],
    trigger: ['workflow'],
  };
  await fetchImpl(`https://${host}/bigin/v2/Pipelines`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Zoho-oauthtoken ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
