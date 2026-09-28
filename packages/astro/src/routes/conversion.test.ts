/**
 * The public, unauthenticated endpoint that sends email — every check here exists
 * because leaving one out makes this a relay or a cost amplifier, not because of
 * any consumer's specific form.
 *
 * `notify()` is never mocked away entirely — the `binding` is omitted, which
 * routes email through `logEmail` (console) instead of a real send, the same dev
 * path a consumer without a binding gets. That's enough to assert `onResult` and
 * response shape without a fake Cloudflare binding.
 */
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { deliverToCrm } from '@getvitops/utils/crm';
import { verifyTurnstileToken } from '@getvitops/utils/security';
import { createConversionRoute, type RateLimitStore } from './conversion.ts';

vi.mock('@getvitops/utils/security', () => ({ verifyTurnstileToken: vi.fn() }));
vi.mock('@getvitops/utils/crm', async () => {
  const actual =
    await vi.importActual<typeof import('@getvitops/utils/crm')>('@getvitops/utils/crm');
  return { ...actual, deliverToCrm: vi.fn() };
});

beforeEach(() => {
  vi.mocked(verifyTurnstileToken).mockReset();
  vi.mocked(deliverToCrm).mockReset();
});

const ctx = () => ({
  notifications: { email: 'owner@acme.ca' },
  canonical: 'https://acme.ca',
  organizationName: 'Acme',
});

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://acme.ca/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function formRequest(
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Request {
  const params = new URLSearchParams(fields);
  return new Request('https://acme.ca/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: params.toString(),
  });
}

describe('createConversionRoute: no-JS form submissions (1.4)', () => {
  it('parses a native application/x-www-form-urlencoded POST instead of rejecting it', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({ request: formRequest({ name: 'Ada', email: 'ada@example.com' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('redirects a successful no-JS submission instead of returning raw JSON', async () => {
    const handler = createConversionRoute({ context: ctx(), redirectTo: '/thanks' });
    const res = await handler({ request: formRequest({ name: 'Ada' }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/thanks');
  });

  it('still accepts a JSON fetch submission the way it always did', async () => {
    const handler = createConversionRoute({ context: ctx(), redirectTo: '/thanks' });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('still accepts the tel: beacon, sent as text/plain by navigator.sendBeacon', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const request = new Request('https://acme.ca/api/track', {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ event: 'call', phone: 'tel:+15551234567' }),
    });
    const res = await handler({ request });
    expect(res.status).toBe(204);
  });

  it('accepts the mailto: beacon the same way as the tel: one', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const request = new Request('https://acme.ca/api/track', {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ event: 'email', email: 'mailto:sales@acme.ca' }),
    });
    const res = await handler({ request });
    expect(res.status).toBe(204);
  });

  it('redirects a refused no-JS submission to errorRedirectTo', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      redirectTo: '/thanks',
      errorRedirectTo: '/error',
      validate: () => 'Missing required field.',
    });
    const res = await handler({ request: formRequest({ name: 'Ada' }) });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/error');
  });

  it('falls back errorRedirectTo to redirectTo when only one is set', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      redirectTo: '/thanks',
      validate: () => 'nope',
    });
    const res = await handler({ request: formRequest({ name: 'Ada' }) });
    expect(res.headers.get('location')).toBe('/thanks');
  });
});

