/**
 * Every decision `vitops setup` makes, as one pure function.
 *
 * Same split as `onboarding/plan.ts` and `ads/plan.ts`: this module decides, from
 * observed live state, what's left to do; `wrangler.ts`/`github.ts` execute a plan
 * and decide nothing. That is what makes `--dry` a complete account of a run and
 * `--check` an honest drift report with no network beyond the observation step.
 *
 * Idempotency lives here: a step whose desired state already holds resolves to
 * `skip`, so a re-run of a fully-provisioned project is all skips by construction.
 *
 * `blocked` (ads' addition to onboarding's three-state `StepAction`) covers the one
 * thing this command genuinely cannot do: mint a Cloudflare API token. That is
 * config nothing here can supply — surfaced as blocked, carrying the manual path,
 * never as a failure.
 *
 * Never destructive: no step here deletes a database, a bucket, a branch, a
 * protection rule, or a DNS record — matching `onboarding/cloudflare.ts`'s DNS
 * verbs, which have no update or delete either.
 */
import { table } from '../plan-format.ts';
import type { DomainState, HostingSetup, HostingState } from './types.ts';

export type StepAction = 'create' | 'update' | 'skip' | 'blocked';

export interface StepPlan {
  action: StepAction;
  detail: string;
}

export interface HostingPlan {
  repo: StepPlan;
  branches: StepPlan;
  defaultBranch: StepPlan;
  mainProtection: StepPlan;
  prodEnvironment: StepPlan;
  devEnvironment: StepPlan;
  d1: StepPlan;
  r2: StepPlan;
  /** One step per repo secret this command sets. */
  secrets: Record<string, StepPlan>;
  notes: string[];
}

