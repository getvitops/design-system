import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { clearJobberTokenCache, jobberAccessToken } from './jobber-token.ts';

const oauth = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };

afterEach(() => clearJobberTokenCache());

describe('jobberAccessToken', () => {
  it('exchanges the refresh token against the fixed oauth endpoint', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), { status: 200 }),
    );
    const token = await jobberAccessToken(oauth, fetchImpl, 1_000_000);
    expect(token).toBe('at1');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.getjobber.com/api/oauth/token');
    expect(init!.body).toContain('refresh_token=rt');
  });

  it('caches the token and skips a second exchange while still valid', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 3600 }), { status: 200 }),
    );
    await jobberAccessToken(oauth, fetchImpl, 1_000_000);
    await jobberAccessToken(oauth, fetchImpl, 1_000_000 + 1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-exchanges once the cached token is past its expiry margin', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'at1', expires_in: 60 }), { status: 200 }),
    );
    await jobberAccessToken(oauth, fetchImpl, 1_000_000);
    await jobberAccessToken(oauth, fetchImpl, 1_000_000 + 5000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws with the response body on a failed exchange', async () => {
    const fetchImpl = vi.fn(async () => new Response('invalid_grant', { status: 400 }));
    await expect(jobberAccessToken(oauth, fetchImpl, 1_000_000)).rejects.toThrow(/invalid_grant/);
  });

  it('accepts an unchanged refresh token in the response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: 'at1', refresh_token: 'rt', expires_in: 3600 }),
          { status: 200 },
        ),
    );
    await expect(jobberAccessToken(oauth, fetchImpl, 1_000_000)).resolves.toBe('at1');
  });

  it('throws a specific, actionable error when Jobber rotates the refresh token', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ access_token: 'at1', refresh_token: 'new-rt', expires_in: 3600 }),
          { status: 200 },
        ),
    );
    await expect(jobberAccessToken(oauth, fetchImpl, 1_000_000)).rejects.toThrow(
      /Refresh Token Rotation/,
    );
  });
});
