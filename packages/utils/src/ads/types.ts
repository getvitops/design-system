/**
 * The ads module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['ads']` imported from
 * `@getvitops/generator`: the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field, so the CLI's adapter is a flat map — the same arrangement, and for the
 * same reason, as `IndexingConfig` and `DomainSetup` beside it.
 *
 * Optional fields are written `?: T | undefined` throughout: `exactOptionalPropertyTypes`
 * is on, and these describe a *parsed JSON config* where an absent key and an explicit
 * `undefined` are the same thing.
 */

/**
 * The ad platforms this toolchain knows how to link a site to.
 *
 * A closed set, mirroring `AD_PROVIDERS` in the generator's `config.ts` — the
 * capability table in `providers.ts` has one entry per member, and a test in the
 * generator asserts the two lists agree. An open string would mean a typo'd
 * provider silently getting no verification step and no tag.
 */
export type AdProvider =
  | 'google'
  | 'meta'
  | 'linkedin'
  | 'reddit'
  | 'tiktok'
  | 'microsoft'
  | 'pinterest'
  | 'snapchat';

/** Which consent category gates a provider's tag. */
export type AdConsentCategory = 'marketing' | 'analytics';

/** One ad property to link, as the config declares it. */
export interface AdPropertySetup {
  provider: AdProvider;
  /**
   * The account as the platform shows it — Google Ads customer id, Meta ad
   * account, LinkedIn partner id, Reddit advertiser id.
   */
  accountId?: string | undefined;
  /** The tag/pixel id, when the platform issues one distinct from the account. */
  pixelId?: string | undefined;
  /** Google Ads only: the conversion label paired with the conversion id. */
  conversionLabel?: string | undefined;
  /** The host to verify, bare (`acme.ca`). The CLI defaults it from the canonical domain. */
  domain?: string | undefined;
  /**
   * The verification token from the platform UI.
   *
   * A bare token gets the provider's TXT prefix applied; a value already
   * containing `=` is used as the whole record content, which is the escape hatch
   * for a platform changing its prefix without waiting on a toolchain release.
   */
  domainVerification?: string | undefined;
  /** Category the tag waits on. Defaults to `marketing`. */
  category?: AdConsentCategory | undefined;
  enabled?: boolean | undefined;
}

/** Everything `plan()` needs, once the CLI has read the config. */
export interface AdsConfig {
  /** The properties to link. Already filtered to `--provider` if that was passed. */
  properties: AdPropertySetup[];
}

/**
 * One property's observed live state, gathered by the executor before planning.
 *
 * Same shape of arrangement as `DomainState`: the decision is pure, the
 * observation is not. `txtContents` is every apex TXT record on the domain, so
 * the planner can decide both "our record is present" and "a *different* record
 * from this provider is present" — the second is a token rotation, which needs
 * saying rather than silently adding a second record.
 */
export interface AdDomainState {
  /** The Cloudflare zone id for the domain, if one was found. */
  zoneId?: string | undefined;
  /** Every apex TXT record content, unquoted. */
  txtContents: string[];
}
