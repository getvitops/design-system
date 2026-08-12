/**
 * `verifyTurnstileToken` never throws — a network failure, a non-2xx response
 * and an unparseable body all have to come back as data, because the caller
 * (`createConversionRoute`) has to decide what a failure means for a real
 * visitor's submission, not catch an exception from three layers down.
 */
import { describe, expect, it } from 'vitest';
import { verifyTurnstileToken } from './turnstile.ts';

function fakeFetch(response: { ok: boolean; status?: number; body?: unknown }): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body,
    }) as Response) as unknown as typeof fetch;
}

describe('verifyTurnstileToken', () => {
  it('reports success when Cloudflare says success', async () => {
    const fetchImpl = fakeFetch({ ok: true, body: { success: true } });
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result).toEqual({ success: true });
  });

  it('carries Cloudflare error codes through on a rejected token', async () => {
    const fetchImpl = fakeFetch({
      ok: true,
      body: { success: false, 'error-codes': ['timeout-or-duplicate'] },
    });
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result).toEqual({ success: false, errorCodes: ['timeout-or-duplicate'] });
  });

  it('never throws on an HTTP error status — comes back as a result', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 503 });
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(['http-503']);
  });

  it('never throws when fetch itself rejects (network failure)', async () => {
    const fetchImpl = (async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result.success).toBe(false);
    expect(result.errorCodes?.[0]).toContain('network-error');
  });

  it('never throws when the response body is not valid JSON', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result).toEqual({ success: false, errorCodes: ['malformed-response'] });
  });

  it('defaults to an "unknown-error" code when Cloudflare omits error-codes', async () => {
    const fetchImpl = fakeFetch({ ok: true, body: { success: false } });
    const result = await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);
    expect(result).toEqual({ success: false, errorCodes: ['unknown-error'] });
  });

  it('sends the token, secret and remoteip as form fields', async () => {
    let sentBody: URLSearchParams | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentBody = init?.body as URLSearchParams;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    }) as unknown as typeof fetch;

    await verifyTurnstileToken('tok', 'secret', '203.0.113.1', fetchImpl);

    expect(sentBody?.get('secret')).toBe('secret');
    expect(sentBody?.get('response')).toBe('tok');
    expect(sentBody?.get('remoteip')).toBe('203.0.113.1');
  });

  it('omits remoteip entirely when not given', async () => {
    let sentBody: URLSearchParams | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentBody = init?.body as URLSearchParams;
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    }) as unknown as typeof fetch;

    await verifyTurnstileToken('tok', 'secret', undefined, fetchImpl);

    expect(sentBody?.has('remoteip')).toBe(false);
  });
});
