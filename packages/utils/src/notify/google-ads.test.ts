/**
 * `uploadClickConversion`'s own shape — token exchange, request assembly,
 * and the three ways this can fail. Not verified against a live Ads account
 * (see the module's own docblock); this asserts what the code does, not that
 * Google's API actually accepts it.
 */
import { describe, expect, it } from 'vite-plus/test';
import {
  conversionActionResourceName,
  describeGoogleAdsOfflineResult,
  toGoogleConversionDateTime,
  uploadClickConversion,
  type GoogleAdsCredentials,
} from './google-ads.ts';

const res = (status: number, body: unknown = {}) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

/** Routes on URL: the token exchange, then the upload call. */
const stub = (uploadFn: (url: string, init?: RequestInit) => Response) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com')) return res(200, { access_token: 'ya29.ads' });
    return uploadFn(u, init);
  }) as unknown as typeof fetch;

const credentials: GoogleAdsCredentials = {
  developerToken: 'dev-token',
  oauth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
};

describe('conversionActionResourceName', () => {
  it('builds a resource name from a bare numeric id, stripping dashes from the customer id', () => {
    expect(conversionActionResourceName('123-456-7890', '999')).toBe(
      'customers/1234567890/conversionActions/999',
    );
  });

  it('passes an already-qualified resource name through unchanged', () => {
    expect(conversionActionResourceName('1234567890', 'customers/1/conversionActions/2')).toBe(
      'customers/1/conversionActions/2',
    );
  });
});

describe('toGoogleConversionDateTime', () => {
  it('renders the documented "yyyy-MM-dd HH:mm:ss+00:00" format in UTC', () => {
    expect(toGoogleConversionDateTime(Date.UTC(2026, 0, 5, 3, 4, 5))).toBe(
      '2026-01-05 03:04:05+00:00',
    );
  });
});

describe('uploadClickConversion', () => {
  const input = {
    customerId: '123-456-7890',
    conversionActionId: '999',
    clickId: { param: 'gclid', value: 'abc123' },
    at: Date.UTC(2026, 0, 5, 3, 4, 5),
  };

  it('posts the conversion with developer-token and login-customer-id headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    let seenBody: unknown;
    const result = await uploadClickConversion(
      input,
      { ...credentials, loginCustomerId: '999-888-7777' },
      stub((url, init) => {
        seenUrl = url;
        seenHeaders = init?.headers as Record<string, string>;
        seenBody = JSON.parse(String(init?.body));
        return res(200, {});
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(seenUrl).toBe(
      'https://googleads.googleapis.com/v17/customers/1234567890:uploadClickConversions',
    );
    expect(seenHeaders.authorization).toBe('Bearer ya29.ads');
    expect(seenHeaders['developer-token']).toBe('dev-token');
    expect(seenHeaders['login-customer-id']).toBe('9998887777');
    expect(seenBody).toEqual({
      conversions: [
        {
          conversionAction: 'customers/1234567890/conversionActions/999',
          gclid: 'abc123',
          conversionDateTime: '2026-01-05 03:04:05+00:00',
        },
      ],
      partialFailure: true,
    });
  });

  it('omits login-customer-id when the account is not MCC-managed', async () => {
    let seenHeaders: Record<string, string> = {};
    await uploadClickConversion(
      input,
      credentials,
      stub((_url, init) => {
        seenHeaders = init?.headers as Record<string, string>;
        return res(200, {});
      }),
    );
    expect(seenHeaders['login-customer-id']).toBeUndefined();
  });

  it('maps gbraid/wbraid click ids to their own request field, not gclid', async () => {
    let seenBody: { conversions: [{ gbraid?: string; gclid?: string }] } | undefined;
    await uploadClickConversion(
      { ...input, clickId: { param: 'gbraid', value: 'g123' } },
      credentials,
      stub((_url, init) => {
        seenBody = JSON.parse(String(init?.body));
        return res(200, {});
      }),
    );
    expect(seenBody?.conversions[0]?.gbraid).toBe('g123');
    expect(seenBody?.conversions[0]?.gclid).toBeUndefined();
  });

  it('fails with a stated reason when the token exchange fails', async () => {
    const result = await uploadClickConversion(input, credentials, (async () =>
      res(400, 'invalid_grant')) as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/token exchange failed/);
  });

  it('fails with the status and a 401-specific hint on a rejected token', async () => {
    const result = await uploadClickConversion(
      input,
      credentials,
      stub(() => res(401, 'unauthorized')),
    );
    expect(result).toMatchObject({ ok: false, code: '401' });
    expect(result.reason).toMatch(/rejected the access token/);
  });

  it('treats a 200 with partialFailureError as a failure, not a success', async () => {
    const result = await uploadClickConversion(
      input,
      credentials,
      stub(() => res(200, { partialFailureError: { message: 'INVALID_CONVERSION_ACTION' } })),
    );
    expect(result).toEqual({
      ok: false,
      reason: 'Google Ads rejected the conversion: INVALID_CONVERSION_ACTION',
    });
  });

  it('never throws on a network failure', async () => {
    const result = await uploadClickConversion(input, credentials, (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ECONNRESET/);
  });
});

describe('describeGoogleAdsOfflineResult', () => {
  it('is null when nothing was attempted', () => {
    expect(describeGoogleAdsOfflineResult(null)).toBeNull();
  });

  it('states success plainly', () => {
    expect(describeGoogleAdsOfflineResult({ ok: true })).toBe(
      'Reported to Google Ads (server-side)',
    );
  });

  it('states a failure with its reason', () => {
    expect(describeGoogleAdsOfflineResult({ ok: false, reason: 'boom' })).toBe(
      '⚠ Not reported to Google Ads: boom',
    );
  });
});
