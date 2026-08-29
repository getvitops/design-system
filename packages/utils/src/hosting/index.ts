/**
 * `vitops setup repo|hosting` — GitHub repo/branch policy and Cloudflare dev
 * resources for a scaffolded project.
 *
 * A separate subpath (`@getvitops/utils/hosting`), matching `./onboarding` and
 * `./ads`: this shells out to `wrangler`/`gh`, so a consumer importing the content
 * helpers shouldn't pull that in.
 *
 * The layering is the point. `plan.ts` decides everything and touches nothing;
 * `wrangler.ts` and `github.ts` execute a plan and decide nothing.
 */
export {
  blockedSteps,
  formatPlan,
  formatSummary,
  hasDrift,
  plan,
  planDomainConsistency,
} from './plan.ts';
export type { HostingPlan, HostingResult, StepAction, StepPlan } from './plan.ts';

export type { DomainState, HostingSetup, HostingState } from './types.ts';

export {
  createD1,
  createR2Bucket,
  findD1,
  findR2Bucket,
  realExec,
  wranglerWhoami,
} from './wrangler.ts';
export type { ExecImpl, ExecResult } from './wrangler.ts';

export {
  adminCollaboratorIds,
  branches,
  createDevEnvironment,
  createProdEnvironment,
  createRepo,
  defaultBranch,
  environments,
  ghAuthed,
  mainProtected,
  originRemote,
  protectMain,
  pushBranches,
  repoNwo,
  secretsPresent,
  setDefaultBranch,
  setSecret,
} from './github.ts';
