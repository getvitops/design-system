/**
 * The Google executor's decisions — not its transport.
 *
 * The judgment worth pinning: a refresh-token exchange failure throws (nothing
 * downstream can run), a 404 on a property is "does not exist" rather than an
 * error, verification is gated so a 403 on `addSite` is named as "not verified
 * yet", and `getWebResource` matches on the site identifier because the resource
 * id is awkward to construct by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  addSite,
  getSite,
  getVerificationToken,
  getWebResource,
  refreshTokenGrant,
  updateOwners,
  verifyWebResource,
} from './google.ts';

const res = (status: number, body: unknown = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

const stub = (fn: (url: string, init?: RequestInit) => Response) =>
  (async (url: string | URL | Request, init?: RequestInit) =>
    fn(String(url), init)) as unknown as typeof fetch;

const oauth = { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' };

describe('refreshTokenGrant', () => {
  it('posts a refresh_token grant and returns the access token', async () => {
    const token = await refreshTokenGrant(
      oauth,
      stub((url, init) => {
        expect(url).toBe('https://oauth2.googleapis.com/token');
        expect(String(init?.body)).toContain('grant_type=refresh_token');
        expect(String(init?.body)).toContain('refresh_token=rt');
        return res(200, { access_token: 'ya29.abc' });
      }),
    );
    expect(token).toBe('ya29.abc');
  });

  it('throws, naming the status, when the refresh token is revoked', async () => {
    await expect(
      refreshTokenGrant(
        oauth,
        stub(() => res(400, 'invalid_grant')),
      ),
    ).rejects.toThrow(/400/);
  });
});

describe('getVerificationToken', () => {
  it('requests a DNS_TXT token for the domain', async () => {
    const r = await getVerificationToken(
      'tok',
      'acme.ca',
      stub((url, init) => {
        expect(url).toContain('/siteVerification/v1/token');
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          verificationMethod: 'DNS_TXT',
          site: { type: 'INET_DOMAIN', identifier: 'acme.ca' },
        });
        return res(200, { token: 'google-site-verification=xyz' });
      }),
    );
    expect(r).toMatchObject({ ok: true, token: 'google-site-verification=xyz' });
  });
});

describe('getWebResource', () => {
  it('matches on the site identifier and returns owners', async () => {
    const r = await getWebResource(
      'tok',
      'acme.ca',
      stub(() =>
        res(200, {
          items: [
            {
              id: 'dns://acme.ca',
              site: { type: 'INET_DOMAIN', identifier: 'acme.ca' },
              owners: ['a@acme.ca'],
            },
          ],
        }),
      ),
    );
    expect(r).toMatchObject({ exists: true, id: 'dns://acme.ca', owners: ['a@acme.ca'] });
  });

  it('reports not-verified when no resource matches the domain', async () => {
    const r = await getWebResource(
      'tok',
      'acme.ca',
      stub(() => res(200, { items: [] })),
    );
    expect(r).toMatchObject({ exists: false, owners: [] });
  });
});

describe('verifyWebResource', () => {
  it('posts an insert with the DNS_TXT method', async () => {
    const r = await verifyWebResource(
      'tok',
      'acme.ca',
      stub((url, init) => {
        expect(url).toContain('verificationMethod=DNS_TXT');
        expect(init?.method).toBe('POST');
        return res(200, { id: 'dns://acme.ca', owners: ['a@acme.ca'] });
      }),
    );
    expect(r).toMatchObject({ ok: true, id: 'dns://acme.ca' });
  });

  it('fails (not throws) while the TXT record is still propagating', async () => {
    const r = await verifyWebResource(
      'tok',
      'acme.ca',
      stub(() => res(400, 'token not found in DNS')),
    );
    expect(r.ok).toBe(false);
  });
});

describe('updateOwners', () => {
  it('PUTs the full owner union at the resource id', async () => {
    const r = await updateOwners(
      'tok',
      'dns://acme.ca',
      'acme.ca',
      ['a@acme.ca', 'b@acme.ca'],
      stub((url, init) => {
        expect(url).toContain('/webResource/');
        expect(init?.method).toBe('PUT');
        expect(JSON.parse(String(init?.body)).owners).toEqual(['a@acme.ca', 'b@acme.ca']);
        return res(200, {});
      }),
    );
    expect(r.ok).toBe(true);
  });
});

describe('getSite / addSite', () => {
  it('reads a 404 as "does not exist", not an error', async () => {
    const r = await getSite(
      'tok',
      'sc-domain:acme.ca',
      stub(() => res(404)),
    );
    expect(r).toMatchObject({ ok: true, exists: false });
  });

  it('names a 403 on addSite as not-yet-verified', async () => {
    const r = await addSite(
      'tok',
      'sc-domain:acme.ca',
      stub(() => res(403, 'forbidden')),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not verified/);
  });

  it('PUTs the encoded sc-domain identifier on add', async () => {
    const r = await addSite(
      'tok',
      'sc-domain:acme.ca',
      stub((url, init) => {
        expect(url).toContain('/sites/sc-domain%3Aacme.ca');
        expect(init?.method).toBe('PUT');
        return res(200);
      }),
    );
    expect(r.ok).toBe(true);
  });
});
