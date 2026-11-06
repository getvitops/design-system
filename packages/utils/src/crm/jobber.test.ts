import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearJobberTokenCache } from './jobber-token.ts';
import { submitToJobber } from './jobber.ts';
import type { CrmRecord, JobberConfig, JobberCredentials } from './types.ts';

afterEach(() => clearJobberTokenCache());

const config: JobberConfig = {};
const creds: JobberCredentials = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };
const record: CrmRecord = {
  firstName: 'Dana',
  lastName: 'Smith',
  email: 'dana@example.com',
  message: 'Need a quote',
  extra: {},
  attribution: { gclid: 'abc123' },
};

/** Response queue: token exchange first, then whatever the test wants for
 * the GraphQL calls that follow (`clientCreate`, then a best-effort note). */
function fetchQueue(...responses: Response[]) {
  let call = 0;
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    const res = responses[call] ?? responses[responses.length - 1]!;
    call += 1;
    return res;
  });
}

const tokenResponse = () =>
  new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), { status: 200 });

describe('submitToJobber', () => {
  it('creates a client with the exact URL, headers and version', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
      new Response(JSON.stringify({ data: { noteCreate: { note: { id: 'N1' } } } }), {
        status: 200,
      }),
    );
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);

    expect(result).toEqual({ ok: true, provider: 'jobber', recordId: 'C1' });
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe('https://api.getjobber.com/api/graphql');
    const headers = init!.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer at1');
    expect(headers['x-jobber-graphql-version']).toBe('2025-04-16');
    const body = JSON.parse(init!.body as string);
    expect(body.query).toContain('clientCreate');
    expect(body.variables.input).toMatchObject({
      firstName: 'Dana',
      lastName: 'Smith',
      emails: [{ description: 'MAIN', primary: true, address: 'dana@example.com' }],
    });
  });

  it('honours a configured apiVersion override', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
      new Response('{}', { status: 200 }),
    );
    await submitToJobber(record, { apiVersion: '2099-01-01' }, creds, undefined, fetchImpl);
    const headers = fetchImpl.mock.calls[1]![1]!.headers as Record<string, string>;
    expect(headers['x-jobber-graphql-version']).toBe('2099-01-01');
  });

  it('classifies a 200 response carrying top-level errors as a failure', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(JSON.stringify({ errors: [{ message: 'unknown field "bogus"' }] }), {
        status: 200,
      }),
    );
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown field/);
  });

  it('classifies a 200 response carrying userErrors as a failure', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({
          data: { clientCreate: { client: null, userErrors: [{ message: 'Email is invalid' }] } },
        }),
        { status: 200 },
      ),
    );
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Email is invalid/);
  });

  it('classifies a 401 as a credential failure', async () => {
    const fetchImpl = fetchQueue(tokenResponse(), new Response('unauthorized', { status: 401 }));
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('401');
  });

  it('classifies a 429 as a rate-limit failure', async () => {
    const fetchImpl = fetchQueue(tokenResponse(), new Response('slow down', { status: 429 }));
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('429');
  });

  it('never throws when the token exchange fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/token exchange/);
  });

  it('a failed best-effort note never downgrades a successful client write', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
      new Response('server error', { status: 500 }),
    );
    const result = await submitToJobber(record, config, creds, undefined, fetchImpl);
    expect(result).toEqual({ ok: true, provider: 'jobber', recordId: 'C1' });
  });

  it('skips the note write entirely when note.enabled is false', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
    );
    await submitToJobber(record, { note: { enabled: false } }, creds, undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not attempt dedupe by default (dedupe defaults to false)', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
      new Response('{}', { status: 200 }),
    );
    await submitToJobber(record, config, creds, undefined, fetchImpl);
    const [, createInit] = fetchImpl.mock.calls[1]!;
    const createBody = JSON.parse(createInit!.body as string);
    expect(createBody.query).toContain('clientCreate');
  });

  it('reuses an existing client when dedupe is enabled and a match is found', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(JSON.stringify({ data: { clients: { nodes: [{ id: 'EXISTING' }] } } }), {
        status: 200,
      }),
      new Response(JSON.stringify({ data: { noteCreate: { note: { id: 'N1' } } } }), {
        status: 200,
      }),
    );
    const result = await submitToJobber(record, { dedupe: true }, creds, undefined, fetchImpl);
    expect(result).toEqual({ ok: true, provider: 'jobber', recordId: 'EXISTING' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('falls through to create when the dedupe lookup errors', async () => {
    const fetchImpl = fetchQueue(
      tokenResponse(),
      new Response(JSON.stringify({ errors: [{ message: 'no such field "searchTerm"' }] }), {
        status: 200,
      }),
      new Response(
        JSON.stringify({ data: { clientCreate: { client: { id: 'C1' }, userErrors: [] } } }),
        { status: 200 },
      ),
      new Response('{}', { status: 200 }),
    );
    const result = await submitToJobber(record, { dedupe: true }, creds, undefined, fetchImpl);
    expect(result).toEqual({ ok: true, provider: 'jobber', recordId: 'C1' });
  });
});