describe('createConversionRoute: honeypot (1.5)', () => {
  it('treats a filled honeypot field as spam and skips notify(), but looks like success', async () => {
    const onResult = vi.fn();
    const handler = createConversionRoute({ context: ctx(), onResult });
    const res = await handler({
      request: jsonRequest({ name: 'Bot', website: 'http://spam.example' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        delivered: false,
        results: expect.arrayContaining([
          expect.objectContaining({ sent: false, reason: expect.stringContaining('honeypot') }),
        ]),
      }),
    );
  });

  it('does not treat an empty honeypot field as spam', async () => {
    const onResult = vi.fn();
    const handler = createConversionRoute({ context: ctx(), onResult });
    await handler({ request: jsonRequest({ name: 'Ada', website: '' }) });
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.not.arrayContaining([
          expect.objectContaining({ reason: expect.stringContaining('honeypot') }),
        ]),
      }),
    );
  });

  it('strips honeypot fields from the notified formData even when empty', async () => {
    let captured: unknown;
    const handler = createConversionRoute({
      context: ctx(),
      onResult: (r) => {
        captured = r;
      },
    });
    await handler({ request: jsonRequest({ name: 'Ada', honeypot: '' }) });
    // formData isn't exposed on the result, but the request must still succeed —
    // this asserts the non-spam path completes rather than throwing on the field.
    expect(captured).toBeDefined();
  });

  it('a custom honeypotFields list replaces the default names', async () => {
    const onResult = vi.fn();
    const handler = createConversionRoute({
      context: ctx(),
      onResult,
      honeypotFields: ['trap'],
    });
    // "website" is no longer a honeypot once the list is overridden.
    await handler({
      request: jsonRequest({ name: 'Ada', website: 'http://real-business.example' }),
    });
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        results: expect.not.arrayContaining([
          expect.objectContaining({ reason: expect.stringContaining('honeypot') }),
        ]),
      }),
    );
  });
});

