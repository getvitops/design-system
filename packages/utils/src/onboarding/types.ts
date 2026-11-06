/**
 * The onboarding module's own option surface.
 *
 * The `site.searchConsole.<domain>` block is the schema's own type, from `@getvitops/config`;
 * `DomainSetup` below is that block plus the domain it is keyed by.
 */

import type { SearchConsoleSetupConfig } from '@getvitops/config';

/**
 * One domain to onboard: the `site.searchConsole.<domain>` block from `@getvitops/config`
 * (`delegatedOwners`, `fullUserGroup`) plus the domain it is keyed by, which becomes the
 * `sc-domain:` property and the DNS zone name.
 */
export type DomainSetup = SearchConsoleSetupConfig & {
  /** The domain, bare (`acme.ca`). */
  domain: string;
};

/** Everything `plan()` needs, once the CLI has read the config and creds. */
export interface OnboardingConfig {
  /** The domains to onboard. Already filtered to `--domain` if that was passed. */
  domains: DomainSetup[];
}

/**
 * Google user-OAuth credential (refresh-token flow — never a service account).
 * Declared beside the token exchange that consumes it, and re-exported here so
 * this module stays the one place onboarding's types are looked up.
 */
export type { GoogleOAuth } from '../google/token.ts';

/**
 * One domain's observed live state, gathered by the executors before planning.
 *
 * `plan()` compares this against the desired `DomainSetup` to decide each step —
 * the same shape the indexing planner takes its sitemap snapshot in, for the same
 * reason: the decision is pure, the observation is not.
 */
export interface DomainState {
  /** The Cloudflare zone id for the domain, if one was found. */
  zoneId?: string | undefined;
  /** An apex TXT record already carrying the verification token exists. */
  txtPresent: boolean;
  /** The Site Verification web resource reports this domain as verified. */
  verified: boolean;
  /** Owners currently on the web resource (empty when not yet verified). */
  currentOwners: string[];
  /** A `sc-domain:` property already exists in Search Console. */
  propertyExists: boolean;
}
