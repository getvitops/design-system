/**
 * The planner's decisions — idempotency, drift, and the retry policy.
 *
 * This is the file that has to be right for `--check` to be honest and a re-run to
 * be a no-op: a step whose desired state already holds must resolve to `skip`, and
 * anything left to do must count as drift.
 */
import { describe, expect, it } from 'vitest';
import {
  backoffSchedule,
  formatSummary,
  hasDrift,
  ownerUnion,
  plan,
  planDomain,
  siteUrlFor,
} from './plan.ts';
import type { DomainState } from './types.ts';

const fresh: DomainState = {
  txtPresent: false,
  verified: false,
  currentOwners: [],
  propertyExists: false,
};
const done: DomainState = {
  txtPresent: true,
  verified: true,
  currentOwners: ['a@acme.ca'],
  propertyExists: true,
};

describe('siteUrlFor', () => {
  it('is the sc-domain property identifier', () => {
    expect(siteUrlFor('acme.ca')).toBe('sc-domain:acme.ca');
  });
});

describe('planDomain', () => {
  it('plans all four steps for a fresh domain', () => {
    const p = planDomain({ domain: 'acme.ca' }, fresh);
    expect(p.txt.action).toBe('create');
    expect(p.verify.action).toBe('create');
    expect(p.property.action).toBe('create');
  });

  it('is a complete no-op when the domain is fully onboarded', () => {
    const p = planDomain({ domain: 'acme.ca', delegatedOwners: ['a@acme.ca'] }, done);
    expect(p.txt.action).toBe('skip');
    expect(p.verify.action).toBe('skip');
    expect(p.property.action).toBe('skip');
    expect(p.owners.action).toBe('skip');
    expect(p.ownersToAdd).toEqual([]);
  });

  it('adds only the missing owners, case-insensitively', () => {
    const p = planDomain(
      { domain: 'acme.ca', delegatedOwners: ['A@acme.ca', 'b@acme.ca'] },
      { ...done, currentOwners: ['a@acme.ca'] },
    );
    expect(p.owners.action).toBe('update');
    expect(p.ownersToAdd).toEqual(['b@acme.ca']);
  });

  it('treats every delegated owner as pending before verification', () => {
    const p = planDomain({ domain: 'acme.ca', delegatedOwners: ['a@acme.ca'] }, fresh);
    // currentOwners is empty until verified, so the owner is still to add.
    expect(p.ownersToAdd).toEqual(['a@acme.ca']);
  });

  it('surfaces a Full-User group as a reminder, not an action', () => {
    const p = planDomain({ domain: 'acme.ca', fullUserGroup: 'team@acme.ca' }, done);
    expect(p.reminders.join(' ')).toMatch(/team@acme\.ca.*Full User/);
    // The reminder must not register as drift.
    expect(hasDrift({ domains: [p], notes: [] })).toBe(false);
  });
});

/**
 * `updateOwners` REPLACES the owner set, so this union is the only thing standing
 * between delegating access and revoking your own.
 *
 * The first case is the one that shipped broken: on a first run the domain is not
 * yet a web resource, so the pre-verification observation reports no owners at all
 * and `planDomain` treats every delegated owner as still-to-add. Verification then
 * creates the resource with the verifying account as its owner — and the caller
 * has to fold that in, or the PUT removes the account that just proved ownership.
 */
describe('ownerUnion', () => {
  it('keeps the verifying account when adding the first delegated owner', () => {
    expect(ownerUnion(['verifier@acme.ca'], ['ops@acme.ca'])).toEqual([
      'verifier@acme.ca',
      'ops@acme.ca',
    ]);
  });

  it('is a no-op when every delegated owner is already there', () => {
    expect(ownerUnion(['a@acme.ca', 'b@acme.ca'], ['b@acme.ca'])).toEqual([
      'a@acme.ca',
      'b@acme.ca',
    ]);
  });

  it('matches case-insensitively, keeping the API’s casing', () => {
    // Google echoes an address in whatever case the account uses; a case-sensitive
    // dedupe would send the same owner twice under two spellings.
    expect(ownerUnion(['Ops@Acme.ca'], ['ops@acme.ca'])).toEqual(['Ops@Acme.ca']);
  });

  it('never returns fewer owners than it was given', () => {
    // The property that actually matters: this function cannot drop anyone.
    const current = ['a@acme.ca', 'B@acme.ca'];
    for (const toAdd of [[], ['c@acme.ca'], ['A@acme.ca'], ['a@acme.ca', 'c@acme.ca']]) {
      const out = ownerUnion(current, toAdd);
      for (const o of current) expect(out.map((x) => x.toLowerCase())).toContain(o.toLowerCase());
    }
  });
});

describe('hasDrift', () => {
  it('is false when every domain is fully onboarded', () => {
    const p = plan(
      { domains: [{ domain: 'acme.ca', delegatedOwners: ['a@acme.ca'] }] },
      new Map([['acme.ca', done]]),
    );
    expect(hasDrift(p)).toBe(false);
  });

  it('is true when any step is pending', () => {
    const p = plan({ domains: [{ domain: 'acme.ca' }] }, new Map([['acme.ca', fresh]]));
    expect(hasDrift(p)).toBe(true);
  });

  it('treats a missing observation as drift, with a note', () => {
    const p = plan({ domains: [{ domain: 'acme.ca' }] }, new Map());
    expect(hasDrift(p)).toBe(true);
    expect(p.notes.join(' ')).toMatch(/acme\.ca/);
  });
});

describe('backoffSchedule', () => {
  it('is an exponential ladder capped at maxAttempts', () => {
    expect(backoffSchedule(5)).toEqual([2000, 4000, 8000, 16000, 32000]);
    expect(backoffSchedule(3)).toEqual([2000, 4000, 8000]);
  });
});

describe('formatSummary', () => {
  it('renders a row per domain and a reminders block', () => {
    const out = formatSummary([
      { domain: 'acme.ca', txt: 'created', verified: 'yes', property: 'added', reminders: [] },
      {
        domain: 'acme.com',
        txt: 'present',
        verified: 'pending',
        property: '—',
        reminders: ['add team@acme.ca as a Full User'],
      },
    ]);
    expect(out).toMatch(/DOMAIN/);
    expect(out).toMatch(/acme\.ca/);
    expect(out).toMatch(/pending/);
    expect(out).toMatch(/Reminders/);
    expect(out).toMatch(/team@acme\.ca/);
  });
});
