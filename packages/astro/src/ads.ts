/**
 * The `<Ads />` resolution layer — the site's ad properties in, the exact tags to
 * emit out.
 *
 * A sibling of `analytics.ts`, deliberately not part of it. The two render the
 * same gated markup, but they answer different questions and four things differ:
 *
 *  - **Where they come from.** Analytics providers are integration options
 *    (`vitops({ analytics })`); ad properties are `site.ads` in the site config,
 *    because the ad account is a fact about the site that `vitops ads setup`,
 *    `vitops ads lint` and the generated cookie notice all read too.
 *  - **Who decides the consent category.** `resolveAnalytics` *derives* it from
 *    whether the provider sets cookies, so a consumer cannot mark Google Analytics
 *    `necessary` to dodge a banner. Every ad pixel sets cookies and is advertising,
 *    so the answer is `marketing` unless the config says `analytics` — a stated
 *    fact, not a derivation.
 *  - **What the key means.** `ResolvedTag['key']` is the four analytics providers,
 *    and `analytics.ts` pairs that set against the generator's processor table.
 *    Widening it to eight ad platforms would make that check answer for tags it
 *    does not govern.
 *  - **When they fire.** Analytics is gated per environment by
 *    `environments.<env>.analytics`; a preview deployment sending pageviews is
 *    survivable, one firing conversion pixels is not, so ads gets its own switch.
 *
 * Everything decidable is here and unit-tested; `Ads.astro` renders what this
 * returns and chooses nothing.
 */
import { AD_PLATFORMS, AD_PROVIDER_KEYS, type AdProvider } from '@getvitops/utils/ads';
import type { AnalyticsStrategy, ConsentCategory, GatedTag } from './analytics.ts';

/**
 * One ad property, mirroring a `site.ads` entry field for field.
 *
 * Structural rather than `SiteAdProperty` imported from the generator, matching
 * how `GetvitopsSeoOptions` and `GetvitopsTrackingOptions` already work: the
 * component surface must stay usable by a consumer who passes a plain object.
 */
export interface GetvitopsAdProperty {
  accountId?: string;
  pixelId?: string;
  conversionLabel?: string;
  /** Default `marketing`. `analytics` for a property used purely for measurement. */
  category?: 'marketing' | 'analytics';
  /** False keeps the property on record without emitting its tag. */
  enabled?: boolean;
}

export type GetvitopsAdsOptions = Partial<Record<AdProvider, GetvitopsAdProperty>>;

/** One ad tag. `key` is the platform, so a caller can find one without matching prose. */
export interface ResolvedAdTag extends GatedTag {
  key: AdProvider;
}

export interface ResolvedAds {
  tags: ResolvedAdTag[];
  /** Does anything here need `@getvitops/core/consent` loaded? */
  needsRuntime: boolean;
  /** Configuration problems, as prose. The integration logs these. */
  warnings: string[];
}

export interface ResolveAdsContext {
  /** Is the consent gate enabled on this site (`vitops({ consent })`)? */
  consent?: boolean;
  /** Categories the banner offers, so we can catch a demand with no row. */
  consentCategories?: readonly string[];
  /** `environments.<env>.ads` — false switches every tag off for this build. */
  enabled?: boolean;
  /** When the tags load. Default `idle`: a pixel is never worth the critical path. */
  strategy?: AnalyticsStrategy;
}

/**
 * IDs land inside an inline `<script>`, so they are checked rather than trusted —
 * the same guard, for the same reason, as `analytics.ts`'s `SAFE_ID`. A `</script>`
 * in a pixel ID is not a plausible accident; arbitrary script injection from a
 * config file is not a plausible thing to allow either.
 */
const SAFE_ID = /^[\w.-]+$/;

/** Resolve the configured ad properties into the tags `<Ads />` emits. */
export function resolveAds(
  ads: GetvitopsAdsOptions | undefined,
  ctx: ResolveAdsContext = {},
): ResolvedAds {
  const warnings: string[] = [];
  const tags: ResolvedAdTag[] = [];
  const strategy = ctx.strategy ?? 'idle';

  const configured = AD_PROVIDER_KEYS.filter((p) => ads?.[p] != null);
  if (configured.length === 0) return { tags, needsRuntime: false, warnings };

  // A whole-environment switch, checked before anything else: a preview deploy
  // must be able to carry the same config without firing a single pixel.
  if (ctx.enabled === false) return { tags, needsRuntime: false, warnings };

  for (const provider of configured) {
    const entry = ads![provider]!;
    if (entry.enabled === false) continue;

    const platform = AD_PLATFORMS[provider];
    const id = entry[platform.tag.needs];
    if (!id) {
      warnings.push(
        `ads: ${provider} has no ${platform.tag.needs}, so no tag is emitted. ` +
          `Run \`vitops ads setup\` to be prompted for it.`,
      );
      continue;
    }
    if (!SAFE_ID.test(id)) {
      warnings.push(`ads: ${provider} ${platform.tag.needs} "${id}" is not a valid ID. Skipped.`);
      continue;
    }

    const category: ConsentCategory = entry.category ?? 'marketing';
    tags.push({
      key: provider,
      provider: platform.name,
      category,
      // Every platform in the table sets cookies; the tag is gated whenever the
      // site has a gate. With no gate the tag still renders — and the warning
      // below says what that means, rather than silently declining to advertise.
      setsCookies: true,
      cookies: platform.tag.cookies,
      strategy,
      gated: ctx.consent === true,
      inline: platform.tag.bootstrap(id, { provider, ...entry }),
      src: platform.tag.src ? platform.tag.src(id) : null,
      attrs: {},
    });
  }

  if (tags.length === 0) return { tags, needsRuntime: false, warnings };

  if (ctx.consent !== true) {
    warnings.push(
      `ads: ${tags.map((t) => t.provider).join(', ')} ${tags.length === 1 ? 'sets' : 'set'} ` +
        'advertising cookies, and `consent` is off — so they load for every visitor with no way ' +
        'to decline. Set `consent: true`.',
    );
  } else {
    const missing = [...new Set(tags.map((t) => t.category))].filter(
      (c) => ctx.consentCategories && !ctx.consentCategories.includes(c),
    );
    if (missing.length)
      warnings.push(
        `ads: the tags demand the ${missing.join(', ')} consent categor${missing.length === 1 ? 'y' : 'ies'}, ` +
          `but the banner offers ${ctx.consentCategories?.join(', ') || 'nothing'}. Add ` +
          `${missing.join(', ')} to \`consent.categories\`, or the tags wait on a question the ` +
          'banner never asks.',
      );
  }

  return { tags, needsRuntime: true, warnings };
}
