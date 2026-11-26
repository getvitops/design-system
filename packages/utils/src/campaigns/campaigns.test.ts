import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearZohoTokenCache } from '../crm/zoho-token.ts';
import type { ConversionEvent } from '../tracking/types.ts';
import { describeCampaignsResult, deliverToCampaigns, isOptedIn, planCampaigns } from './index.ts';
import type { CampaignCredentials, CampaignsConfig } from './types.ts';

const sendfoxConfig: CampaignsConfig = {
  provider: 'sendfox',
  lists: {
    waitlist: { label: 'Waitlist', sendfox: { listId: 11 } },
    blog: { label: 'Blog updates', sendfox: { listId: 22 } },
  },
};
const sendfoxCreds: CampaignCredentials = { provider: 'sendfox', sendfox: { accessToken: 'tok' } };

const zohoConfig: CampaignsConfig = {
  provider: 'zoho-campaigns',
  zohoCampaigns: { dataCenter: 'eu' },
  lists: { waitlist: { label: 'Waitlist', zohoCampaigns: { listKey: 'LK1' } } },
};
const zohoCreds: CampaignCredentials = {
  provider: 'zoho-campaigns',
  zohoCampaigns: { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
};

const form = (
  formData: Record<string, string>,
  extra: Partial<ConversionEvent> = {},
): ConversionEvent => ({
  type: 'form',
  formData,
  tracking: null,
  at: Date.UTC(2026, 10, 26),
  ip: '203.0.113.9',
  ...extra,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => clearZohoTokenCache());

describe('isOptedIn', () => {
  it.each([
    ['on', true],
    ['yes', true],
    ['newsletter', true],
    ['', false],
    ['off', false],
    ['0', false],
    ['False', false],
    [undefined, false],
  ])('%s -> %s', (value, expected) =>
    expect(isOptedIn(value as string | undefined)).toBe(expected),
  );
});

describe('planCampaigns', () => {
  const ok = { email: 'a@b.ca', subscribe: 'on', list: 'waitlist' };

  it('subscribes an opted-in form to the named list', () => {
    const plan = planCampaigns(form(ok), sendfoxConfig, sendfoxCreds);
    expect(plan.enabled).toBe(true);
    expect(plan.lists.map((l) => l.key)).toEqual(['waitlist']);
  });

  it('skips when the opt-in box was not ticked', () => {
    const plan = planCampaigns(
      form({ email: 'a@b.ca', list: 'waitlist' }),
      sendfoxConfig,
      sendfoxCreds,
    );
    expect(plan).toMatchObject({ enabled: false, skip: expect.stringContaining('No opt-in') });
  });

  it('honours a custom consentField', () => {
    const plan = planCampaigns(
      form({ email: 'a@b.ca', agree: 'on', list: 'blog' }),
      { ...sendfoxConfig, consentField: 'agree' },
      sendfoxCreds,
    );
    expect(plan.enabled).toBe(true);
  });

  it('skips with no email', () => {
    const plan = planCampaigns(
      form({ subscribe: 'on', list: 'waitlist' }),
      sendfoxConfig,
      sendfoxCreds,
    );
    expect(plan.skip).toBe('No email address to subscribe.');
  });

  it('joins several lists named in one comma-joined value', () => {
    const plan = planCampaigns(
      form({ ...ok, list: 'waitlist, blog' }),
      sendfoxConfig,
      sendfoxCreds,
    );
    expect(plan.lists.map((l) => l.key)).toEqual(['waitlist', 'blog']);
  });

  it('defaults to the only list when none is named', () => {
    const plan = planCampaigns(form({ email: 'a@b.ca', subscribe: 'on' }), zohoConfig, zohoCreds);
    expect(plan.lists.map((l) => l.key)).toEqual(['waitlist']);
  });

  it('refuses to guess among several lists when none is named', () => {
    const plan = planCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on' }),
      sendfoxConfig,
      sendfoxCreds,
    );
    expect(plan).toMatchObject({ enabled: false, skip: expect.stringContaining('No list named') });
  });

  it('reports unknown keys but still subscribes the known ones', () => {
    const plan = planCampaigns(form({ ...ok, list: 'waitlist nope' }), sendfoxConfig, sendfoxCreds);
    expect(plan.enabled).toBe(true);
    expect(plan.unknown).toEqual(['nope']);
  });

  it('skips when every named list is unknown', () => {
    const plan = planCampaigns(form({ ...ok, list: 'nope' }), sendfoxConfig, sendfoxCreds);
    expect(plan).toMatchObject({ enabled: false, unknown: ['nope'] });
  });

  it('does not treat Object.prototype names as lists', () => {
    const plan = planCampaigns(form({ ...ok, list: 'constructor' }), sendfoxConfig, sendfoxCreds);
    expect(plan.enabled).toBe(false);
    expect(plan.unknown).toEqual(['constructor']);
  });

  it('skips a beacon', () => {
    expect(
      planCampaigns(
        { type: 'call', phone: '1', tracking: null, at: 0 },
        sendfoxConfig,
        sendfoxCreds,
      ).enabled,
    ).toBe(false);
  });

  it('states why when disabled, credential-less or mismatched', () => {
    expect(
      planCampaigns(form(ok), { ...sendfoxConfig, enabled: false }, sendfoxCreds).skip,
    ).toContain('enabled');
    expect(planCampaigns(form(ok), sendfoxConfig, undefined).skip).toContain(
      'SendFox access token',
    );
    expect(planCampaigns(form(ok), sendfoxConfig, zohoCreds).skip).toContain(
      'credentials are for "zoho-campaigns"',
    );
  });
});

describe('deliverToCampaigns — SendFox', () => {
  it('posts one request carrying every list id as a bearer-authenticated JSON body', async () => {
    const fetchMock = vi.fn(async () => json({ id: 1 }, 201));
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', first_name: 'Ada', subscribe: 'on', list: 'waitlist blog' }),
      sendfoxConfig,
      {
        credentials: sendfoxCreds,
        fetch: fetchMock as unknown as typeof fetch,
        pageUri: 'https://x.ca/join',
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sendfox.com/contacts');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.ca',
      first_name: 'Ada',
      lists: [11, 22],
    });
    expect(result?.ok).toBe(true);
    expect(describeCampaignsResult(result)).toBe(
      'Subscribed to waitlist, blog on SendFox (opt-in 2026-11-26T00:00:00.000Z from https://x.ca/join, ip 203.0.113.9)',
    );
  });

  it('classifies a 401 without throwing', async () => {
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on', list: 'waitlist' }),
      sendfoxConfig,
      {
        credentials: sendfoxCreds,
        fetch: (async () => json({}, 401)) as unknown as typeof fetch,
      },
    );
    expect(result?.ok).toBe(false);
    expect(describeCampaignsResult(result)).toContain('rejected the access token (401)');
  });

  it('survives a network error and a timeout', async () => {
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on', list: 'waitlist' }),
      sendfoxConfig,
      {
        credentials: sendfoxCreds,
        fetch: (async () => {
          throw new Error('boom');
        }) as unknown as typeof fetch,
      },
    );
    expect(result).toMatchObject({ ok: false, lists: [{ key: 'waitlist', ok: false }] });
  });
});

