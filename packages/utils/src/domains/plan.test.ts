/**
 * The planner's contract, asserted without a network.
 *
 * Everything consequential about `vitops domains setup` is a decision, not a request:
 * whether a zone Cloudflare isn't serving counts as configured, whether an HSTS policy
 * gets sent before HTTPS enforcement is confirmed, whether an alias with no DNS record
 * reads as done. Each of those is a pure function here, which is what lets them be
 * pinned cheaply — and each of them is a way for a run to look successful while the
 * site is still split across hosts.
 */
import { describe, expect, test } from 'vitest';
import {
  HSTS_DEFAULT_MAX_AGE,
  canonicalHost,
  counterpartHost,
  desiredRule,
  hasDrift,
  plan,
  planAlias,
  planHsts,
  planReachable,
  resolveAliases,
} from './plan.ts';
import type { DomainsSetup, ZoneState } from './types.ts';

const setup = (patch: Partial<DomainsSetup> = {}): DomainsSetup => ({
  canonical: 'https://acme.ca',
  environment: 'production',
  ...patch,
});

/** A zone Cloudflare is authoritative for, with nothing configured on it yet. */
const fresh = (patch: Partial<ZoneState> = {}): ZoneState => ({
  zoneId: 'z1',
  status: 'active',
  pageRules: [],
  ...patch,
});

/** The same zone, fully set up — every step should resolve to a skip against this. */
const done = (patch: Partial<ZoneState> = {}): ZoneState =>
  fresh({
    alwaysUseHttps: true,
    hsts: {
      enabled: true,
      maxAge: HSTS_DEFAULT_MAX_AGE,
      includeSubDomains: false,
      preload: false,
    },
    pageRules: [
      {
        id: 'r1',
        target: 'www.acme.ca/*',
        forwardTo: 'https://acme.ca/$1',
        status: 301,
        enabled: true,
      },
    ],
    aliasRecordTypes: ['AAAA'],
    aliasProxied: true,
    ...patch,
  });

describe('idempotency', () => {
  test('a configured domain re-plans to all skips — idempotent by construction', () => {
    const states = new Map([
      ['acme.ca', done()],
      ['www.acme.ca', done()],
    ]);
    const p = plan(setup(), states);
    expect(p.reachable.action).toBe('skip');
    expect(p.https.action).toBe('skip');
    expect(p.hsts.action).toBe('skip');
    expect(p.aliases.map((a) => [a.rule.action, a.dns.action])).toEqual([['skip', 'skip']]);
    expect(hasDrift(p)).toBe(false);
  });

  test('a first run is drift in every step', () => {
    const states = new Map([
      ['acme.ca', fresh()],
      ['www.acme.ca', fresh()],
    ]);
    const p = plan(setup(), states);
    expect(p.https.action).toBe('update');
    expect(p.hsts.action).toBe('create');
    expect(p.aliases[0]?.dns.action).toBe('create');
    expect(p.aliases[0]?.rule.action).toBe('create');
    expect(hasDrift(p)).toBe(true);
  });
});

describe('the nameserver gate', () => {
  test('a pending zone blocks everything and names the nameservers to set', () => {
    // The failure this exists for: a pending zone accepts every write and serves
    // none of them, so without the gate the run reports a clean success while the
    // registrar still points somewhere else.
    const state: ZoneState = {
      zoneId: 'z1',
      status: 'pending',
      nameServers: ['ana.ns.cloudflare.com', 'bob.ns.cloudflare.com'],
    };
    const p = plan(setup(), new Map([['acme.ca', state]]));
    expect(p.reachable.action).toBe('blocked');
    expect(p.reachable.detail).toContain('ana.ns.cloudflare.com');
    // The settings must not be planned as work on a zone that would ignore them.
    expect(p.https.action).toBe('blocked');
    expect(p.hsts.action).toBe('blocked');
    expect(hasDrift(p)).toBe(true);
  });

  test('a zone absent from the account is blocked, not failed', () => {
    const step = planReachable('acme.ca', { pageRules: [] });
    expect(step.action).toBe('blocked');
    expect(step.detail).toContain('registrar');
  });

  test('an unobserved zone says so instead of claiming it is missing', () => {
    // A `--dry` run with no credential never looked. Reporting "no zone in this
    // account" would assert a fact we didn't check and send the reader to the
    // dashboard to fix something that may already be right.
    const step = planReachable('acme.ca', undefined);
    expect(step.action).toBe('blocked');
    expect(step.detail).toContain('not checked');
    expect(step.detail).not.toContain('in this account');
    expect(step.needs).toEqual(['CLOUDFLARE_API_TOKEN']);
  });
});

