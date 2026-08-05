/**
 * The onboarding module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['searchConsole']` imported
 * from `@getvitops/generator`: the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field, so the CLI's adapter is a flat map — the same arrangement, and for the
 * same reason, as `IndexingConfig` beside it.
 *
 * Optional fields are written `?: T | undefined` throughout: `exactOptionalPropertyTypes`
 * is on, and these types describe a *parsed JSON config* where an absent key and an
 * explicit `undefined` are the same thing.
 */

/** One domain to onboard, as the config declares it. */
export interface DomainSetup {
  /** The domain, bare (`acme.ca`). Becomes the `sc-domain:` property and the DNS zone name. */
  domain: string;
  /**
   * Emails added as verification owners on the Site Verification web resource.
   * Additive: existing owners are never removed.
   */
  delegatedOwners?: string[] | undefined;
  /**
   * A Google Group to grant Full-User access in Search Console. Surfaced as a
   * reminder only — Search Console has no user/permission API.
   */
  fullUserGroup?: string | undefined;
}

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
