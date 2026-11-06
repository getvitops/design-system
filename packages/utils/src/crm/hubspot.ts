/**
 * HubSpot executor — decides nothing, posts what it's told.
 *
 * Uses the **secure** submissions endpoint (`/submissions/v3/integration/
 * secure/submit/{portalId}/{formGuid}`, private-app Bearer token) rather than
 * the public forms-embed endpoint. That distinction is load-bearing: posting
 * to the secure endpoint registers a real *form submission* against the
 * portal's form, so HubSpot's own workflows, lifecycle-stage automation and
 * attribution reporting fire exactly as if the client's hosted form had been
 * used — the public endpoint has no such effect and is also the one that
 * rejects a field not already declared on the form (see `CrmRecord`'s
 * drop-if-unmapped rule, which exists partly because of that).
 */
import type { CrmRecord, CrmResult, HubSpotConfig, HubSpotCredentials } from './types.ts';

const HUBSPOT_HOSTS: Record<NonNullable<HubSpotConfig['dataCenter']>, string> = {
  na: 'api.hsforms.com',
  eu: 'api-eu1.hsforms.com',
};

interface HubSpotField {
  objectTypeId: '0-1';
  name: string;
  value: string;
}

function fieldsFor(record: CrmRecord): HubSpotField[] {
  const fields: HubSpotField[] = [];
  const push = (name: string, value: string | undefined) => {
    if (value) fields.push({ objectTypeId: '0-1', name, value });
  };
  push('firstname', record.firstName);
  push('lastname', record.lastName);
  push('email', record.email);
  push('phone', record.phone);
  push('company', record.company);
  push('message', record.message);
  for (const [name, value] of Object.entries(record.extra)) push(name, value);
  for (const [name, value] of Object.entries(record.attribution)) push(name, value);
  return fields;
}

export interface HubSpotSubmitContext {
  hutk?: string | undefined;
  pageUri?: string | undefined;
  pageName?: string | undefined;
}

/**
 * Submit one record to HubSpot's secure forms endpoint.
 *
 * Never throws — a network failure or an unparsable response both come back
 * as a `CrmResult` with `ok: false`, the same "structured result, not an
 * exception" rule `security/turnstile.ts` and `indexing/gsc.ts` follow. Status
 * classification: 401 is a rejected/expired token; 400 naming
 * `MISSING_REQUIRED_FIELDS` or an unrecognised field name is a mapping
 * problem (`fieldMap`/`trackingFields` naming a property that isn't on the
 * form); 429 is the per-portal rate limit.
 */
export async function submitToHubSpot(
  record: CrmRecord,
  config: HubSpotConfig,
  credentials: HubSpotCredentials,
  context: HubSpotSubmitContext = {},
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<CrmResult> {
  const host = HUBSPOT_HOSTS[config.dataCenter ?? 'na'];
  const url = `https://${host}/submissions/v3/integration/secure/submit/${config.portalId}/${config.formGuid}`;

  const body = {
    fields: fieldsFor(record),
    context: {
      ...(context.hutk ? { hutk: context.hutk } : {}),
      ...(context.pageUri ? { pageUri: context.pageUri } : {}),
      ...(context.pageName ? { pageName: context.pageName } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      ok: false,
      provider: 'hubspot',
      reason: `HubSpot request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.ok) {
    return { ok: true, provider: 'hubspot' };
  }

  const text = await res.text().catch(() => '');

  if (res.status === 401) {
    return {
      ok: false,
      provider: 'hubspot',
      code: '401',
      reason: `HubSpot rejected the access token: ${text}`,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      provider: 'hubspot',
      code: '429',
      reason: 'HubSpot rate limit exceeded for this portal.',
    };
  }
  if (
    res.status === 400 &&
    /MISSING_REQUIRED_FIELDS|not.*(a|an).*(valid|known).*field/i.test(text)
  ) {
    return {
      ok: false,
      provider: 'hubspot',
      code: '400',
      reason: `HubSpot rejected the mapped fields — check \`fieldMap\`/\`trackingFields\` against the form's own fields: ${text}`,
    };
  }

  return {
    ok: false,
    provider: 'hubspot',
    code: String(res.status),
    reason: `HubSpot responded ${res.status}: ${text}`,
  };
}
