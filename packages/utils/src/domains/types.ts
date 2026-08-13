/**
 * The domains module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['domains']` imported from
 * `@getvitops/generator`: the generator already depends on this package, so importing
 * back would be a cycle. The vocabulary mirrors that block field for field, so the
 * CLI's adapter is a flat map — the same arrangement, and for the same reason, as
 * `IndexingConfig`, `DomainSetup` and `AdPropertySetup` beside it.
 *
 * Optional fields are written `?: T | undefined` throughout: `exactOptionalPropertyTypes`
 * is on, and these describe a *parsed JSON config* where an absent key and an explicit
 * `undefined` are the same thing.
 */

/** The redirect status codes the config's `HttpRedirect` union allows. */
export type RedirectStatus = 301 | 302 | 307 | 308;

/**
 * One alias host and where it goes.
 *
 * `domain` and `redirectTo` are **bare hosts** (`www.acme.ca`), while the canonical is
 * a full origin — the shape the config already had. The planner normalises a target to
 * `https://<host>`, since sending an alias to `http://` would defeat the point.
 */
export interface AliasSetup {
  domain: string;
  /** Defaults to the canonical host. */
  redirectTo?: string | undefined;
  /** Defaults to 301. */
  redirectType?: RedirectStatus | undefined;
  /** When set, the alias applies only to this environment. */
  environment?: string | undefined;
  /**
   * True when the planner derived this alias rather than reading it from `aliases` —
   * the implicit `www` ↔ apex counterpart of the canonical host. Carried so the plan
   * can say where a rule came from; a consumer who never wrote an `aliases` entry
   * should still see why their `www` host is being redirected.
   */
  implicit?: boolean | undefined;
}

/** HSTS parameters, as the config declares them. Defaults live in the planner. */
export interface HstsSetup {
  /** Default true. */
  enabled?: boolean | undefined;
  /** Seconds. Default 15552000 (6 months) — Cloudflare's own starting recommendation. */
  maxAge?: number | undefined;
  /** Default false. Reaches every subdomain, including ones this config cannot see. */
  includeSubDomains?: boolean | undefined;
  /** Default false. The preload list requires maxAge >= 1 year AND includeSubDomains. */
  preload?: boolean | undefined;
}

/**
 * HSTS with every default applied — what the planner compares and the executor sends.
 *
 * Spelled out rather than `Required<HstsSetup>`: `exactOptionalPropertyTypes` means the
 * fields are declared `?: T | undefined`, and `Required` only removes the `?`, leaving
 * `number | undefined` behind. The utility type reads as "all defaults applied" and
 * isn't.
 */
export interface ResolvedHsts {
  enabled: boolean;
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
}

/** The `site.domains` block, as `plan()` needs it. */
export interface DomainsSetup {
  /** Full origin (`https://acme.ca`) — the config's `domains.canonical`. */
  canonical: string;
  aliases?: AliasSetup[] | undefined;
  /** Always Use HTTPS on the canonical zone. Default true. */
  httpsEnabled?: boolean | undefined;
  hsts?: HstsSetup | undefined;
  /** The environment this run targets, for filtering environment-scoped aliases. */
  environment?: string | undefined;
  /**
   * Hosts of every configured environment, with their scheme — used to refuse
   * `includeSubDomains` when a sibling environment is still on plaintext http.
   */
  environmentOrigins?: string[] | undefined;
}

/** A Page Rule as Cloudflare returns it, narrowed to what the planner compares. */
export interface PageRuleState {
  id: string;
  /** The rule's URL pattern, e.g. `www.acme.ca/*`. */
  target: string;
  /** Present only on a forwarding rule. */
  forwardTo?: string | undefined;
  status?: RedirectStatus | undefined;
  /** `active` or `disabled`. A disabled rule does nothing, so it is not "already done". */
  enabled?: boolean | undefined;
}

/** Whether Cloudflare is actually authoritative for a zone, and what it is serving. */
export interface ZoneState {
  /** Absent when no zone of this name is in the account at all. */
  zoneId?: string | undefined;
  /**
   * Cloudflare's own `status` for the zone. Only `active` means the registrar has
   * delegated to Cloudflare — a `pending` zone exists in the dashboard and serves
   * nothing, so every step here would be a no-op that looked like a success.
   */
  status?: string | undefined;
  /** The nameservers Cloudflare expects at the registrar, for the blocked message. */
  nameServers?: string[] | undefined;
  /** Every Page Rule currently on the zone — foreign ones included. */
  pageRules?: PageRuleState[] | undefined;
  /** Page Rules the plan allows, from the zone's plan tier. Unknown when absent. */
  pageRuleQuota?: number | undefined;
  alwaysUseHttps?: boolean | undefined;
  hsts?: HstsSetup | undefined;
  /** Record types already present on an alias host — decides the placeholder record. */
  aliasRecordTypes?: string[] | undefined;
  /** Whether the alias host's existing records are proxied through Cloudflare. */
  aliasProxied?: boolean | undefined;
}
