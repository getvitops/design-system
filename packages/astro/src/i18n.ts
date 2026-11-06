/**
 * Reconciles `site.locales`/`site.defaultLocale` against Astro's own `i18n`
 * config block.
 *
 * The two are a second, currently-disconnected locale list — EmDash reads
 * locales straight from `astro.config.mjs`'s `i18n` block (see AGENTS.md's
 * "i18n is Astro-config-driven, not `Config`-driven" note), while our own
 * SEO/legal code reads `site.locales`/`defaultLocale`. Nothing here merges
 * them into one source: `generate()`/`resolveConfig()` stay pure and
 * filesystem-only (see AGENTS.md's "Config records facts" framing — teaching
 * the generator to parse a consumer's `astro.config.mjs` would cost that),
 * so this only says when the two disagree, at the one layer that already
 * legitimately reads both — the Astro integration's `astro:config:setup`
 * hook, which has Astro's resolved `config.i18n` in hand alongside whatever
 * `site.json` `readSiteAds`/`readSiteConsentTracking` beside it already read.
 *
 * A **warning**, not the hard error `consentTrackingConflicts` throws for a
 * consent contradiction: plenty of legitimate sites configure `site.locales`
 * (for `<Seo>`/legal prose) with no Astro i18n routing at all, and the
 * reverse — i18n routing with no `site`/`css` option wired up here — is
 * equally legitimate. Either absence is silence, not a mismatch.
 */

/** Astro's own `i18n` config shape, narrowed to what this needs. */
export interface AstroI18nLike {
  defaultLocale: string;
  locales: (string | { path: string; codes: string[] })[];
}

function codesOf(entry: string | { path: string; codes: string[] }): string[] {
  return typeof entry === 'string' ? [entry] : entry.codes;
}

/** Every BCP-47 code Astro's `i18n` block actually recognises. */
export function astroLocaleCodes(i18n: AstroI18nLike): Set<string> {
  return new Set(i18n.locales.flatMap(codesOf));
}

/**
 * Warning strings for a mismatch — `[]` when either side is absent (nothing
 * to reconcile) or the two agree.
 */
export function localeConsistencyWarnings(
  site: { locales: Record<string, unknown>; defaultLocale: string } | null | undefined,
  i18n: AstroI18nLike | undefined,
): string[] {
  if (!site || !i18n) return [];
  const warnings: string[] = [];
  const astroCodes = astroLocaleCodes(i18n);
  const siteCodes = new Set(Object.keys(site.locales));
  const onlyInSite = [...siteCodes].filter((c) => !astroCodes.has(c));
  const onlyInAstro = [...astroCodes].filter((c) => !siteCodes.has(c));

  if (onlyInSite.length || onlyInAstro.length)
    warnings.push(
      `i18n: site.locales and astro.config.mjs's i18n.locales disagree` +
        (onlyInSite.length
          ? ` — site.locales has ${onlyInSite.map((c) => `"${c}"`).join(', ')} that astro's i18n doesn't`
          : '') +
        (onlyInAstro.length
          ? `${onlyInSite.length ? ', and' : ' —'} astro's i18n has ${onlyInAstro.map((c) => `"${c}"`).join(', ')} that site.locales doesn't`
          : '') +
        `. EmDash reads locales from astro.config.mjs directly, so a locale missing there never ` +
        `reaches its admin regardless of what site.locales says.`,
    );
  if (i18n.defaultLocale !== site.defaultLocale)
    warnings.push(
      `i18n: astro.config.mjs's i18n.defaultLocale ("${i18n.defaultLocale}") does not match ` +
        `site.defaultLocale ("${site.defaultLocale}") — SEO/legal prose renders in one locale by ` +
        `default while EmDash's own routing defaults to the other.`,
    );
  return warnings;
}
