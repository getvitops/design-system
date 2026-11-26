import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { clearZohoTokenCache } from '../crm/zoho-token.ts';
import { fetchSendFoxLists, fetchZohoCampaignsLists, missingLists } from './lists.ts';
import type { CampaignsConfig } from './types.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => clearZohoTokenCache());

const sendfox: CampaignsConfig = {
  provider: 'sendfox',
  lists: {
    waitlist: { label: 'Waitlist', sendfox: { listId: 11 } },
    blog: { label: 'Blog', sendfox: { listId: 22 } },
  },
};

describe('missingLists', () => {
  it('reports only the configured lists the account does not have', () => {
    const problems = missingLists(sendfox, [{ id: '11', name: 'Waitlist' }]);
    expect(problems).toEqual([
      { key: 'blog', id: '22', message: 'list "blog" (22) does not exist in this SendFox account' },
    ]);
  });

  it('compares a numeric SendFox id and a string live id as the same thing', () => {
    expect(
      missingLists(sendfox, [
        { id: '11', name: '' },
        { id: '22', name: '' },
      ]),
    ).toEqual([]);
  });

  it('checks a Zoho listKey', () => {
    const zoho: CampaignsConfig = {
      provider: 'zoho-campaigns',
      zohoCampaigns: { dataCenter: 'eu' },
      lists: { blog: { label: 'Blog', zohoCampaigns: { listKey: 'LK' } } },
    };
    expect(missingLists(zoho, [{ id: 'LK', name: 'Blog' }])).toEqual([]);
    expect(missingLists(zoho, [])[0]?.message).toContain('Zoho Campaigns');
  });

  it('skips a list with no id for the provider, which validateConfig already reports', () => {
    const odd: CampaignsConfig = {
      provider: 'sendfox',
      lists: { x: { label: 'X', zohoCampaigns: { listKey: 'k' } } },
    };
    expect(missingLists(odd, [])).toEqual([]);
  });
});

describe('fetchSendFoxLists', () => {
  const creds = { accessToken: 't' };

  it('reads data[] and follows a next_page_url on the SendFox host', async () => {
    const urls: string[] = [];
    const lists = await fetchSendFoxLists(creds, (async (url: string) => {
      urls.push(url);
      return urls.length === 1
        ? json({
            data: [{ id: 1, name: 'A' }],
            next_page_url: 'https://api.sendfox.com/lists?page=2',
          })
        : json({ data: [{ id: 2, name: 'B' }], next_page_url: null });
    }) as unknown as typeof fetch);
    expect(lists).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
    expect(urls).toHaveLength(2);
  });

  it('never follows a next_page_url that leaves the SendFox host', async () => {
    let calls = 0;
    await fetchSendFoxLists(creds, (async () => {
      calls++;
      return json({ data: [], next_page_url: 'https://evil.example/lists' });
    }) as unknown as typeof fetch);
    expect(calls).toBe(1);
  });

  it('names the paid-plan requirement and a bad token', async () => {
    await expect(
      fetchSendFoxLists(creds, (async () => json({}, 402)) as unknown as typeof fetch),
    ).rejects.toThrow('paid plan');
    await expect(
      fetchSendFoxLists(creds, (async () => json({}, 401)) as unknown as typeof fetch),
    ).rejects.toThrow('401');
  });
});

describe('fetchZohoCampaignsLists', () => {
  const creds = { clientId: 'c', clientSecret: 's', refreshToken: 'r' };

  it('exchanges a token, then pages getmailinglists until a short page', async () => {
    const seen: string[] = [];
    const lists = await fetchZohoCampaignsLists(creds, 'eu', (async (url: string) => {
      if (String(url).includes('/oauth/v2/token')) return json({ access_token: 'AT' });
      seen.push(url);
      return json({ list_of_details: [{ listkey: 'LK1', listname: 'Blog' }] });
    }) as unknown as typeof fetch);
    expect(lists).toEqual([{ id: 'LK1', name: 'Blog' }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('https://campaigns.zoho.eu/api/v1.1/getmailinglists?');
    expect(seen[0]).toContain('fromindex=1');
  });

  it('surfaces a 200-with-error body', async () => {
    await expect(
      fetchZohoCampaignsLists(creds, 'com', (async (url: string) =>
        String(url).includes('/oauth/v2/token')
          ? json({ access_token: 'AT' })
          : json({ status: 'error', message: 'No lists' })) as unknown as typeof fetch),
    ).rejects.toThrow('No lists');
  });
});
