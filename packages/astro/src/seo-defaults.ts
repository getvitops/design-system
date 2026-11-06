/**
 * Resolves `site.seo` into the `GetvitopsSeoOptions` shape `<Seo />` consumes.
 *
 * The site config is the single source of site-level SEO defaults (ADR-0002); this is the one place
 * its `Localizable` values become plain strings for a build locale. `vitops({ seo })` stays as an
 * override merged over the result, so an app can still set one field in code.
 *
 * Pure — it reads a parsed config and returns JSON-serialisable data (the result is
 * `JSON.stringify`d into `virtual:getvitops/head`). `import type` only, for the same reason
 * `config-adapters.ts` does it: nothing here may drag the generator into a Worker bundle.
 */
import type { Config } from '@getvitops/generator';
import { t } from '@getvitops/utils/content';
import { resolveOrganizationName } from './routes/config-adapters.ts';
import type { GetvitopsSeoOptions } from './seo.ts';

export interface ResolveSeoDefaultsOptions {
  /** Build locale. Default `site.defaultLocale`; a value with no entry falls back to the default. */
  locale?: string;
  /** Which `site.environments` entry to read `robots` from. Default `'production'`. */
  env?: string;
}

/** Drop `undefined`/empty-string keys so the result carries only what the config actually states. */
function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== ''),
  ) as T;
}

export function resolveSeoDefaults(
  config: Config,
  options: ResolveSeoDefaultsOptions = {},
): GetvitopsSeoOptions {
  const seo = config.site.seo;
  const defaultLocale = config.site.defaultLocale;
  const locale = options.locale ?? defaultLocale;
  const text = (value: Parameters<typeof t>[0]) => t(value, locale, defaultLocale) || undefined;

  // The same fact `vitops robots` and `search notify` read, so a staging page can't say `index`
  // while its robots.txt says `Disallow`.
  const robots = config.site.environments?.[options.env ?? 'production']?.robots ?? seo?.robots;

  const image = seo?.openGraph?.image;
  const openGraph = compact({
    type: seo?.openGraph?.type,
    locale: seo?.openGraph?.locale,
    localeAlternates: seo?.openGraph?.localeAlternates,
    image:
      image === undefined
        ? undefined
        : typeof image === 'string'
          ? { url: image }
          : compact({
              url: image.src,
              alt: image.alt,
              width: image.width,
              height: image.height,
              type: image.type,
            }),
  });
  const twitter = compact({
    card: seo?.twitter?.card,
    site: seo?.twitter?.site,
    creator: seo?.twitter?.creator,
  });

  return compact({
    siteName: text(seo?.siteName) ?? resolveOrganizationName(config, locale),
    titleTemplate: text(seo?.titleTemplate),
    defaultTitle: text(seo?.defaultTitle),
    defaultDescription: text(seo?.defaultDescription),
    robots,
    googleSiteVerification: seo?.googleSiteVerification,
    bingSiteVerification: seo?.bingSiteVerification,
    ...(Object.keys(openGraph).length ? { openGraph } : {}),
    ...(Object.keys(twitter).length ? { twitter } : {}),
  }) as GetvitopsSeoOptions;
}

/**
 * Merge `vitops({ seo })` over config-derived defaults. The two nested objects merge key by key, so
 * setting `openGraph.locale` in code doesn't discard the config's fallback image.
 */
export function mergeSeoDefaults(
  fromConfig: GetvitopsSeoOptions,
  override: GetvitopsSeoOptions | undefined,
): GetvitopsSeoOptions {
  if (!override) return fromConfig;
  const merged: GetvitopsSeoOptions = { ...fromConfig, ...override };
  if (fromConfig.openGraph || override.openGraph)
    merged.openGraph = { ...fromConfig.openGraph, ...override.openGraph };
  if (fromConfig.twitter || override.twitter)
    merged.twitter = { ...fromConfig.twitter, ...override.twitter };
  return merged;
}
