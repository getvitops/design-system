/**
 * The shared token exchange — that each grant sends the right body, and that the
 * half they share behaves identically for both.
 *
 * The service-account grant had no test at all before this module existed: it
 * lived inside `indexing/gsc.ts` and the only way to reach it was over the
 * network. Signing is the part most likely to break silently (a literal `\n` in a
 * PEM out of a secret store is the classic), so it is asserted here rather than
 * discovered in CI.
 */
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { googleAccessToken, SCOPES, type ServiceAccount } from './token.ts';

const res = (status: number, body: unknown = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const stub = (fn: (url: string, init?: RequestInit) => Response) =>
  (async (url: string | URL | Request, init?: RequestInit) =>
    fn(String(url), init)) as unknown as typeof fetch;

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const account: ServiceAccount = {
  client_email: 'robot@acme.iam.gserviceaccount.com',
  private_key: pem,
};
const oauth = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };

/** Decode a JWT segment written in base64url. */
const segment = (jwt: string, i: number) =>
  JSON.parse(Buffer.from(jwt.split('.')[i]!, 'base64url').toString()) as Record<string, unknown>;

describe('service-account grant', () => {
  it('signs a JWT bearer assertion carrying the issuer, scope and audience', async () => {
    let body = '';
    const token = await googleAccessToken(
      { kind: 'service-account', account, scope: SCOPES.webmasters },
      stub((url, init) => {
        expect(url).toBe('https://oauth2.googleapis.com/token');
        body = String(init?.body);
        return res(200, { access_token: 'ya29.sa' });
      }),
      1_700_000_000_000,
    );
    expect(token).toBe('ya29.sa');

    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');

    const jwt = params.get('assertion')!;
    expect(segment(jwt, 0)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = segment(jwt, 1);
    expect(claims.iss).toBe('robot@acme.iam.gserviceaccount.com');
    expect(claims.scope).toBe(SCOPES.webmasters);
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    // `now` is injected, so the window is exact rather than approximately-now.
    expect(claims.iat).toBe(1_700_000_000);
    expect(claims.exp).toBe(1_700_000_000 + 3600);
  });

  it('accepts a key whose newlines survived a secret store as literal \\n', async () => {
    // The failure this prevents is an opaque crypto error at deploy time, from a
    // key that looks correct in the dashboard that stored it.
    const escaped: ServiceAccount = { ...account, private_key: pem.replace(/\n/g, '\\n') };
    await expect(
      googleAccessToken(
        { kind: 'service-account', account: escaped, scope: SCOPES.webmasters },
        stub(() => res(200, { access_token: 'ya29.sa' })),
      ),
    ).resolves.toBe('ya29.sa');
  });

  it('carries whichever scope it is given', async () => {
    let body = '';
    await googleAccessToken(
      { kind: 'service-account', account, scope: SCOPES.siteVerification },
      stub((_u, init) => {
        body = String(init?.body);
        return res(200, { access_token: 'x' });
      }),
    );
    const jwt = new URLSearchParams(body).get('assertion')!;
    expect(segment(jwt, 1).scope).toBe(SCOPES.siteVerification);
  });
});

describe('oauth grant', () => {
  it('posts a refresh_token grant with the client credentials', async () => {
    let body = '';
    const token = await googleAccessToken(
      { kind: 'oauth', oauth },
      stub((url, init) => {
        expect(url).toBe('https://oauth2.googleapis.com/token');
        body = String(init?.body);
        return res(200, { access_token: 'ya29.user' });
      }),
    );
    expect(token).toBe('ya29.user');
    const params = new URLSearchParams(body);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('client_id')).toBe('id');
    expect(params.get('client_secret')).toBe('secret');
    expect(params.get('refresh_token')).toBe('rt');
    // No scope: a user token's scopes are fixed when the refresh token is minted.
    expect(params.get('scope')).toBeNull();
  });
});

describe('the shared half', () => {
  const credentials = [
    ['service-account', { kind: 'service-account', account, scope: SCOPES.webmasters }],
    ['oauth', { kind: 'oauth', oauth }],
  ] as const;

  it.each(credentials)('%s: throws with the status and body on failure', async (_name, cred) => {
    // The body names the cause and holds no secret of ours, so it is surfaced
    // verbatim — an opaque "token exchange failed" is what this replaces.
    await expect(
      googleAccessToken(
        cred,
        stub(() => res(400, 'invalid_grant')),
      ),
    ).rejects.toThrow(/400.*invalid_grant/);
  });

  it.each(credentials)('%s: throws when a 200 carries no access_token', async (_name, cred) => {
    await expect(
      googleAccessToken(
        cred,
        stub(() => res(200, { expires_in: 3599 })),
      ),
    ).rejects.toThrow(/no access_token/);
  });

  it.each(credentials)('%s: posts form-encoded', async (_name, cred) => {
    await googleAccessToken(
      cred,
      stub((_u, init) => {
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>)['content-type']).toBe(
          'application/x-www-form-urlencoded',
        );
        return res(200, { access_token: 'x' });
      }),
    );
  });
});
