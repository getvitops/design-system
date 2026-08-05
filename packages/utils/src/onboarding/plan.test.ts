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
