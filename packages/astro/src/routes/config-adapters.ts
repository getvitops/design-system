/**
 * Adapts a resolved `Config` (`@getvitops/generator`) into the structural shapes
 * `createConversionRoute()` expects — `context: NotifyContext` and `crm.config:
 * CrmConfig`. Neither of those types can import `Config` themselves (they live in
 * `@getvitops/utils`, which the generator already depends on — importing back
 * would be a cycle), which is why `conversion.ts`'s own docblock used to describe
 * `toNotifyContext(config)` as a helper that "does not exist." This package
 * already depends on both the generator and utils, so it's the one place the
 * adapter can live.
 *
 * `import type` only — erased at build, so pulling in `Config`'s type costs
 * nothing at runtime and doesn't drag the generator's `node:fs`/lightningcss
 * entry point into a Worker bundle.
 */
import type { Config } from '@getvitops/generator';
import { t } from '@getvitops/utils';
import type { CrmConfig } from '@getvitops/utils/crm';
import type { NotifyContext } from '@getvitops/utils/notify';

/**
 * Resolves the one display name for a site's organization — `organization.name`
 * (localizable; `locale` picks which one, defaulting to `site.defaultLocale`,
 * which is also the fallback if the pick has no entry), falling back to
 * `legalName` when `name` isn't set at all, and to `undefined` (never `''`)
 * when neither resolves to anything — `t()` returns `''` for a genuinely
 * missing translation, and an empty name is worse than none.
 *
 * This is the one place that fallback chain is written. An EmDash site's own
 * `getSiteSettings().title` is a separate, runtime-only fact (EmDash's
 * settings aren't readable at Astro build/config time at all — see
 * AGENTS.md's "EmDash plugin as the design-system editing surface") and stays
 * authoritative for what it drives (the rendered page chrome); this helper is
 * for the build-time-only consumers that can't reach EmDash at all — favicon
 * generation, generated legal documents, notification emails — so a scaffold
 * needing a name in `astro.config.mjs` has one real source instead of a third
 * hardcoded string.
 */
export function resolveOrganizationName(config: Config, locale?: string): string | undefined {
  const org = config.organization;
  const resolvedLocale = locale ?? config.site.defaultLocale;
  const name =
    org?.name != null
      ? t(org.name, resolvedLocale, config.site.defaultLocale) || undefined
      : undefined;
  return name ?? org?.legalName;
}

/**
 * Builds the `context` option `createConversionRoute()` expects, straight from a
 * resolved `Config` — instead of every consumer hand-writing a `NotifyContext`
 * literal.
 *
 * `locationEmails` is primary-first, then every other location with an `email`,
 * in `organization.locations`' own key order — `planNotifications` picks the
 * first that's set, so order here is the whole precedence.
 */
export function toNotifyContext(config: Config, locale?: string): NotifyContext {
  const org = config.organization;
  const primaryKey = org?.primaryLocation;
  const locationEmails = Object.entries(org?.locations ?? {})
    .sort(([a], [b]) => (a === primaryKey ? -1 : b === primaryKey ? 1 : 0))
    .map(([, loc]) => loc.email)
    .filter((email): email is string => !!email);

  return {
    notifications: config.site.notifications,
    canonical: config.site.domains?.canonical,
    organizationName: resolveOrganizationName(config, locale),
    locationEmails,
  };
}

/**
 * `site.crm` is already field-for-field identical to `CrmConfig` (see that
 * interface's own docblock — it's deliberately kept in lockstep) — this is a
 * type-narrowing pass-through, not a remap. Named rather than inlined at each
 * call site so a future divergence between the two shapes has one place to fix.
 */
export function toCrmConfig(config: Config): CrmConfig | undefined {
  return config.site.crm;
}
