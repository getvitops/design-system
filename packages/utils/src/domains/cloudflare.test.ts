/**
 * The domains executor's request shape and structured results.
 *
 * Thin by design, so what's worth asserting is the judgment it carries: an absent zone
 * is an observation rather than a failure (the planner turns it into a blocked step with
 * instructions), the zone status has to survive the lookup or the nameserver gate has
 * nothing to gate on, a Page Rule has to be narrowed from a shape where the target and
 * the forwarding action live in different arrays, and `nosniff` must be passed through
 * rather than defaulted — it rides in the same setting as HSTS but is a different header.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createPageRule,
  forwardingRuleBody,
  getZoneSetting,
  hstsValue,
  listPageRules,
  lookupZone,
  readAlwaysUseHttps,
  readHsts,
  readNosniff,
  readPageRule,
  setZoneSetting,
  updatePageRule,
} from './cloudflare.ts';

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const stub = (fn: (url: string, init?: RequestInit) => Response) =>
  vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    fn(String(url), init),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

const ok = <T>(result: T) => ({ success: true, result });

// Every request this module sends serialises its body with `JSON.stringify`, so the
// string cast is a fact about the executor rather than an assumption about `BodyInit`.
const bodyOf = (init?: RequestInit) => JSON.parse(init?.body as string) as Record<string, unknown>;

describe('lookupZone', () => {
  it('keeps the status and nameservers, not just the id', async () => {
    // `findZoneId` returns only the id, which is why this command needs its own
    // lookup: without `status` there is nothing to gate the run on.
    const r = await lookupZone(
      't',
      'acme.ca',
      stub((url) => {
        expect(url).toContain('/zones?name=acme.ca');
        return res(
          200,
          ok([
            {
              id: 'z1',
              name: 'acme.ca',
              status: 'pending',
              name_servers: ['ana.ns.cloudflare.com'],
              meta: { page_rule_quota: 3 },
            },
          ]),
        );
      }),
    );
    expect(r).toMatchObject({
      ok: true,
      zoneId: 'z1',
      zoneStatus: 'pending',
      nameServers: ['ana.ns.cloudflare.com'],
      pageRuleQuota: 3,
    });
  });

  it('treats "no such zone" as a successful observation with no id', async () => {
    // Deliberately not a failure: the planner has a better message for it than a
    // transport error would be, and a first run on an un-added domain is normal.
    const r = await lookupZone(
      't',
      'acme.ca',
      stub(() => res(200, ok([]))),
    );
    expect(r.ok).toBe(true);
    expect(r.zoneId).toBeUndefined();
  });

  it('surfaces Cloudflare’s own error text', async () => {
    const r = await lookupZone(
      't',
      'acme.ca',
      stub(() => res(403, { success: false, errors: [{ code: 9109, message: 'Invalid access' }] })),
    );
    expect(r).toMatchObject({ ok: false, message: '9109 Invalid access' });
  });
});

describe('zone settings', () => {
  it('reads always_use_https as a boolean from Cloudflare’s on/off spelling', async () => {
    const r = await getZoneSetting(
      't',
      'z1',
      'always_use_https',
      stub((url) => {
        expect(url).toBe('https://api.cloudflare.com/client/v4/zones/z1/settings/always_use_https');
        return res(200, ok({ id: 'always_use_https', value: 'on' }));
      }),
    );
    expect(readAlwaysUseHttps(r.value)).toBe(true);
    expect(readAlwaysUseHttps('off')).toBe(false);
  });

  it('PATCHes a bare { value } body', async () => {
    const r = await setZoneSetting(
      't',
      'z1',
      'always_use_https',
      'on',
      stub((url, init) => {
        expect(init?.method).toBe('PATCH');
        expect(bodyOf(init)).toEqual({ value: 'on' });
        expect(url).toContain('/zones/z1/settings/always_use_https');
        return res(200, ok({}));
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('names the missing scope on a 403 rather than letting it read as a missing zone', async () => {
    const r = await setZoneSetting(
      't',
      'z1',
      'always_use_https',
      'on',
      stub(() =>
        res(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] }),
      ),
    );
    expect(r.message).toContain('Zone Settings:Edit');
  });
});

describe('HSTS value', () => {
  it('round-trips through the nested strict_transport_security shape', () => {
    const value = hstsValue({
      enabled: true,
      maxAge: 15552000,
      includeSubDomains: false,
      preload: false,
    });
    expect(value).toEqual({
      strict_transport_security: {
        enabled: true,
        max_age: 15552000,
        include_subdomains: false,
        preload: false,
        nosniff: false,
      },
    });
    expect(readHsts(value)).toEqual({
      enabled: true,
      maxAge: 15552000,
      includeSubDomains: false,
      preload: false,
    });
  });

  it('passes nosniff through instead of defaulting it off', () => {
    // It rides in the same setting but is X-Content-Type-Options — a different header
    // nobody asked us to touch. Defaulting it would silently turn it off.
    const current = { strict_transport_security: { nosniff: true } };
    expect(readNosniff(current)).toBe(true);
    const next = hstsValue(
      { enabled: true, maxAge: 100, includeSubDomains: false, preload: false },
      readNosniff(current),
    );
    expect(readNosniff(next)).toBe(true);
  });

  it('reads an absent block as undefined, not as a disabled policy', () => {
    expect(readHsts(undefined)).toBeUndefined();
    expect(readHsts({})).toBeUndefined();
  });
});

describe('Page Rules', () => {
  it('narrows the target and forwarding action out of their separate arrays', () => {
    const r = readPageRule({
      id: 'r1',
      status: 'active',
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'www.acme.ca/*' } }],
      actions: [{ id: 'forwarding_url', value: { url: 'https://acme.ca/$1', status_code: 301 } }],
    });
    expect(r).toEqual({
      id: 'r1',
      target: 'www.acme.ca/*',
      forwardTo: 'https://acme.ca/$1',
      status: 301,
      enabled: true,
    });
  });

  it('reports a non-forwarding rule with no forwardTo, so it never matches as ours', () => {
    const r = readPageRule({
      id: 'r2',
      targets: [{ target: 'url', constraint: { operator: 'matches', value: 'acme.ca/*' } }],
      actions: [{ id: 'cache_level', value: 'bypass' }],
    });
    expect(r.forwardTo).toBeUndefined();
  });

  it('marks a disabled rule, so the planner can refuse to call it done', () => {
    expect(readPageRule({ id: 'r3', status: 'disabled' }).enabled).toBe(false);
  });

  it('create and update send the same body, from one builder', () => {
    // Two call sites writing the rule body independently is how they drift; the
    // shared builder is asserted here so the equality is a fact, not a convention.
    let created: unknown;
    let updated: unknown;
    const capture = (into: (v: unknown) => void) =>
      stub((_url, init) => {
        into(bodyOf(init));
        return res(200, ok({ id: 'r1' }));
      });

    return Promise.all([
      createPageRule(
        't',
        'z1',
        'www.acme.ca/*',
        'https://acme.ca/$1',
        301,
        capture((v) => (created = v)),
      ),
      updatePageRule(
        't',
        'z1',
        'r1',
        'www.acme.ca/*',
        'https://acme.ca/$1',
        301,
        capture((v) => (updated = v)),
      ),
    ]).then(() => {
      expect(created).toEqual(forwardingRuleBody('www.acme.ca/*', 'https://acme.ca/$1', 301));
      expect(created).toEqual(updated);
    });
  });

  it('POSTs to the collection and PUTs to the rule id', async () => {
    await createPageRule(
      't',
      'z1',
      'www.acme.ca/*',
      'https://acme.ca/$1',
      301,
      stub((url, init) => {
        expect(init?.method).toBe('POST');
        expect(url).toBe('https://api.cloudflare.com/client/v4/zones/z1/pagerules');
        return res(200, ok({ id: 'r1' }));
      }),
    );
    await updatePageRule(
      't',
      'z1',
      'r1',
      'www.acme.ca/*',
      'https://acme.ca/$1',
      301,
      stub((url, init) => {
        expect(init?.method).toBe('PUT');
        expect(url).toBe('https://api.cloudflare.com/client/v4/zones/z1/pagerules/r1');
        return res(200, ok({ id: 'r1' }));
      }),
    );
  });

  it('lists every rule on the zone, foreign ones included, so the quota can be counted', async () => {
    const r = await listPageRules(
      't',
      'z1',
      stub(() =>
        res(
          200,
          ok([
            {
              id: 'a',
              targets: [{ target: 'url', constraint: { operator: 'matches', value: 'x.ca/*' } }],
            },
            {
              id: 'b',
              targets: [{ target: 'url', constraint: { operator: 'matches', value: 'y.ca/*' } }],
            },
          ]),
        ),
      ),
    );
    expect(r.rules.map((x) => x.target)).toEqual(['x.ca/*', 'y.ca/*']);
  });
});

describe('the module has no delete verb', () => {
  it('exports nothing that removes a rule or a setting', async () => {
    // The contract in the module header, asserted rather than trusted: a rule the
    // operator wrote in the dashboard is never removed, and the simplest way to keep
    // that true is for there to be no code that could.
    const mod = await import('./cloudflare.ts');
    expect(Object.keys(mod).filter((k) => /delete|remove|destroy/i.test(k))).toEqual([]);
  });
});
