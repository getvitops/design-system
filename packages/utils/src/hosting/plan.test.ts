import { describe, expect, test } from 'vite-plus/test';
import { hasDrift, plan, planDomainConsistency } from './plan.ts';
import type { DomainState, HostingSetup, HostingState } from './types.ts';

const setup = (patch: Partial<HostingSetup> = {}): HostingSetup => ({
  platform: 'cloudflare',
  projectName: 'acme-site',
  repoVisibility: 'private',
  devResources: true,
  ...patch,
});

const freshState: HostingState = {
  wranglerAuthed: false,
  d1Present: false,
  r2Present: false,
  ghAuthed: false,
  branches: [],
  mainProtected: false,
  environments: [],
  secretsPresent: [],
};

const doneState: HostingState = {
  wranglerAuthed: true,
  accountId: 'a'.repeat(32),
  d1Present: true,
  d1Id: 'd1-id',
  r2Present: true,
  ghAuthed: true,
  originRemote: 'git@github.com:acme/acme-site.git',
  repoNwo: 'acme/acme-site',
  branches: ['main', 'dev'],
  defaultBranch: 'dev',
  mainProtected: true,
  environments: ['production', 'dev'],
  secretsPresent: ['DEV_D1_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
};

describe('hosting planner', () => {
  test('a fresh project plans every step, and has drift', () => {
    const p = plan(setup(), freshState);
    expect(p.repo.action).toBe('create');
    expect(p.branches.action).toBe('create');
    expect(p.defaultBranch.action).toBe('update');
    expect(p.d1.action).toBe('create');
    expect(p.r2.action).toBe('create');
    expect(hasDrift(p)).toBe(true);
  });

  test('a fully provisioned project is all skips — idempotent by construction', () => {
    const p = plan(setup(), doneState);
    expect(p.repo.action).toBe('skip');
    expect(p.branches.action).toBe('skip');
    expect(p.defaultBranch.action).toBe('skip');
    expect(p.d1.action).toBe('skip');
    expect(p.r2.action).toBe('skip');
    for (const s of Object.values(p.secrets)) expect(s.action).toBe('skip');
    expect(hasDrift(p)).toBe(false);
  });

  test('main protection and the production environment are blocked, never failed, absent a repo API grant', () => {
    const p = plan(setup(), {
      ...freshState,
      ghAuthed: true,
      originRemote: 'x',
      repoNwo: 'acme/acme-site',
    });
    expect(p.mainProtection.action).toBe('blocked');
    expect(p.mainProtection.detail).toMatch(/Pro\/Team/);
    expect(p.prodEnvironment.action).toBe('blocked');
  });

  test('the dev environment is created with no reviewers, not blocked — it stays open on purpose', () => {
    const p = plan(setup(), freshState);
    expect(p.devEnvironment.action).toBe('create');
    expect(p.devEnvironment.detail).toMatch(/no required reviewers/);
  });

  test('the Cloudflare API token is always blocked — no API can create one', () => {
    const state: HostingState = {
      ...doneState,
      secretsPresent: ['DEV_D1_ID', 'CLOUDFLARE_ACCOUNT_ID'],
    };
    const p = plan(setup(), state);
    expect(p.secrets['CLOUDFLARE_API_TOKEN']?.action).toBe('blocked');
    expect(p.secrets['CLOUDFLARE_API_TOKEN']?.detail).toMatch(/dash\.cloudflare\.com/);
  });

  test('secrets are blocked until the repo exists — never silently skipped as if already set', () => {
    const p = plan(setup(), freshState);
    for (const s of Object.values(p.secrets)) expect(s.action).toBe('blocked');
  });

  test('a node platform skips D1/R2 with a reason, and is never itself destructive', () => {
    const p = plan(setup({ platform: 'node', devResources: false }), freshState);
    expect(p.d1.action).toBe('skip');
    expect(p.r2.action).toBe('skip');
  });

  test('no step is ever "update" or "create" against an already-true desired state (never destructive, never redundant)', () => {
    const p = plan(setup(), doneState);
    const actions = [
      p.repo,
      p.branches,
      p.defaultBranch,
      p.d1,
      p.r2,
      ...Object.values(p.secrets),
    ].map((s) => s.action);
    expect(actions.every((a) => a === 'skip')).toBe(true);
  });
});

describe('domain consistency', () => {
  test('workers.dev phase with no noindex is blocked — a workers.dev URL is indexable', () => {
    const state: DomainState = { wranglerDev: true };
    const step = planDomainConsistency(state);
    expect(step.action).toBe('blocked');
    expect(step.detail).toMatch(/indexable/);
  });

  test('workers.dev phase, correctly noindexed, skips', () => {
    const state: DomainState = { wranglerDev: true, robots: 'noindex,nofollow' };
    expect(planDomainConsistency(state).action).toBe('skip');
  });

  test('a custom domain whose canonical does not match is blocked', () => {
    const state: DomainState = {
      wranglerDev: false,
      customDomain: 'acme.example',
      canonical: 'https://old-domain.example',
    };
    const step = planDomainConsistency(state);
    expect(step.action).toBe('blocked');
    expect(step.detail).toMatch(/canonical/);
  });

  test('a custom domain still marked noindex after cutover is blocked', () => {
    const state: DomainState = {
      wranglerDev: false,
      customDomain: 'acme.example',
      canonical: 'https://acme.example',
      robots: 'noindex,nofollow',
    };
    const step = planDomainConsistency(state);
    expect(step.action).toBe('blocked');
    expect(step.detail).toMatch(/noindex/);
  });

  test('a consistent cutover skips', () => {
    const state: DomainState = {
      wranglerDev: false,
      customDomain: 'acme.example',
      canonical: 'https://acme.example',
      robots: 'index,follow',
    };
    expect(planDomainConsistency(state).action).toBe('skip');
  });
});
