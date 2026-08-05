/**
 * The Cloudflare executor's request shape and structured results.
 *
 * Thin by design, so what's worth asserting is the small judgment it carries: a
 * zone lookup that returns no match is a named failure, not an empty success; TXT
 * content comes back quoted and must be un-quoted before an exact compare; and
 * there is no code path that edits or deletes a record.
 */
import { describe, expect, it, vi } from 'vitest';
import { createApexTxt, findZoneId, listApexTxt } from './cloudflare.ts';

const res = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const stub = (fn: (url: string, init?: RequestInit) => Response) =>
  vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    fn(String(url), init),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const ok = <T>(result: T) => ({ success: true, result });

describe('findZoneId', () => {
  it('returns the first matching zone id', async () => {
    const r = await findZoneId(
      't',
      'acme.ca',
      stub((url) => {
        expect(url).toContain('/zones?name=acme.ca');
        return res(200, ok([{ id: 'zone123', name: 'acme.ca' }]));
      }),
    );
    expect(r).toMatchObject({ ok: true, zoneId: 'zone123' });
  });

  it('is a named failure when no zone matches', async () => {
    const r = await findZoneId('t', 'acme.ca', stub(() => res(200, ok([]))));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no Cloudflare zone named "acme\.ca"/);
  });

  it('surfaces the Cloudflare error code on an auth failure', async () => {
    const r = await findZoneId(
      't',
      'acme.ca',
      stub(() => res(403, { success: false, errors: [{ code: 9109, message: 'Unauthorized' }] })),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/9109 Unauthorized/);
  });
});

describe('listApexTxt', () => {
  it('un-quotes TXT contents so an exact compare works', async () => {
    const r = await listApexTxt(
      't',
      'zone123',
      'acme.ca',
      stub((url) => {
        expect(url).toContain('type=TXT');
        return res(200, ok([{ content: '"google-site-verification=abc"' }]));
      }),
    );
    expect(r.contents).toEqual(['google-site-verification=abc']);
  });
});

describe('createApexTxt', () => {
  it('POSTs a TXT record at the apex and reports success', async () => {
    const fetchImpl = stub((url, init) => {
      expect(url).toContain('/zones/zone123/dns_records');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ type: 'TXT', name: 'acme.ca', content: 'google-site-verification=abc' });
      return res(200, ok({ id: 'rec1' }));
    });
    const r = await createApexTxt('t', 'zone123', 'acme.ca', 'google-site-verification=abc', fetchImpl);
    expect(r.ok).toBe(true);
  });
});