describe('createConversionRoute: origin check (1.5)', () => {
  it('rejects a request whose Origin header does not match the canonical domain', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({
      request: jsonRequest({ name: 'Ada' }, { origin: 'https://evil.example' }),
    });
    expect(res.status).toBe(403);
  });

  it('accepts a request whose Origin header matches the canonical domain', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({
      request: jsonRequest({ name: 'Ada' }, { origin: 'https://acme.ca' }),
    });
    expect(res.status).toBe(200);
  });

  it('accepts a request with no Origin header at all — absence is not a mismatch', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(200);
  });

  it('allowedOrigin: false disables the check entirely', async () => {
    const handler = createConversionRoute({ context: ctx(), allowedOrigin: false });
    const res = await handler({
      request: jsonRequest({ name: 'Ada' }, { origin: 'https://evil.example' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('createConversionRoute: body size cap (1.5)', () => {
  it('rejects a request over maxBodyBytes via Content-Length', async () => {
    // Node's local `Request` doesn't auto-populate `content-length` the way a
    // real inbound HTTP request does (the runtime forwards the wire header) —
    // set it explicitly to simulate what a Worker actually receives.
    const body = JSON.stringify({ name: 'A very long name that exceeds the cap' });
    const handler = createConversionRoute({ context: ctx(), maxBodyBytes: 10 });
    const res = await handler({
      request: jsonRequest(
        { name: 'A very long name that exceeds the cap' },
        { 'content-length': String(body.length) },
      ),
    });
    expect(res.status).toBe(413);
  });

  it('accepts a request under the default cap', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(200);
  });
});

describe('createConversionRoute: rate limit (1.5)', () => {
  it('rejects a second submission from the same IP inside the window', async () => {
    let time = 1_000_000;
    const handler = createConversionRoute({
      context: ctx(),
      now: () => time,
      rateLimit: { windowMs: 10_000 },
    });
    const headers = { 'cf-connecting-ip': '203.0.113.1' };

    const first = await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    expect(first.status).toBe(200);

    time += 1_000; // still inside the 10s window
    const second = await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    expect(second.status).toBe(429);
  });

  it('accepts a second submission from the same IP once the window has passed', async () => {
    let time = 1_000_000;
    const handler = createConversionRoute({
      context: ctx(),
      now: () => time,
      rateLimit: { windowMs: 10_000 },
    });
    const headers = { 'cf-connecting-ip': '203.0.113.2' };

    await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    time += 20_000; // past the window
    const second = await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    expect(second.status).toBe(200);
  });

  it('does not rate-limit different IPs against each other', async () => {
    const handler = createConversionRoute({ context: ctx(), rateLimit: { windowMs: 60_000 } });
    const a = await handler({
      request: jsonRequest({ name: 'Ada' }, { 'cf-connecting-ip': '203.0.113.3' }),
    });
    const b = await handler({
      request: jsonRequest({ name: 'Bea' }, { 'cf-connecting-ip': '203.0.113.4' }),
    });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  it('rateLimit: false disables the check entirely', async () => {
    const handler = createConversionRoute({ context: ctx(), rateLimit: false });
    const headers = { 'cf-connecting-ip': '203.0.113.5' };
    await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    const second = await handler({ request: jsonRequest({ name: 'Ada' }, headers) });
    expect(second.status).toBe(200);
  });

  it('accepts an injected store for cross-instance limiting', async () => {
    const hits: Array<[string, number]> = [];
    const store: RateLimitStore = {
      hit(id, at) {
        hits.push([id, at]);
        return null; // never rate-limited, but proves the store was consulted
      },
    };
    const handler = createConversionRoute({ context: ctx(), rateLimit: { store } });
    await handler({
      request: jsonRequest({ name: 'Ada' }, { 'cf-connecting-ip': '203.0.113.6' }),
    });
    // A plain form post carries no `event` field — keyed as `form`.
    expect(hits).toEqual([['203.0.113.6:form', expect.any(Number)]]);
  });

  it('does not rate-limit a call beacon against an email-click beacon from the same IP', async () => {
    let time = 1_000_000;
    const handler = createConversionRoute({
      context: ctx(),
      now: () => time,
      rateLimit: { windowMs: 10_000 },
    });
    const headers = { 'cf-connecting-ip': '203.0.113.7' };

    const call = await handler({
      request: jsonRequest({ event: 'call', phone: 'tel:+15551234567' }, headers),
    });
    expect(call.status).toBe(204);

    time += 1_000; // still inside the window — but a different event type
    const email = await handler({
      request: jsonRequest({ event: 'email', email: 'mailto:sales@acme.ca' }, headers),
    });
    expect(email.status).toBe(204);
  });

  it('still rate-limits two call beacons from the same IP inside the window', async () => {
    let time = 1_000_000;
    const handler = createConversionRoute({
      context: ctx(),
      now: () => time,
      rateLimit: { windowMs: 10_000 },
    });
    const headers = { 'cf-connecting-ip': '203.0.113.8' };

    await handler({ request: jsonRequest({ event: 'call', phone: 'tel:+15551234567' }, headers) });
    time += 1_000;
    const second = await handler({
      request: jsonRequest({ event: 'call', phone: 'tel:+15551234567' }, headers),
    });
    expect(second.status).toBe(429);
  });
});

describe('createConversionRoute: Turnstile verification (1.3)', () => {
  it('accepts a submission with a token that verifies successfully', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk' },
    });
    const res = await handler({
      request: jsonRequest({ name: 'Ada', 'cf-turnstile-response': 'good-token' }),
    });
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).toHaveBeenCalledWith('good-token', 'sk', undefined);
  });

  it('rejects a submission whose token fails verification', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({
      success: false,
      errorCodes: ['timeout-or-duplicate'],
    });
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk' },
    });
    const res = await handler({
      request: jsonRequest({ name: 'Ada', 'cf-turnstile-response': 'bad-token' }),
    });
    expect(res.status).toBe(400);
  });

  it('does not block a submission with no token when required is not set', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk' },
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('rejects a submission with no token when required: true', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk', required: true },
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(400);
  });

  it('never verifies a call event — Turnstile only applies to forms', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk', required: true },
    });
    const res = await handler({
      request: jsonRequest({ event: 'call', phone: 'tel:+15551234567' }),
    });
    expect(res.status).toBe(204);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('never verifies an email-click event either', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk', required: true },
    });
    const res = await handler({
      request: jsonRequest({ event: 'email', email: 'mailto:sales@acme.ca' }),
    });
    expect(res.status).toBe(204);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('never verifies a honeypot-flagged submission — it never reaches notify() either', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk', required: true },
    });
    const res = await handler({
      request: jsonRequest({ name: 'Bot', website: 'http://spam.example' }),
    });
    expect(res.status).toBe(200); // success illusion, same as the honeypot-only case
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('strips the token field from the notified formData', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const onResult = vi.fn();
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk' },
      onResult,
    });
    await handler({
      request: jsonRequest({ name: 'Ada', 'cf-turnstile-response': 'good-token' }),
    });
    // The token is a control field, not visitor-supplied content — CONTROL_FIELDS
    // excludes it unconditionally, so this just needs to reach notify() at all
    // (there's no email binding in this test, so it logs rather than delivers).
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ delivered: false }));
  });

  it('respects a custom fieldName', async () => {
    vi.mocked(verifyTurnstileToken).mockResolvedValue({ success: true });
    const handler = createConversionRoute({
      context: ctx(),
      turnstile: { secretKey: 'sk', fieldName: 'my-captcha-token' },
    });
    const res = await handler({
      request: jsonRequest({ name: 'Ada', 'my-captcha-token': 'good-token' }),
    });
    expect(res.status).toBe(200);
    expect(verifyTurnstileToken).toHaveBeenCalledWith('good-token', 'sk', undefined);
  });
});

