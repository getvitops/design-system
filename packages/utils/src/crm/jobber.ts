/**
 * Jobber executor — a GraphQL API, unlike both existing REST executors
 * (`hubspot.ts`, `bigin.ts`), and that difference is why this file classifies
 * differently from either of them.
 *
 * **GraphQL answers `200 OK` for failures.** A malformed query or a
 * permission/version problem returns a top-level `errors[]`; a rejected
 * mutation input returns `data.clientCreate.userErrors[]` — both with HTTP
 * 200. So classification here is four layers, in order: transport error →
 * HTTP status (401 credential, 429 rate limit) → top-level `errors[]` (a
 * query/permission/version problem) → `userErrors[]` (a mapping problem: an
 * unknown field, a missing required attribute). Only past all four is
 * `ok: true`.
 *
 * **Only `clientCreate` is verified against Jobber's own published docs.**
 * Two shapes here are NOT: `noteCreate` (Jobber's changelog records
 * `requestNoteCreate`/`requestUpsert` being *removed*, so the note surface is
 * genuinely in flux) and the `clients` query's dedupe filter argument. Until
 * both are checked against a live account's GraphiQL schema:
 *   - the note write is wrapped in `.catch(() => undefined)`, exactly like
 *     Bigin's `createPipelineRecord` — a failure here loses the note, never
 *     the already-written client, and never downgrades `ok: true`;
 *   - `dedupe` defaults to `false` rather than the eventually-intended `true`,
 *     so a misshapen filter never silently blocks a real submission. Turning
 *     it on is safe once the query is confirmed; document the confirmed
 *     shape in this docblock when that happens.
 *
 * Attribution (`record.attribution`) and unmapped extras (`record.extra`)
 * are rendered into the note body by default — that works on every Jobber
 * plan. `config.jobber` carries no separate custom-field wiring in this
 * pass: Jobber's app-configured custom fields need the Connect plan or
 * higher and their `clientCreate` input shape is a further unverified
 * surface, so `fieldMap`/`trackingFields` values still land as note lines
 * rather than a guessed custom-field mutation input.
 */
import type { CrmRecord, CrmResult, JobberConfig, JobberCredentials } from './types.ts';
import { jobberAccessToken } from './jobber-token.ts';

const JOBBER_GRAPHQL_ENDPOINT = 'https://api.getjobber.com/api/graphql';

/** Pinned to the version this integration was built and tested against.
 * Jobber's `X-JOBBER-GRAPHQL-VERSION` header is mandatory — an unversioned
 * request is rejected outright — so this is code, not something left to
 * config to supply by default. `config.jobber.apiVersion` is the escape
 * hatch for a client's app pinned to a different one. */
const JOBBER_API_VERSION = '2025-04-16';

interface JobberErrorItem {
  message: string;
}

interface ClientCreateResponse {
  data?: {
    clientCreate?: {
      client?: { id: string } | null;
      userErrors?: JobberErrorItem[];
    } | null;
  };
  errors?: JobberErrorItem[];
}

function clientCreateInput(record: CrmRecord): Record<string, unknown> {
  return {
    ...(record.firstName ? { firstName: record.firstName } : {}),
    ...(record.lastName ? { lastName: record.lastName } : {}),
    ...(record.company ? { companyName: record.company } : {}),
    ...(record.email
      ? { emails: [{ description: 'MAIN', primary: true, address: record.email }] }
      : {}),
    ...(record.phone
      ? { phones: [{ description: 'MAIN', primary: true, number: record.phone }] }
      : {}),
  };
}

/** Note body: the submitted message plus every attribution/extra field that
 * has no dedicated Jobber field, so nothing is lost to the note-vs-field
 * split above. Empty sections are omitted rather than rendered blank. */
function noteBody(record: CrmRecord, pageUri: string | undefined): string {
  const lines: string[] = [];
  if (record.message) lines.push(record.message);
  const extraEntries = Object.entries(record.extra);
  if (extraEntries.length) {
    lines.push('', ...extraEntries.map(([k, v]) => `${k}: ${v}`));
  }
  const attributionEntries = Object.entries(record.attribution);
  if (attributionEntries.length) {
    lines.push('', 'Attribution:', ...attributionEntries.map(([k, v]) => `${k}: ${v}`));
  }
  if (pageUri) lines.push('', `Submitted from ${pageUri}`);
  return lines.join('\n').trim();
}

