/**
 * `vitops setup`'s own option surface.
 *
 * Structural, not imported from `@getvitops/generator`, for the same reason as
 * `onboarding/types.ts` and `ads/types.ts`: the generator already depends on this
 * package, so importing back would be a cycle. `exactOptionalPropertyTypes` is on,
 * so optional fields are `?: T | undefined` throughout — these describe a *parsed
 * JSON config*, where an absent key and an explicit `undefined` are the same thing.
 */

/** What the operator wants provisioned, derived from the config + CLI flags. */
export interface HostingSetup {
  platform: 'cloudflare' | 'node';
  /** Repo name (also the D1/R2 name prefix), derived from `package.json`'s name. */
  projectName: string;
  repoVisibility: 'public' | 'private';
  /** Whether the isolated dev D1 + R2 should be provisioned (cloudflare only). */
  devResources: boolean;
  /** GitHub `owner/repo`, once known — absent before `repo` has run. */
  repoNwo?: string | undefined;
}

/** Everything gathered from the live GitHub + Cloudflare state before planning. */
export interface HostingState {
  wranglerAuthed: boolean;
  accountId?: string | undefined;
  d1Present: boolean;
  d1Id?: string | undefined;
  r2Present: boolean;
  ghAuthed: boolean;
  originRemote?: string | undefined;
  repoNwo?: string | undefined;
  branches: string[];
  defaultBranch?: string | undefined;
  mainProtected: boolean;
  /** `production`/`dev` environment names already present on the repo. */
  environments: string[];
  /** Repo secret names already set (values are never readable via the API). */
  secretsPresent: string[];
}

/** One domain-consistency observation — read from `wrangler.jsonc` + the config. */
export interface DomainState {
  wranglerDev: boolean;
  customDomain?: string | undefined;
  /** `site.environments.<env>.url`, as configured. */
  configuredUrl?: string | undefined;
  /** `site.domains.canonical`, as configured. */
  canonical?: string | undefined;
  robots?: string | undefined;
}