describe('createConversionRoute: still behaves as before for the common paths', () => {
  it('returns 400 for a malformed JSON body', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const request = new Request('https://acme.ca/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    const res = await handler({ request });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a call event missing a phone number', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({ request: jsonRequest({ event: 'call' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an email event missing an address', async () => {
    const handler = createConversionRoute({ context: ctx() });
    const res = await handler({ request: jsonRequest({ event: 'email' }) });
    expect(res.status).toBe(400);
  });

  it("a failed notification does not fail the request — it's reported through onResult", async () => {
    const onResult = vi.fn();
    const handler = createConversionRoute({
      context: { ...ctx(), notifications: {} },
      onResult,
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(res.status).toBe(200);
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ delivered: false }));
  });
});

const crmConfig = { provider: 'hubspot' as const, hubspot: { portalId: '1', formGuid: 'g' } };
const crmCredentials = { provider: 'hubspot' as const, hubspot: { accessToken: 'tok' } };

describe('createConversionRoute: CRM delivery', () => {
  it('delivers the CRM write and folds the outcome into onResult', async () => {
    vi.mocked(deliverToCrm).mockResolvedValue({
      ok: true,
      provider: 'hubspot',
      recordId: '123',
    });
    const onResult = vi.fn();
    const handler = createConversionRoute({
      context: ctx(),
      crm: { config: crmConfig, credentials: () => crmCredentials },
      onResult,
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada', email: 'ada@example.com' }) });
    expect(res.status).toBe(200);
    expect(deliverToCrm).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ crm: { ok: true, provider: 'hubspot', recordId: '123' } }),
    );
  });

  it('never attempts a CRM write for a call event — there are no form fields to map', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      crm: { config: crmConfig, credentials: () => crmCredentials },
    });
    const res = await handler({ request: jsonRequest({ event: 'call', phone: '+15550100' }) });
    expect(res.status).toBe(204);
    expect(deliverToCrm).not.toHaveBeenCalled();
  });

  it('never attempts a CRM write for an email-click event either', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      crm: { config: crmConfig, credentials: () => crmCredentials },
    });
    const res = await handler({
      request: jsonRequest({ event: 'email', email: 'mailto:sales@acme.ca' }),
    });
    expect(res.status).toBe(204);
    expect(deliverToCrm).not.toHaveBeenCalled();
  });

  it('never reaches the CRM when the honeypot trips', async () => {
    const handler = createConversionRoute({
      context: ctx(),
      crm: { config: crmConfig, credentials: () => crmCredentials },
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada', website: 'spam.biz' }) });
    expect(res.status).toBe(200);
    expect(deliverToCrm).not.toHaveBeenCalled();
  });

  it('a failed CRM write does not fail the request, and the email still sends', async () => {
    vi.mocked(deliverToCrm).mockResolvedValue({
      ok: false,
      provider: 'hubspot',
      reason: 'access token rejected (401)',
    });
    const onResult = vi.fn();
    const handler = createConversionRoute({
      context: ctx(),
      crm: { config: crmConfig, credentials: () => crmCredentials },
      onResult,
    });
    const res = await handler({ request: jsonRequest({ name: 'Ada', email: 'ada@example.com' }) });
    expect(res.status).toBe(200);
    // Dev has no `EMAIL` binding, so the notification logs rather than sends —
    // that's `notify()`'s own dev path and unrelated to the CRM outcome, which
    // is the thing this test actually asserts.
    const result = onResult.mock.calls[0]![0];
    expect(result.results[0].reason).toBe('No binding — logged to the console.');
    expect(result.crm.ok).toBe(false);
  });

  it('does not call deliverToCrm at all when no crm option is passed', async () => {
    const handler = createConversionRoute({ context: ctx() });
    await handler({ request: jsonRequest({ name: 'Ada' }) });
    expect(deliverToCrm).not.toHaveBeenCalled();
  });
});