async function graphql(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  apiVersion: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<Response> {
  return fetchImpl(JOBBER_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-jobber-graphql-version': apiVersion,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

const CLIENT_CREATE_MUTATION = `
  mutation CrmClientCreate($input: ClientCreateInput!) {
    clientCreate(input: $input) {
      client { id }
      userErrors { message }
    }
  }
`;

/** Best-effort — see the module docblock's note on the unverified
 * `noteCreate` shape. Any failure (transport, GraphQL error, or the mutation
 * simply not existing under this name) is swallowed by the caller. */
const NOTE_CREATE_MUTATION = `
  mutation CrmNoteCreate($input: NoteCreateInput!) {
    noteCreate(input: $input) {
      note { id }
      userErrors { message }
    }
  }
`;

async function createNote(
  clientId: string,
  message: string,
  token: string,
  apiVersion: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<void> {
  if (!message) return;
  const res = await graphql(
    NOTE_CREATE_MUTATION,
    { input: { clientId, message } },
    token,
    apiVersion,
    fetchImpl,
    timeoutMs,
  );
  const json = (await res.json()) as {
    errors?: JobberErrorItem[];
    data?: { noteCreate?: { userErrors?: JobberErrorItem[] } };
  };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const userErrors = json.data?.noteCreate?.userErrors;
  if (userErrors?.length) throw new Error(userErrors.map((e) => e.message).join('; '));
}

/** Best-effort — see the module docblock's note on the unverified `clients`
 * filter shape. A failure (or the field simply not matching this account's
 * schema) means "could not dedupe", not "stop the submission" — falls
 * through to creating a new client. */
const FIND_CLIENT_BY_EMAIL_QUERY = `
  query CrmFindClientByEmail($searchTerm: String!) {
    clients(first: 1, searchTerm: $searchTerm) {
      nodes { id }
    }
  }
`;

async function findExistingClientId(
  email: string,
  token: string,
  apiVersion: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<string | undefined> {
  const res = await graphql(
    FIND_CLIENT_BY_EMAIL_QUERY,
    { searchTerm: email },
    token,
    apiVersion,
    fetchImpl,
    timeoutMs,
  );
  const json = (await res.json()) as {
    errors?: JobberErrorItem[];
    data?: { clients?: { nodes?: { id: string }[] } };
  };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data?.clients?.nodes?.[0]?.id;
}

/**
 * Write one record to Jobber. Never throws — a token-exchange failure, a
 * network error, a top-level GraphQL `errors[]`, and a `userErrors[]` all
 * come back as a `CrmResult` with `ok: false`.
 */
export async function submitToJobber(
  record: CrmRecord,
  config: JobberConfig,
  credentials: JobberCredentials,
  pageUri: string | undefined,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<CrmResult> {
  const apiVersion = config.apiVersion ?? JOBBER_API_VERSION;

  let token: string;
  try {
    token = await jobberAccessToken(credentials, fetchImpl);
  } catch (err) {
    return {
      ok: false,
      provider: 'jobber',
      reason: `Jobber token exchange failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Dedupe defaults to false until the `clients` filter shape above is
  // verified against a live schema — see the module docblock.
  if (config.dedupe === true && record.email) {
    try {
      const existingId = await findExistingClientId(
        record.email,
        token,
        apiVersion,
        fetchImpl,
        timeoutMs,
      );
      if (existingId) {
        if (config.note?.enabled !== false) {
          await createNote(
            existingId,
            noteBody(record, pageUri),
            token,
            apiVersion,
            fetchImpl,
            timeoutMs,
          ).catch(() => undefined);
        }
        return { ok: true, provider: 'jobber', recordId: existingId };
      }
    } catch {
      // Could not dedupe — proceed to create rather than fail the submission.
    }
  }

  let res: Response;
  try {
    res = await graphql(
      CLIENT_CREATE_MUTATION,
      { input: clientCreateInput(record) },
      token,
      apiVersion,
      fetchImpl,
      timeoutMs,
    );
  } catch (err) {
    return {
      ok: false,
      provider: 'jobber',
      reason: `Jobber request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      provider: 'jobber',
      code: '401',
      reason: `Jobber rejected the access token: ${await res.text().catch(() => '')}`,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      provider: 'jobber',
      code: '429',
      reason: 'Jobber rate limit exceeded (2,500 requests per 5 minutes).',
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      provider: 'jobber',
      code: String(res.status),
      reason: `Jobber responded ${res.status}: ${await res.text().catch(() => '')}`,
    };
  }

  let json: ClientCreateResponse;
  try {
    json = (await res.json()) as ClientCreateResponse;
  } catch {
    return { ok: false, provider: 'jobber', reason: 'Jobber returned an unparsable response.' };
  }

  if (json.errors?.length) {
    return {
      ok: false,
      provider: 'jobber',
      reason: `Jobber rejected the request: ${json.errors.map((e) => e.message).join('; ')}`,
    };
  }

  const userErrors = json.data?.clientCreate?.userErrors;
  if (userErrors?.length) {
    return {
      ok: false,
      provider: 'jobber',
      reason: `Jobber rejected the mapped fields: ${userErrors.map((e) => e.message).join('; ')}`,
    };
  }

  const clientId = json.data?.clientCreate?.client?.id;
  if (!clientId) {
    return { ok: false, provider: 'jobber', reason: 'Jobber did not return a client id.' };
  }

  if (config.note?.enabled !== false) {
    await createNote(
      clientId,
      noteBody(record, pageUri),
      token,
      apiVersion,
      fetchImpl,
      timeoutMs,
    ).catch(() => undefined);
  }

  return { ok: true, provider: 'jobber', recordId: clientId };
}