describe('the implicit alias', () => {
  test('www is redirected with no aliases entry', () => {
    const aliases = resolveAliases(setup());
    expect(aliases.map((a) => a.domain)).toEqual(['www.acme.ca']);
    expect(aliases[0]?.implicit).toBe(true);
  });

  test('a www canonical makes the APEX the implicit alias', () => {
    // The rule read from the other end. Hard-coding "www redirects to apex" would
    // silently do nothing for a site that publishes at www.
    const aliases = resolveAliases(setup({ canonical: 'https://www.acme.ca' }));
    expect(aliases.map((a) => a.domain)).toEqual(['acme.ca']);
  });

  test('an explicit entry for the counterpart wins over the derived one', () => {
    const aliases = resolveAliases(
      setup({ aliases: [{ domain: 'www.acme.ca', redirectType: 308 }] }),
    );
    expect(aliases).toHaveLength(1);
    expect(aliases[0]?.redirectType).toBe(308);
    expect(aliases[0]?.implicit).toBe(false);
  });

  test('a non-apex canonical gets no counterpart invented for it', () => {
    // `www.blog.acme.ca` is a host nobody named; redirecting it would be a guess.
    expect(counterpartHost('blog.acme.ca')).toBeNull();
    expect(canonicalHost('https://blog.acme.ca/x')).toBe('blog.acme.ca');
  });

  test('an alias scoped to another environment is dropped and noted, not silently omitted', () => {
    const s = setup({
      aliases: [{ domain: 'old.acme.ca', environment: 'staging' }],
      environment: 'production',
    });
    expect(resolveAliases(s).map((a) => a.domain)).toEqual(['www.acme.ca']);
    const p = plan(s, new Map([['acme.ca', done()]]));
    expect(p.notes.join('\n')).toContain('old.acme.ca');
  });
});

describe('redirect targets', () => {
  test('the rule is scheme-less and carries the path, so one rule covers http and https', () => {
    const r = desiredRule({ domain: 'www.acme.ca' }, 'acme.ca');
    expect(r.target).toBe('www.acme.ca/*');
    expect(r.forwardTo).toBe('https://acme.ca/$1');
    expect(r.status).toBe(301);
  });

  test('redirectTo and redirectType override the defaults', () => {
    const r = desiredRule(
      { domain: 'acme.com', redirectTo: 'other.ca', redirectType: 302 },
      'acme.ca',
    );
    expect(r.forwardTo).toBe('https://other.ca/$1');
    expect(r.status).toBe(302);
  });

  test('a foreign Page Rule is never adopted — identity is the target pattern', () => {
    // The whole reason this command has no delete verb: a rule on another target is
    // another job, and updating it by position or index would silently break it.
    const state = fresh({
      pageRules: [
        { id: 'foreign', target: 'acme.ca/legacy/*', forwardTo: 'https://x.ca/$1', status: 301 },
      ],
      aliasRecordTypes: ['AAAA'],
      aliasProxied: true,
    });
    const a = planAlias({ domain: 'www.acme.ca' }, 'acme.ca', 'acme.ca', state);
    expect(a.rule.action).toBe('create');
    expect(a.ruleId).toBeUndefined();
  });

  test('our own rule pointing at the wrong host is an update, carrying its id', () => {
    const state = fresh({
      pageRules: [
        { id: 'r1', target: 'www.acme.ca/*', forwardTo: 'https://old.ca/$1', status: 301 },
      ],
      aliasRecordTypes: ['AAAA'],
      aliasProxied: true,
    });
    const a = planAlias({ domain: 'www.acme.ca' }, 'acme.ca', 'acme.ca', state);
    expect(a.rule.action).toBe('update');
    expect(a.ruleId).toBe('r1');
  });

  test('a disabled rule is not "already done"', () => {
    const state = fresh({
      pageRules: [
        {
          id: 'r1',
          target: 'www.acme.ca/*',
          forwardTo: 'https://acme.ca/$1',
          status: 301,
          enabled: false,
        },
      ],
      aliasRecordTypes: ['AAAA'],
      aliasProxied: true,
    });
    const a = planAlias({ domain: 'www.acme.ca' }, 'acme.ca', 'acme.ca', state);
    expect(a.rule.action).toBe('update');
  });

  test('a zone at its Page Rule quota is blocked with the numbers, not left to a 403', () => {
    const state = fresh({
      pageRuleQuota: 1,
      pageRules: [{ id: 'x', target: 'other.ca/*' }],
      aliasRecordTypes: ['AAAA'],
      aliasProxied: true,
    });
    const a = planAlias({ domain: 'www.acme.ca' }, 'acme.ca', 'acme.ca', state);
    expect(a.rule.action).toBe('blocked');
    expect(a.rule.detail).toContain('1/1');
  });
});

