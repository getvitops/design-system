/**
 * GitHub repo, branches, environments and secrets. Executes a plan and decides
 * nothing — see `wrangler.ts`'s docblock for why this shells out (`gh` carries the
 * auth; there is no token-free REST alternative) and for the `execImpl` seam.
 *
 * Absorbs the behaviour of the templates' old `scripts/init-github.mjs`:
 * `dev` is left with **no required reviewers**, deliberately — that is what keeps
 * it the unprotected integration branch. `main` protection and the `production`
 * environment's reviewer policy both 403 on a private repo without GitHub
 * Pro/Team; that is reported as `blocked`, not `failed` — see `plan.ts`.
 */
import type { ExecImpl } from './wrangler.ts';
import { realExec } from './wrangler.ts';

export async function ghAuthed(execImpl: ExecImpl = realExec): Promise<boolean> {
  return (await execImpl('gh', ['auth', 'status'])).ok;
}

export async function originRemote(execImpl: ExecImpl = realExec): Promise<string | undefined> {
  const res = await execImpl('git', ['remote', 'get-url', 'origin']);
  return res.ok ? res.stdout.trim() : undefined;
}

export async function repoNwo(execImpl: ExecImpl = realExec): Promise<string | undefined> {
  const res = await execImpl('gh', ['repo', 'view', '--json', 'nameWithOwner']);
  if (!res.ok) return undefined;
  try {
    return (JSON.parse(res.stdout) as { nameWithOwner: string }).nameWithOwner;
  } catch {
    return undefined;
  }
}

export async function branches(execImpl: ExecImpl = realExec): Promise<string[]> {
  const res = await execImpl('git', ['branch', '--list', '--format=%(refname:short)']);
  if (!res.ok) return [];
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function defaultBranch(
  nwo: string,
  execImpl: ExecImpl = realExec,
): Promise<string | undefined> {
  const res = await execImpl('gh', ['repo', 'view', nwo, '--json', 'defaultBranchRef']);
  if (!res.ok) return undefined;
  try {
    return (JSON.parse(res.stdout) as { defaultBranchRef?: { name: string } }).defaultBranchRef
      ?.name;
  } catch {
    return undefined;
  }
}

export async function mainProtected(nwo: string, execImpl: ExecImpl = realExec): Promise<boolean> {
  return (await execImpl('gh', ['api', `repos/${nwo}/branches/main/protection`])).ok;
}

export async function environments(nwo: string, execImpl: ExecImpl = realExec): Promise<string[]> {
  const res = await execImpl('gh', ['api', `repos/${nwo}/environments`]);
  if (!res.ok) return [];
  try {
    return (
      (JSON.parse(res.stdout) as { environments?: { name: string }[] }).environments ?? []
    ).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function secretsPresent(
  nwo: string,
  execImpl: ExecImpl = realExec,
): Promise<string[]> {
  const res = await execImpl('gh', ['api', `repos/${nwo}/actions/secrets`]);
  if (!res.ok) return [];
  try {
    return ((JSON.parse(res.stdout) as { secrets?: { name: string }[] }).secrets ?? []).map(
      (s) => s.name,
    );
  } catch {
    return [];
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createRepo(
  name: string,
  visibility: 'public' | 'private',
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', [
    'repo',
    'create',
    name,
    `--${visibility}`,
    '--source=.',
    '--remote=origin',
  ]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

export async function pushBranches(
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('git', ['push', '-u', 'origin', 'main', 'dev']);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

export async function setDefaultBranch(
  nwo: string,
  branch: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', ['repo', 'edit', nwo, `--default-branch=${branch}`]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

/**
 * `PUT .../branches/main/protection`. A 403 on Pro/Team-gated repos is expected.
 *
 * Every field goes through `gh api`'s `-f`/`-F` form flags rather than a JSON body
 * on stdin — `gh api` supports nested keys (`a[b]=c`) and repeated array keys
 * (`a[]=x`) this way, so no request needs a second I/O channel `ExecImpl` would
 * have to carry just for this one call.
 */
export async function protectMain(
  nwo: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', [
    'api',
    '--method',
    'PUT',
    `repos/${nwo}/branches/main/protection`,
    '-F',
    'required_status_checks[strict]=true',
    '-f',
    'required_status_checks[contexts][]=ci',
    '-F',
    'enforce_admins=false',
    '-F',
    'required_pull_request_reviews[required_approving_review_count]=1',
    '-F',
    'restrictions=null',
    '-F',
    'allow_force_pushes=false',
    '-F',
    'allow_deletions=false',
  ]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

/** The repo's admin collaborators — numeric user ids, which is what the
 * environment-reviewers API wants (not logins). */
export async function adminCollaboratorIds(
  nwo: string,
  execImpl: ExecImpl = realExec,
): Promise<number[]> {
  const res = await execImpl('gh', ['api', `repos/${nwo}/collaborators?permission=admin`]);
  if (!res.ok) return [];
  try {
    return (JSON.parse(res.stdout) as { id: number }[]).map((c) => c.id);
  } catch {
    return [];
  }
}

/** `PUT .../environments/production`, reviewers = current admin collaborators. */
export async function createProdEnvironment(
  nwo: string,
  reviewerUserIds: number[],
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', [
    'api',
    '--method',
    'PUT',
    `repos/${nwo}/environments/production`,
    '-f',
    `deployment_branch_policy[protected_branches]=true`,
    '-f',
    `deployment_branch_policy[custom_branch_policies]=false`,
    ...reviewerUserIds.flatMap((id) => [
      '-F',
      `reviewers[][id]=${id}`,
      '-f',
      'reviewers[][type]=User',
    ]),
  ]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

/** `PUT .../environments/dev` with no reviewers — deliberately left open. */
export async function createDevEnvironment(
  nwo: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', ['api', '--method', 'PUT', `repos/${nwo}/environments/dev`]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

export async function setSecret(
  name: string,
  value: string,
  execImpl: ExecImpl = realExec,
): Promise<{ ok: boolean; message?: string | undefined }> {
  const res = await execImpl('gh', ['secret', 'set', name, '--body', value]);
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}
