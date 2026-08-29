/**
 * `vitops setup` — the scripted path from an empty scaffold to a live site.
 * Subcommands: `repo | hosting | domain | search | ads | all`.
 *
 * Absorbs what each template's `scripts/init-{github,hosting}.mjs` used to do
 * template-locally, so the capability reaches every consumer, not just a fresh
 * `vp create` scaffold. `repo`/`hosting` follow the pure-planner/executor split in
 * `@getvitops/utils/hosting` — see that module's docblock. `search`/`ads` are not
 * reimplemented: this shells out to the CLI's own `search setup`/`ads setup`
 * subcommands as child processes, so their behaviour (prompting, `--dry`,
 * `--check`, writing the config patch back) stays exactly what it already is,
 * with no risk of the two copies drifting.
 *
 * `domain` only ever plans and checks the workers.dev-vs-custom-domain
 * consistency — it never touches `wrangler.jsonc` or deploys anything. Cutover
 * overwrites the zone's DNS record and can take an existing live site down; that
 * is a human's call, made in `SETUP.html`, not a step this command applies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  adminCollaboratorIds,
  branches as ghBranches,
  createD1,
  createDevEnvironment,
  createProdEnvironment,
  createR2Bucket,
  createRepo,
  defaultBranch as ghDefaultBranch,
  environments as ghEnvironments,
  findD1,
  findR2Bucket,
  formatPlan,
  formatSummary,
  ghAuthed,
  mainProtected as ghMainProtected,
  originRemote,
  plan as planHosting,
  planDomainConsistency,
  protectMain,
  pushBranches,
  repoNwo as ghRepoNwo,
  secretsPresent,
  setDefaultBranch,
  setSecret,
  wranglerWhoami,
  type DomainState,
  type HostingResult,
  type HostingSetup,
  type HostingState,
} from '@getvitops/utils/hosting';
import { parse, msg } from '../args.ts';
import { fail, loadConfig, SITE_OPTS } from './shared.ts';

const SETUP_HELP = `vitops setup <sub> [options]

  vitops setup repo    [--dry] [--check] [--public]
  vitops setup hosting [--dry] [--check] [--platform cloudflare|node]
  vitops setup domain  [--dry] [--check] [--domain <apex>]
  vitops setup search  [options]   (forwards to \`vitops search setup\`)
  vitops setup ads     [options]   (forwards to \`vitops ads setup\`)
  vitops setup all     [--dry] [--check] [--public] [--platform <p>]

--dry prints the plan and stops. --check reports drift/blocked steps and exits
non-zero, mutating nothing. Neither creates the Cloudflare API token or performs
a custom-domain cutover — both are named as manual steps; see SETUP.html.`;

function projectName(): string {
  const path = resolve('package.json');
  if (!existsSync(path)) fail('package.json not found — run this from the project root');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { name?: string };
  if (!pkg.name) fail('package.json has no "name" field');
  return pkg.name!.replace(/^@[^/]+\//, '');
}

async function gatherHostingState(
  name: string,
  platform: 'cloudflare' | 'node',
): Promise<HostingState> {
  const [wrangler, gh, origin] = await Promise.all([
    platform === 'cloudflare' ? wranglerWhoami() : Promise.resolve({ authed: false } as const),
    ghAuthed(),
    originRemote(),
  ]);
  const nwo = origin ? await ghRepoNwo() : undefined;
  const [branchesList, def, protectedMain, envs, secrets, d1Id, r2] = await Promise.all([
    ghBranches(),
    nwo ? ghDefaultBranch(nwo) : Promise.resolve(undefined),
    nwo ? ghMainProtected(nwo) : Promise.resolve(false),
    nwo ? ghEnvironments(nwo) : Promise.resolve([]),
    nwo ? secretsPresent(nwo) : Promise.resolve([]),
    platform === 'cloudflare' ? findD1(`${name}-dev`) : Promise.resolve(undefined),
    platform === 'cloudflare' ? findR2Bucket(`${name}-media-dev`) : Promise.resolve(false),
  ]);
  return {
    wranglerAuthed: wrangler.authed,
    ...('accountId' in wrangler && wrangler.accountId ? { accountId: wrangler.accountId } : {}),
    d1Present: Boolean(d1Id),
    ...(d1Id ? { d1Id } : {}),
    r2Present: r2,
    ghAuthed: gh,
    ...(origin ? { originRemote: origin } : {}),
    ...(nwo ? { repoNwo: nwo } : {}),
    branches: branchesList,
    ...(def ? { defaultBranch: def } : {}),
    mainProtected: protectedMain,
    environments: envs,
    secretsPresent: secrets,
  };
}

async function cmdSetupRepo(argv: string[]) {
  const a = parse(argv, {
    dry: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    public: { type: 'boolean', default: false },
    platform: { type: 'string', default: 'cloudflare' },
    'no-dev-resources': { type: 'boolean', default: false },
  });
  const platform = a.str('platform');
  if (platform !== 'cloudflare' && platform !== 'node')
    fail(`--platform "${platform}" must be cloudflare or node`);
  const name = projectName();
  const setup: HostingSetup = {
    platform,
    projectName: name,
    repoVisibility: a.flag('public') ? 'public' : 'private',
    devResources: !a.flag('no-dev-resources'),
  };
  const state = await gatherHostingState(name, setup.platform);
  const p = planHosting(setup, state);
  const dry = a.flag('dry');
  const check = a.flag('check');

  if (dry || check) {
    console.log(formatPlan(p));
    if (
      check &&
      (p.repo.action !== 'skip' ||
        p.branches.action !== 'skip' ||
        p.defaultBranch.action !== 'skip')
    ) {
      console.error('\n✖ repo/branch setup is not complete');
      process.exit(1);
    }
    return;
  }

  const results: HostingResult[] = [];
  if (p.repo.action === 'create') {
    const r = await createRepo(name, setup.repoVisibility);
    results.push({
      step: 'repo',
      status: r.ok ? 'created' : 'failed',
      detail: r.ok ? name : (r.message ?? 'failed'),
    });
    if (r.ok) {
      const push = await pushBranches();
      results.push({
        step: 'branches',
        status: push.ok ? 'created' : 'failed',
        detail: push.ok ? 'main + dev pushed' : (push.message ?? 'failed'),
      });
    }
  } else {
    results.push({ step: 'repo', status: 'present', detail: p.repo.detail });
  }

  const nwo = state.repoNwo ?? (await ghRepoNwo());
  if (nwo) {
    if (p.defaultBranch.action !== 'skip') {
      const r = await setDefaultBranch(nwo, 'dev');
      results.push({
        step: 'default branch',
        status: r.ok ? 'updated' : 'failed',
        detail: r.ok ? 'dev' : (r.message ?? 'failed'),
      });
    } else results.push({ step: 'default branch', status: 'present', detail: 'dev' });

    if (p.mainProtection.action === 'blocked') {
      const r = await protectMain(nwo);
      results.push({
        step: 'main protection',
        status: r.ok ? 'created' : 'blocked',
        detail: r.ok ? 'protected' : (r.message ?? p.mainProtection.detail),
      });
    } else
      results.push({ step: 'main protection', status: 'present', detail: p.mainProtection.detail });

    if (p.prodEnvironment.action === 'blocked') {
      const ids = await adminCollaboratorIds(nwo);
      const r = await createProdEnvironment(nwo, ids);
      results.push({
        step: 'production env',
        status: r.ok ? 'created' : 'blocked',
        detail: r.ok ? `${ids.length} reviewer(s)` : (r.message ?? p.prodEnvironment.detail),
      });
    } else
      results.push({ step: 'production env', status: 'present', detail: p.prodEnvironment.detail });

    if (p.devEnvironment.action === 'create') {
      const r = await createDevEnvironment(nwo);
      results.push({
        step: 'dev env',
        status: r.ok ? 'created' : 'failed',
        detail: r.ok ? 'no required reviewers' : (r.message ?? 'failed'),
      });
    } else results.push({ step: 'dev env', status: 'present', detail: p.devEnvironment.detail });
  } else {
    results.push({
      step: 'branch policy',
      status: 'blocked',
      detail: 'no GitHub repo yet — run this again once "repo" succeeds',
    });
  }

  console.log(formatSummary(results));
  if (results.some((r) => r.status === 'failed')) process.exit(1);
}

async function cmdSetupHosting(argv: string[]) {
  const a = parse(argv, {
    dry: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    platform: { type: 'string', default: 'cloudflare' },
    'no-dev-resources': { type: 'boolean', default: false },
  });
  const platform = a.str('platform');
  if (platform !== 'cloudflare' && platform !== 'node')
    fail(`--platform "${platform}" must be cloudflare or node`);
  const name = projectName();
  // --no-dev-resources: a pure-static Workers Assets project (no D1/R2 at all)
  // still needs the account id + eventual token, but has nothing to provision.
  const setup: HostingSetup = {
    platform,
    projectName: name,
    repoVisibility: 'private',
    devResources: !a.flag('no-dev-resources'),
  };
  const state = await gatherHostingState(name, platform);
  const p = planHosting(setup, state);
  const dry = a.flag('dry');
  const check = a.flag('check');

  if (platform === 'node') {
    console.log(
      'Hosting target "node" has no cloud resources to provision — see the template README\'s "Hosting" section.',
    );
    return;
  }
  if (!state.wranglerAuthed && !dry)
    fail('wrangler is not logged in — run `npx wrangler login` first');

  if (dry || check) {
    console.log(formatPlan(p));
    if (check && (p.d1.action !== 'skip' || p.r2.action !== 'skip')) {
      console.error('\n✖ hosting resources are not fully provisioned');
      process.exit(1);
    }
    return;
  }

  const results: HostingResult[] = [];
  let d1Id = state.d1Id;
  if (p.d1.action === 'create') {
    const r = await createD1(`${name}-dev`);
    results.push({
      step: 'dev D1',
      status: r.ok ? 'created' : 'failed',
      detail: r.ok ? (r.id ?? '') : (r.message ?? 'failed'),
    });
    if (r.ok) d1Id = r.id;
  } else results.push({ step: 'dev D1', status: 'present', detail: p.d1.detail });

  if (p.r2.action === 'create') {
    const r = await createR2Bucket(`${name}-media-dev`);
    results.push({
      step: 'dev R2',
      status: r.ok ? 'created' : 'failed',
      detail: r.ok ? `${name}-media-dev` : (r.message ?? 'failed'),
    });
  } else results.push({ step: 'dev R2', status: 'present', detail: p.r2.detail });

  const nwo = state.repoNwo ?? (await ghRepoNwo());
  if (nwo && state.ghAuthed) {
    if (d1Id && !state.secretsPresent.includes('DEV_D1_ID')) {
      const r = await setSecret('DEV_D1_ID', d1Id);
      results.push({
        step: 'secret DEV_D1_ID',
        status: r.ok ? 'created' : 'failed',
        detail: r.ok ? 'set' : (r.message ?? 'failed'),
      });
    } else
      results.push({
        step: 'secret DEV_D1_ID',
        status: state.secretsPresent.includes('DEV_D1_ID') ? 'present' : 'blocked',
        detail: d1Id ?? 'D1 id unknown',
      });

    if (state.accountId && !state.secretsPresent.includes('CLOUDFLARE_ACCOUNT_ID')) {
      const r = await setSecret('CLOUDFLARE_ACCOUNT_ID', state.accountId);
      results.push({
        step: 'secret CLOUDFLARE_ACCOUNT_ID',
        status: r.ok ? 'created' : 'failed',
        detail: r.ok ? 'set' : (r.message ?? 'failed'),
      });
    } else
      results.push({
        step: 'secret CLOUDFLARE_ACCOUNT_ID',
        status: state.secretsPresent.includes('CLOUDFLARE_ACCOUNT_ID') ? 'present' : 'blocked',
        detail: state.accountId ?? 'unknown',
      });
  } else {
    results.push({
      step: 'secrets',
      status: 'blocked',
      detail: 'no GitHub repo wired up yet — run `vitops setup repo` first',
    });
  }

  results.push({
    step: 'secret CLOUDFLARE_API_TOKEN',
    status: 'blocked',
    detail: p.secrets['CLOUDFLARE_API_TOKEN']?.detail ?? 'create it by hand',
  });

  console.log(formatSummary(results));
  for (const n of p.notes) console.log(`! ${n}`);
  if (results.some((r) => r.status === 'failed')) process.exit(1);
}

async function cmdSetupDomain(argv: string[]) {
  const a = parse(argv, {
    ...SITE_OPTS,
    dry: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    domain: { type: 'string' },
  });
  const wranglerPath = resolve('wrangler.jsonc');
  if (!existsSync(wranglerPath)) fail('wrangler.jsonc not found — run this from the project root');
  const raw = readFileSync(wranglerPath, 'utf8');
  const customDomainMatch = /^\s*"routes":\s*\[\s*\{\s*"pattern":\s*"([^"]+)"/m.exec(
    raw
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n'),
  );
  const customDomain = customDomainMatch?.[1] ?? (a.opt('domain') ? undefined : undefined);

  const cfg = await loadConfig(a.path('input'), a.str('site-env'));
  const env = cfg.site.environments[a.str('site-env')] ?? cfg.site.environments['production'];

  const state: DomainState = {
    wranglerDev: !raw.includes('"routes"') || Boolean(customDomainMatch) === false,
    ...(customDomain ? { customDomain } : {}),
    ...(env?.url ? { configuredUrl: env.url } : {}),
    ...(cfg.site.domains?.canonical ? { canonical: cfg.site.domains.canonical } : {}),
    ...(env?.robots ? { robots: env.robots } : {}),
  };

  const step = planDomainConsistency(state);
  console.log(`${step.action === 'skip' ? '·' : '?'} domain consistency  ${step.detail}`);
  if (a.opt('domain'))
    console.log(
      `\nCutover is never applied by this command — see SETUP.html stage 4b. To cut over: uncomment ` +
        `routes in wrangler.jsonc with "pattern": "${a.opt('domain')}", deploy, then update ` +
        `site.domains.canonical and site.environments.${a.str('site-env')}.url to match.`,
    );
  if (a.flag('check') && step.action !== 'skip') process.exit(1);
}

/** Forward to the CLI's own `search setup` / `ads setup` as a child process — see
 * this module's docblock for why (their behaviour must not be re-derived). */
