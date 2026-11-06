import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearZohoTokenCache } from './zoho-token.ts';
import { submitToBigin, zohoApiHost } from './bigin.ts';
import type { BiginConfig, BiginCredentials, CrmRecord } from './types.ts';

afterEach(() => clearZohoTokenCache());

const config: BiginConfig = { dataCenter: 'ca' };
const creds: BiginCredentials = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };
const record: CrmRecord = {
  firstName: 'Dana',
  lastName: 'Smith',
  email: 'dana@example.com',
  extra: {},
  attribution: {},
};

function tokenThenUpsert(status: number, upsertBody: unknown) {
  let call = 0;
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
    call += 1;
    if (call === 1) {
      return new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify(upsertBody), { status });
  });
}

describe('zohoApiHost', () => {
  it('maps ca to the .ca API host', () => {
    expect(zohoApiHost('ca')).toBe('www.zohoapis.ca');
  });
});

describe('submitToBigin', () => {
  it('refuses rather than write when no last name can be derived', async () => {
    const fetchImpl = vi.fn();
    const result = await submitToBigin(
      { email: undefined, extra: {}, attribution: {}, firstName: undefined },
      config,
      creds,
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('upserts with duplicate_check_fields on Email by default, exact URL and body', async () => {
    const fetchImpl = tokenThenUpsert(200, {
      data: [{ status: 'success', code: 'SUCCESS', details: { id: 'C1' } }],
    });
    const result = await submitToBigin(record, config, creds, fetchImpl);

    expect(result).toEqual({ ok: true, provider: 'bigin', recordId: 'C1' });
    const [url, init] = fetchImpl.mock.calls[1]!;
    expect(url).toBe('https://www.zohoapis.ca/bigin/v2/Contacts/upsert');
    expect((init!.headers as Record<string, string>).authorization).toBe('Zoho-oauthtoken at1');
    const body = JSON.parse(init!.body as string);
    expect(body.duplicate_check_fields).toEqual(['Email']);
    expect(body.data[0]).toMatchObject({
      Last_Name: 'Smith',
      First_Name: 'Dana',
      Email: 'dana@example.com',
    });
  });

  it('honours a configured duplicateCheckField', async () => {
    const fetchImpl = tokenThenUpsert(200, {
      data: [{ status: 'success' }],
    });
    await submitToBigin(record, { ...config, duplicateCheckField: 'Phone' }, creds, fetchImpl);
    const body = JSON.parse(fetchImpl.mock.calls[1]![1]!.body as string);
    expect(body.duplicate_check_fields).toEqual(['Phone']);
  });

  it('classifies a non-success Bigin response as a failure', async () => {
    const fetchImpl = tokenThenUpsert(200, {
      data: [{ status: 'error', code: 'MANDATORY_NOT_FOUND' }],
    });
    const result = await submitToBigin(record, config, creds, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MANDATORY_NOT_FOUND');
  });

  it('never throws when the token exchange fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    const result = await submitToBigin(record, config, creds, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/token exchange/);
  });
});
