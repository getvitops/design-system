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
 * Builds the `context` option `createConversionRoute()` expects, straight from a
 * resolved `Config` — instead of every consumer hand-writing a `NotifyContext`
 * literal.
 *
 * `organization.name` is localizable; `locale` picks which one (defaults to
 * `site.defaultLocale`, which is also the fallback if the pick has no entry).
 * Falls back to `legalName` when `name` isn't set at all, and to `undefined`
 * (never `''`) when neither resolves to anything — `t()` returns `''` for a
 * genuinely missing translation, and an empty From-header display name is worse
 * than none.
 *
 * `locationEmails` is primary-first, then every other location with an `email`,
 * in `organization.locations`' own key order — `planNotifications` picks the
 * first that's set, so order here is the whole precedence.
 */
export function toNotifyContext(config: Config, locale?: string): NotifyContext {
  const org = config.organization;
  const resolvedLocale = locale ?? config.site.defaultLocale;
  const name =
    org?.name != null
      ? t(org.name, resolvedLocale, config.site.defaultLocale) || undefined
      : undefined;

  const primaryKey = org?.primaryLocation;
  const locationEmails = Object.entries(org?.locations ?? {})
    .sort(([a], [b]) => (a === primaryKey ? -1 : b === primaryKey ? 1 : 0))
    .map(([, loc]) => loc.email)
    .filter((email): email is string => !!email);

  return {
    notifications: config.site.notifications,
    canonical: config.site.domains?.canonical,
    organizationName: name ?? org?.legalName,
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