function forward(sub: 'search' | 'ads', argv: string[]): boolean {
  try {
    execFileSync(process.execPath, [process.argv[1]!, sub, 'setup', ...argv], { stdio: 'inherit' });
    return true;
  } catch (err) {
    const e = err as { status?: number };
    if (e.status != null) return false;
    fail(msg(err));
  }
}

export async function cmdSetup(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'repo':
      return cmdSetupRepo(rest);
    case 'hosting':
      return cmdSetupHosting(rest);
    case 'domain':
      return cmdSetupDomain(rest);
    case 'search':
      if (!forward('search', rest)) process.exit(1);
      return;
    case 'ads':
      if (!forward('ads', rest)) process.exit(1);
      return;
    case 'all': {
      const a = parse(rest, {
        dry: { type: 'boolean', default: false },
        check: { type: 'boolean', default: false },
        public: { type: 'boolean', default: false },
        platform: { type: 'string', default: 'cloudflare' },
        'no-dev-resources': { type: 'boolean', default: false },
      });
      const dryCheckFlags = [
        ...(a.flag('dry') ? ['--dry'] : []),
        ...(a.flag('check') ? ['--check'] : []),
      ];
      const hostingFlags = [
        ...dryCheckFlags,
        '--platform',
        a.str('platform'),
        ...(a.flag('no-dev-resources') ? ['--no-dev-resources'] : []),
      ];
      console.log('── repo ──');
      await cmdSetupRepo([...hostingFlags, ...(a.flag('public') ? ['--public'] : [])]);
      console.log('\n── hosting ──');
      await cmdSetupHosting(hostingFlags);
      console.log('\n── search ──');
      const searchOk = forward('search', dryCheckFlags);
      console.log('\n── ads ──');
      const adsOk = forward('ads', dryCheckFlags);
      if (!searchOk || !adsOk) process.exit(1);
      return;
    }
    case undefined:
    case '-h':
    case '--help':
      console.log(SETUP_HELP);
      return;
    default:
      fail(
        `unknown "setup" subcommand "${sub}" (expected: repo | hosting | domain | search | ads | all). Try: vitops --help`,
      );
  }
}