describe('deliverToCampaigns — Zoho Campaigns', () => {
  const handler = (listsubscribe: () => Response) =>
    vi.fn(async (url: string) =>
      String(url).includes('/oauth/v2/token')
        ? json({ access_token: 'AT', expires_in: 3600 })
        : listsubscribe(),
    );

  it('exchanges a token, then posts listsubscribe to the data-centre host', async () => {
    const fetchMock = handler(() => json({ status: 'success', code: '0', message: 'ok' }));
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', last_name: 'Lovelace', subscribe: 'on' }),
      zohoConfig,
      {
        credentials: zohoCreds,
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]![0]).toContain('accounts.zoho.eu/oauth/v2/token');
    expect(calls[1]![0]).toBe('https://campaigns.zoho.eu/api/v1.1/json/listsubscribe');
    expect((calls[1]![1].headers as Record<string, string>).authorization).toBe(
      'Zoho-oauthtoken AT',
    );
    const body = new URLSearchParams(calls[1]![1].body as string);
    expect(body.get('listkey')).toBe('LK1');
    expect(JSON.parse(body.get('contactinfo')!)).toEqual({
      'Contact Email': 'a@b.ca',
      'Last Name': 'Lovelace',
    });
    expect(result?.ok).toBe(true);
  });

  it('classifies on the body, because Zoho answers 200 for failures', async () => {
    const fetchMock = handler(() =>
      json({ status: 'error', code: '2001', message: 'List not found' }, 200),
    );
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on' }),
      zohoConfig,
      {
        credentials: zohoCreds,
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(result?.ok).toBe(false);
    expect(describeCampaignsResult(result)).toContain('2001');
  });

  it('isolates one failing list from the others', async () => {
    const config: CampaignsConfig = {
      ...zohoConfig,
      lists: {
        a: { label: 'A', zohoCampaigns: { listKey: 'KA' } },
        b: { label: 'B', zohoCampaigns: { listKey: 'KB' } },
      },
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/oauth/v2/token')) return json({ access_token: 'AT' });
      return new URLSearchParams(init!.body as string).get('listkey') === 'KA'
        ? json({ status: 'success' })
        : json({ status: 'error', code: '9', message: 'nope' });
    });
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on', list: 'a b' }),
      config,
      {
        credentials: zohoCreds,
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(result?.lists).toMatchObject([
      { key: 'a', ok: true },
      { key: 'b', ok: false },
    ]);
    expect(result?.ok).toBe(false);
  });

  it('reports a failed token exchange', async () => {
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', subscribe: 'on' }),
      zohoConfig,
      {
        credentials: zohoCreds,
        fetch: (async () => json({ error: 'invalid_code' }, 400)) as unknown as typeof fetch,
      },
    );
    expect(describeCampaignsResult(result)).toContain('token exchange failed');
  });
});

describe('deliverToCampaigns — silence', () => {
  it('returns null with no campaigns block, so an ordinary enquiry adds no notification line', async () => {
    expect(await deliverToCampaigns(form({ email: 'a@b.ca' }), undefined)).toBeNull();
    expect(describeCampaignsResult(null)).toBeNull();
  });

  it('never calls the provider when the box was not ticked', async () => {
    const fetchMock = vi.fn();
    const result = await deliverToCampaigns(
      form({ email: 'a@b.ca', list: 'waitlist' }),
      sendfoxConfig,
      {
        credentials: sendfoxCreds,
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.ok).toBe(false);
  });
});
