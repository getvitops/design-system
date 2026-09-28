import { describe, expect, test } from 'vite-plus/test';
import { dnsStatus, hasDrift, planDomain, planSendingDomains } from './plan.ts';
import type { ZoneSendingState } from './types.ts';

const zone = (subdomains: ZoneSendingState['subdomains'] = []): ZoneSendingState => ({
  zoneId: 'z1',
  subdomains,
});

describe('email planner', () => {
  test('an onboarded, enabled name is a skip — idempotent by construction', () => {
    const s = planDomain(
      'send.acme.ca',
      'cloudflare',
      zone([{ name: 'send.acme.ca', enabled: true, tag: 't' }]),
    );
    expect(s.action).toBe('skip');
  });

  test('onboarded but disabled is a create, not a skip', () => {
    const s = planDomain(
      'send.acme.ca',
      'cloudflare',
      zone([{ name: 'send.acme.ca', enabled: false, tag: 't' }]),
    );
    expect(s.action).toBe('create');
    expect(s.detail).toMatch(/disabled/);
  });

  test('the exact domain is absent but a sibling in the same zone is onboarded — blocked, naming the sibling', () => {
    // The real-world case: `from` is @acme.ca, but only send.acme.ca is onboarded.
    const s = planDomain(
      'acme.ca',
      'cloudflare',
      zone([{ name: 'send.acme.ca', enabled: true, tag: 't' }]),
    );
    expect(s.action).toBe('blocked');
    expect(s.detail).toMatch(/send\.acme\.ca/);
    expect(s.detail).toMatch(/@send\.acme\.ca/);
  });

  test('nothing onboarded in the zone at all is a plain create', () => {
    const s = planDomain('send.acme.ca', 'cloudflare', zone([]));
    expect(s.action).toBe('create');
    expect(s.detail).toMatch(/wrangler email sending enable send\.acme\.ca/);
  });

  test('no observed state at all is blocked, never a silent skip', () => {
    const s = planDomain('send.acme.ca', 'cloudflare', undefined);
    expect(s.action).toBe('blocked');
  });

  test('a provider with no onboarding check skips WITH a reason', () => {
    const s = planDomain('send.acme.ca', 'ses', zone([]));
    expect(s.action).toBe('skip');
    expect(s.detail).toMatch(/ses/);
  });

  test('hasDrift is true whenever any domain is not a plain skip', () => {
    const plan = planSendingDomains(
      {
        candidates: [{ address: 'noreply@acme.ca', domain: 'acme.ca', source: 'config' }],
        provider: 'cloudflare',
      },
      new Map([['acme.ca', zone([{ name: 'send.acme.ca', enabled: true, tag: 't' }])]]),
    );
    expect(hasDrift(plan)).toBe(true);
    expect(plan.domains[0]?.onboard.action).toBe('blocked');
  });

  test('multiple candidate sources for the same domain are merged into one entry', () => {
    const plan = planSendingDomains(
      {
        candidates: [
          { address: 'noreply@acme.ca', domain: 'acme.ca', source: 'config' },
          { address: 'contact@acme.ca', domain: 'acme.ca', source: 'scan' },
        ],
        provider: 'cloudflare',
      },
      new Map(),
    );
    expect(plan.domains).toHaveLength(1);
    expect(plan.domains[0]?.sources.sort()).toEqual(['config', 'scan']);
  });

  test('dnsStatus reports each expected record against what actually resolved', () => {
    const expected = [
      {
        type: 'TXT' as const,
        name: 'cf-bounce.send.acme.ca',
        content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
      },
      { type: 'TXT' as const, name: '_dmarc.send.acme.ca', content: 'v=DMARC1; p=reject;' },
    ];
    const resolved = new Map([
      ['cf-bounce.send.acme.ca', ['v=spf1 include:_spf.mx.cloudflare.net ~all']],
      // DMARC not yet propagated.
    ]);
    const status = dnsStatus(expected, resolved);
    expect(status[0]?.present).toBe(true);
    expect(status[1]?.present).toBe(false);
  });
});