describe('the DNS precondition', () => {
  test('an alias host with no records plans the proxied placeholder', () => {
    const a = planAlias(
      { domain: 'www.acme.ca' },
      'acme.ca',
      'acme.ca',
      fresh({ aliasRecordTypes: [] }),
    );
    expect(a.dns.action).toBe('create');
    expect(a.dns.detail).toContain('100::');
  });

  test('unproxied records are blocked, never edited', () => {
    // The alias may be a live site being retired. Rewriting its A record is not what
    // this command promises, and the contract is easier to keep than to remember.
    const a = planAlias(
      { domain: 'acme.com' },
      'acme.ca',
      'acme.com',
      fresh({ aliasRecordTypes: ['A'], aliasProxied: false }),
    );
    expect(a.dns.action).toBe('blocked');
    expect(a.dns.detail).toContain('not proxied');
  });
});

describe('HSTS guards', () => {
  test('preload without a year and includeSubDomains is blocked, naming both fields', () => {
    const s = setup({ hsts: { preload: true } });
    const step = planHsts(s, fresh());
    expect(step.action).toBe('blocked');
    expect(step.needs).toEqual(['hsts.maxAge', 'hsts.includeSubDomains']);
    // Blocked is drift — a config asking for something it cannot have must not read
    // as configured.
    expect(hasDrift(plan(s, new Map([['acme.ca', done()]])))).toBe(true);
  });

  test('preload with both requirements met is planned', () => {
    const step = planHsts(
      setup({ hsts: { preload: true, maxAge: 31536000, includeSubDomains: true } }),
      fresh(),
    );
    expect(step.action).toBe('create');
  });

  test('includeSubDomains is refused while a configured environment is on plaintext http', () => {
    // The one subdomain hazard the config can actually see coming.
    const step = planHsts(
      setup({
        hsts: { includeSubDomains: true },
        environmentOrigins: ['https://acme.ca', 'http://dev.acme.ca'],
      }),
      fresh(),
    );
    expect(step.action).toBe('blocked');
    expect(step.detail).toContain('http://dev.acme.ca');
  });

  test('an unrelated plaintext environment does not block it', () => {
    const step = planHsts(
      setup({
        hsts: { includeSubDomains: true },
        environmentOrigins: ['http://localhost:4321', 'http://staging.other.test'],
      }),
      fresh(),
    );
    expect(step.action).toBe('create');
  });

  test('includeSubDomains always carries a reminder about hosts the config cannot see', () => {
    const p = plan(setup({ hsts: { includeSubDomains: true } }), new Map([['acme.ca', done()]]));
    expect(p.reminders.join('\n')).toContain('never names');
  });

  test('the default is six months with no subdomain or preload commitment', () => {
    const step = planHsts(setup(), fresh());
    expect(step.detail).toContain(String(HSTS_DEFAULT_MAX_AGE));
    expect(step.detail).not.toContain('includeSubDomains');
    expect(step.detail).not.toContain('preload');
  });

  test('a max-age change against a set zone is an update, not a skip', () => {
    const step = planHsts(setup({ hsts: { maxAge: 31536000 } }), done());
    expect(step.action).toBe('update');
  });
});