const SECRETS_FOR = (setup: HostingSetup): string[] =>
  setup.platform === 'cloudflare'
    ? ['DEV_D1_ID', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']
    : [];

/** Plan the whole hosting sequence from setup + observed state. */
export function plan(setup: HostingSetup, state: HostingState): HostingPlan {
  const notes: string[] = [];

  const repo: StepPlan =
    state.originRemote && state.repoNwo
      ? { action: 'skip', detail: `repo already exists (${state.repoNwo})` }
      : {
          action: 'create',
          detail: `create GitHub repo "${setup.projectName}" (${setup.repoVisibility})`,
        };

  const branches: StepPlan =
    state.branches.includes('main') && state.branches.includes('dev')
      ? { action: 'skip', detail: 'main + dev already exist' }
      : { action: 'create', detail: 'push main + dev' };

  const defaultBranch: StepPlan =
    state.defaultBranch === 'dev'
      ? { action: 'skip', detail: 'dev is already the default branch' }
      : { action: 'update', detail: 'make dev the default branch' };

  const mainProtection: StepPlan = state.mainProtected
    ? { action: 'skip', detail: 'main is already protected' }
    : {
        action: 'blocked',
        detail:
          'requires GitHub Pro/Team on a private repo — set it manually in Settings → Branches ' +
          '(PR + review + the "ci" check required) if this stays blocked',
      };

  const prodEnvironment: StepPlan = state.environments.includes('production')
    ? { action: 'skip', detail: 'production environment already exists' }
    : {
        action: 'blocked',
        detail:
          'requires GitHub Pro/Team on a private repo — create a "production" environment ' +
          'gated on your admin collaborators manually if this stays blocked',
      };

  const devEnvironment: StepPlan = state.environments.includes('dev')
    ? { action: 'skip', detail: 'dev environment already exists' }
    : {
        action: 'create',
        detail: 'create "dev" environment with no required reviewers (stays open)',
      };

  const d1: StepPlan =
    setup.platform !== 'cloudflare' || !setup.devResources
      ? { action: 'skip', detail: 'not a cloudflare project, or dev resources not requested' }
      : state.d1Present
        ? { action: 'skip', detail: `dev D1 already exists (${state.d1Id ?? 'id unknown'})` }
        : { action: 'create', detail: `create D1 database "${setup.projectName}-dev"` };

  const r2: StepPlan =
    setup.platform !== 'cloudflare' || !setup.devResources
      ? { action: 'skip', detail: 'not a cloudflare project, or dev resources not requested' }
      : state.r2Present
        ? { action: 'skip', detail: `dev R2 bucket already exists` }
        : { action: 'create', detail: `create R2 bucket "${setup.projectName}-media-dev"` };

  const secrets: Record<string, StepPlan> = {};
  for (const name of SECRETS_FOR(setup)) {
    if (!state.ghAuthed || !state.originRemote) {
      secrets[name] = {
        action: 'blocked',
        detail: 'no GitHub repo wired up yet — run the repo step first',
      };
      continue;
    }
    if (state.secretsPresent.includes(name)) {
      secrets[name] = { action: 'skip', detail: 'already set' };
      continue;
    }
    if (name === 'CLOUDFLARE_API_TOKEN') {
      secrets[name] = {
        action: 'blocked',
        detail:
          'tokens cannot be created via any API — create one at ' +
          'https://dash.cloudflare.com/profile/api-tokens (Workers + D1 + R2 edit), then ' +
          '`gh secret set CLOUDFLARE_API_TOKEN`',
      };
      continue;
    }
    const value =
      name === 'DEV_D1_ID'
        ? state.d1Id
        : name === 'CLOUDFLARE_ACCOUNT_ID'
          ? state.accountId
          : undefined;
    secrets[name] = value
      ? { action: 'create', detail: `set from provisioned/observed value` }
      : { action: 'blocked', detail: 'value not yet known — provision the resource first' };
  }

  if (!state.wranglerAuthed && setup.platform === 'cloudflare' && setup.devResources)
    notes.push('wrangler is not logged in — run `npx wrangler login` first');
  if (!state.ghAuthed) notes.push('gh is not logged in — run `gh auth login` first');

  return {
    repo,
    branches,
    defaultBranch,
    mainProtection,
    prodEnvironment,
    devEnvironment,
    d1,
    r2,
    secrets,
    notes,
  };
}

const allSteps = (p: HostingPlan): StepPlan[] => [
  p.repo,
  p.branches,
  p.defaultBranch,
  p.mainProtection,
  p.prodEnvironment,
  p.devEnvironment,
  p.d1,
  p.r2,
  ...Object.values(p.secrets),
];

/** Any step that isn't a skip — i.e. the live state has drifted from desired. */
export function hasDrift(p: HostingPlan): boolean {
  return allSteps(p).some((s) => s.action !== 'skip');
}

/** Every blocked step, with a name — what `--check` reports and the CLI surfaces. */
export function blockedSteps(p: HostingPlan): { name: string; detail: string }[] {
  const named: [string, StepPlan][] = [
    ['repo', p.repo],
    ['branches', p.branches],
    ['defaultBranch', p.defaultBranch],
    ['mainProtection', p.mainProtection],
    ['prodEnvironment', p.prodEnvironment],
    ['devEnvironment', p.devEnvironment],
    ['d1', p.d1],
    ['r2', p.r2],
    ...Object.entries(p.secrets).map(([name, s]) => [`secret:${name}`, s] as [string, StepPlan]),
  ];
  return named
    .filter(([, s]) => s.action === 'blocked')
    .map(([name, s]) => ({ name, detail: s.detail }));
}

/** Render a plan as the block `--dry` and `--check` print. */
export function formatPlan(p: HostingPlan): string {
  const glyph = (s: StepPlan) =>
    s.action === 'skip' ? '·' : s.action === 'blocked' ? '?' : s.action === 'update' ? '~' : '+';
  const lines: string[] = [];
  lines.push(`${glyph(p.repo)} repo             ${p.repo.detail}`);
  lines.push(`${glyph(p.branches)} branches         ${p.branches.detail}`);
  lines.push(`${glyph(p.defaultBranch)} default branch   ${p.defaultBranch.detail}`);
  lines.push(`${glyph(p.mainProtection)} main protection  ${p.mainProtection.detail}`);
  lines.push(`${glyph(p.prodEnvironment)} production env   ${p.prodEnvironment.detail}`);
  lines.push(`${glyph(p.devEnvironment)} dev env          ${p.devEnvironment.detail}`);
  lines.push(`${glyph(p.d1)} dev D1           ${p.d1.detail}`);
  lines.push(`${glyph(p.r2)} dev R2           ${p.r2.detail}`);
  for (const [name, s] of Object.entries(p.secrets))
    lines.push(`${glyph(s)} secret ${name}${' '.repeat(Math.max(1, 11 - name.length))}${s.detail}`);
  for (const n of p.notes) lines.push(`! ${n}`);
  return lines.join('\n');
}

/** The outcome of one run, for the summary table. */
export interface HostingResult {
  step: string;
  status: 'created' | 'updated' | 'present' | 'blocked' | 'failed';
  detail: string;
}

/** Render the end-of-run summary: one row per step, plus blocked reminders. */
export function formatSummary(results: HostingResult[]): string {
  const headers = ['STEP', 'STATUS', 'DETAIL'];
  const rows = results.map((r) => [r.step, r.status, r.detail]);
  const reminders = results
    .filter((r) => r.status === 'blocked')
    .map((r) => `  ! ${r.step}: ${r.detail}`);
  return table(headers, rows, reminders);
}

/**
 * Plan the domain-consistency check on its own — it has no executor, only an
 * observation (`wrangler.jsonc` + the config), and it is never applied by this
 * command. See `SETUP.html`'s "Domain strategy" stage: the actual cutover is a
 * human, deliberate action.
 */
export function planDomainConsistency(state: DomainState): StepPlan {
  const cutover = Boolean(state.customDomain);
  if (cutover) {
    if (!state.canonical || state.canonical !== `https://${state.customDomain}`)
      return {
        action: 'blocked',
        detail: `wrangler.jsonc names a custom domain (${state.customDomain}) but site.domains.canonical doesn't match — a visitor sees the new site while <link rel=canonical> still points at the old one`,
      };
    if (state.robots?.includes('noindex'))
      return {
        action: 'blocked',
        detail:
          'custom domain is live but robots is still "noindex,nofollow" — flip it back after cutover',
      };
    return { action: 'skip', detail: 'custom domain configured and consistent' };
  }
  if (!state.robots?.includes('noindex'))
    return {
      action: 'blocked',
      detail:
        'still on *.workers.dev but robots does not say "noindex,nofollow" — a workers.dev URL is indexable, and this is what stops search engines treating it as a duplicate of the real site',
    };
  return { action: 'skip', detail: 'workers.dev phase, correctly noindexed' };
}
