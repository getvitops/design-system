import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearZohoTokenCache, zohoAccessToken, zohoAccountsHost } from './zoho-token.ts';

const oauth = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };

afterEach(() => clearZohoTokenCache());

describe('zohoAccountsHost', () => {
  it('maps the ca data centre to the .ca accounts host', () => {
    expect(zohoAccountsHost('ca')).toBe('accounts.zohocloud.ca');
  });

  it('falls back to .com for an unknown data centre', () => {
    expect(zohoAccountsHost('bogus')).toBe('accounts.zoho.com');
  });
});

describe('zohoAccessToken', () => {
  it('exchanges the refresh token against the right host', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), { status: 200 }),
    );
    const token = await zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000);
    expect(token).toBe('at1');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://accounts.zohocloud.ca/oauth/v2/token');
    expect(init!.body).toContain('refresh_token=rt');
  });

  it('caches the token and skips a second exchange while still valid', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), { status: 200 }),
    );
    await zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000);
    await zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000 + 1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-exchanges once the cached token is past its expiry margin', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 60 }), { status: 200 }),
    );
    await zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000);
    // 60s expiry minus the 60s margin means it's already stale a moment later.
    await zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000 + 5000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws with the response body on a failed exchange', async () => {
    const fetchImpl = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    await expect(zohoAccessToken(oauth, 'ca', fetchImpl, 1_000_000)).rejects.toThrow(
      /invalid_grant/,
    );
  });
});
