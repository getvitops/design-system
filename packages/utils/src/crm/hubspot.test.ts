import { describe, expect, it, vi } from 'vite-plus/test';
import { submitToHubSpot } from './hubspot.ts';
import type { CrmRecord, HubSpotConfig, HubSpotCredentials } from './types.ts';

const config: HubSpotConfig = { portalId: '123', formGuid: 'abc' };
const creds: HubSpotCredentials = { accessToken: 'tok' };
const record: CrmRecord = {
  firstName: 'Dana',
  lastName: 'Smith',
  email: 'dana@example.com',
  extra: {},
  attribution: { google_click_id: 'G1' },
};

function fetchReturning(status: number, body: unknown) {
  return vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
}

describe('submitToHubSpot', () => {
  it('posts to the secure submit endpoint with the exact URL, headers and fields', async () => {
    const fetchImpl = fetchReturning(200, { inlineMessage: 'ok' });
    await submitToHubSpot(record, config, creds, { hutk: 'h1', pageUri: '/contact' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.hsforms.com/submissions/v3/integration/secure/submit/123/abc');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok');
    const body = JSON.parse(init!.body as string);
    expect(body.context).toEqual({ hutk: 'h1', pageUri: '/contact' });
    expect(body.fields).toContainEqual({ objectTypeId: '0-1', name: 'firstname', value: 'Dana' });
    expect(body.fields).toContainEqual({
      objectTypeId: '0-1',
      name: 'google_click_id',
      value: 'G1',
    });
  });

  it('uses the EU host when configured', async () => {
    const fetchImpl = fetchReturning(200, {});
    await submitToHubSpot(record, { ...config, dataCenter: 'eu' }, creds, {}, fetchImpl);
    expect(fetchImpl.mock.calls[0]![0]).toContain('api-eu1.hsforms.com');
  });

  it('returns ok on 200', async () => {
    const result = await submitToHubSpot(record, config, creds, {}, fetchReturning(200, {}));
    expect(result).toEqual({ ok: true, provider: 'hubspot' });
  });

  it('classifies 401 as a credential problem', async () => {
    const result = await submitToHubSpot(
      record,
      config,
      creds,
      {},
      fetchReturning(401, 'bad token'),
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('401');
  });

  it('classifies 429 as a rate limit', async () => {
    const result = await submitToHubSpot(record, config, creds, {}, fetchReturning(429, ''));
    expect(result.code).toBe('429');
  });

  it('classifies a missing-required-fields 400 as a mapping problem', async () => {
    const result = await submitToHubSpot(
      record,
      config,
      creds,
      {},
      fetchReturning(400, 'MISSING_REQUIRED_FIELDS: lastname'),
    );
    expect(result.reason).toMatch(/fieldMap/);
  });

  it('never throws on a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await submitToHubSpot(record, config, creds, {}, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/network down/);
  });
});
