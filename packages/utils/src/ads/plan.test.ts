import { describe, expect, test } from 'vitest';
import { formatPlan, hasDrift, missingFields, plan, planProperty } from './plan.ts';
import { txtRecord } from './providers.ts';
import type { AdDomainState, AdPropertySetup } from './types.ts';

const meta = (patch: Partial<AdPropertySetup> = {}): AdPropertySetup => ({
  provider: 'meta',
  pixelId: '123',
  domain: 'acme.ca',
  domainVerification: 'tok123',
  ...patch,
});

const state = (contents: string[] = []): AdDomainState => ({ zoneId: 'z1', txtContents: contents });

describe('ads planner', () => {
  test('a linked property re-plans to all skips — idempotent by construction', () => {
    const setup = meta();
    const p = planProperty(setup, state([txtRecord('meta', 'tok123')]));
    expect(p.txt.action).toBe('skip');
    expect(p.tag.action).toBe('skip');
    expect(hasDrift({ properties: [p], notes: [] })).toBe(false);
  });

  test('a missing record is a create carrying the exact content', () => {
    const p = planProperty(meta(), state(['v=spf1 -all']));
    expect(p.txt.action).toBe('create');
    expect(p.txtContent).toBe('facebook-domain-verification=tok123');
  });

  test('a rotated token creates the new record and says the old one is still there', () => {
    // This command never deletes DNS, so the stale record survives the run. Saying
    // so is the difference between "we left it for you" and an unexplained pair of
    // records nobody remembers creating.
    const p = planProperty(meta(), state(['facebook-domain-verification=old']));
    expect(p.txt.action).toBe('create');
    expect(p.txt.detail).toMatch(/older token/);
  });

  test('a missing token is blocked and names the field — never a skip', () => {
    const p = planProperty(meta({ domainVerification: undefined }), state());
    expect(p.txt.action).toBe('blocked');
    expect(p.txt.needs).toBe('domainVerification');
    // The first run of an unlinked property must read as work outstanding.
    expect(hasDrift({ properties: [p], notes: [] })).toBe(true);
  });

  test('a platform with no domain verification skips WITH a reason', () => {
    const p = planProperty({ provider: 'linkedin', accountId: '55512' }, state());
    expect(p.txt.action).toBe('skip');
    expect(p.txt.detail).toMatch(/no domain verification/i);
  });

  test('the tag blocks on the field that platform actually needs', () => {
    // Google's tag id is the AW- conversion id, not the customer id — so an entry
    // carrying only accountId cannot emit a tag.
    const google = planProperty({ provider: 'google', accountId: '123-456-7890' }, state());
    expect(google.tag.action).toBe('blocked');
    expect(google.tag.needs).toBe('pixelId');

    // LinkedIn's Insight Tag id *is* the account id.
    const linkedin = planProperty({ provider: 'linkedin', accountId: '55512' }, state());
    expect(linkedin.tag.action).toBe('skip');
  });

  test('missingFields reports every gap, per provider', () => {
    const p = plan(
      {
        properties: [
          meta({ domainVerification: undefined, pixelId: undefined }),
          { provider: 'reddit' },
        ],
      },
      new Map([['acme.ca', state()]]),
    );
    expect(missingFields(p)).toEqual([
      { provider: 'meta', needs: 'domainVerification' },
      { provider: 'meta', needs: 'pixelId' },
      { provider: 'reddit', needs: 'pixelId' },
    ]);
  });

  test('an unobserved verifiable domain is a note, not a silent skip', () => {
    const p = plan({ properties: [meta()] }, new Map());
    expect(p.notes.join()).toMatch(/no observed DNS state/);
    expect(p.properties[0]?.txt.action).toBe('create');
  });

  test('formatPlan distinguishes skip, create and blocked', () => {
    const p = plan(
      { properties: [meta(), meta({ provider: 'reddit', domainVerification: undefined })] },
      new Map([['acme.ca', state()]]),
    );
    const out = formatPlan(p);
    expect(out).toMatch(/\+ verify/);
    expect(out).toMatch(/· verify/); // reddit: no verification exists there
  });
});

describe('txtRecord', () => {
  test('prefixes a bare token', () => {
    expect(txtRecord('tiktok', 'abc')).toBe('tiktok-developers-site-verification=abc');
  });

  test('passes a full record through untouched', () => {
    // The escape hatch: a platform that changes its prefix, or an operator who
    // pasted the whole record, must not end up double-prefixed.
    expect(txtRecord('meta', 'facebook-domain-verification=abc')).toBe(
      'facebook-domain-verification=abc',
    );
  });
});
