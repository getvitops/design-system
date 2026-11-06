import * as z from '@zod/mini';
import { desc } from './desc.ts';
import { IndexingSchema } from './indexing.ts';

/** A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`). */
export const LocalizableSchema = desc(
  z.union([z.string(), z.record(z.string(), z.string())]),
  'A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).',
);

/**
 * A share image: a bare URL, or the URL with the metadata crawlers read alongside it.
 *
 * Distinct from a content image (`alt` is required there): a site-wide fallback card often has
 * no meaningful alt text, and `<Seo />` already omits `og:image:alt` when none is given.
 */
const SeoImageSchema = z.union([
  z.string(),
  z.strictObject({
    src: desc(z.string(), 'Absolute, or relative to `site` (resolved at render time).'),
    alt: z.optional(z.string()),
    width: z.optional(z.number()),
    height: z.optional(z.number()),
    type: desc(z.optional(z.string()), 'MIME type, e.g. `image/png`.'),
  }),
]);

/**
 * `site.seo` — the single source of site-level SEO defaults.
 *
 * Read by `<Seo />` (through `@getvitops/astro`'s `resolveSeoDefaults`), `vitops robots` and
 * `vitops search notify`. Every display field here is consumed by `resolveSeoDefaults`;
 * `seo-defaults.test.ts` fails when a field is added to this schema and not read, which is how
 * four fields once sat here doing nothing (ADR-0002).
 */
export const SeoSchema = z.strictObject({
  siteName: desc(
    z.optional(LocalizableSchema),
    '`og:site_name`, and the `<title>` when a page passes none. Defaults to `organization.name`, so most sites never state it.',
  ),
  titleTemplate: desc(
    z.optional(LocalizableSchema),
    'Page-title pattern; `%s` is the page title (e.g. "%s · Acme"). Applies to `<title>` only, never to `og:title`, and is skipped when the page title already equals the site name.',
  ),
  defaultTitle: desc(
    z.optional(LocalizableSchema),
    '`<title>` for pages that pass none. Used verbatim — the template is not applied. Defaults to the site name.',
  ),
  defaultDescription: desc(
    z.optional(LocalizableSchema),
    '`<meta name="description">` for pages that pass none.',
  ),
  robots: desc(
    z.optional(z.string()),
    'Site-wide robots directive (e.g. "index,follow" / "noindex,nofollow"). `site.environments.<env>.robots` wins over it.',
  ),
  googleSiteVerification: desc(
    z.optional(z.string()),
    'Google Search Console verification token (`<meta name="google-site-verification">`).',
  ),
  bingSiteVerification: desc(
    z.optional(z.string()),
    'Bing Webmaster Tools verification token (`<meta name="msvalidate.01">`).',
  ),
  openGraph: desc(
    z.optional(
      z.strictObject({
        type: desc(
          z.optional(z.enum(['website', 'article', 'profile'])),
          'Default `og:type`. Default `website`.',
        ),
        locale: desc(z.optional(z.string()), '`og:locale`. `en-CA` and `en_CA` both emit `en_CA`.'),
        localeAlternates: desc(
          z.optional(z.array(z.string())),
          'Other locales the same content exists in → `og:locale:alternate`.',
        ),
        image: desc(z.optional(SeoImageSchema), 'Fallback share image for pages that bring none.'),
      }),
    ),
    'Open Graph defaults. Per-page `<Seo />` props override them.',
  ),
  twitter: desc(
    z.optional(
      z.strictObject({
        card: desc(
          z.optional(z.enum(['summary', 'summary_large_image', 'app', 'player'])),
          'Card type when no image resolves (default `summary`).',
        ),
        site: desc(z.optional(z.string()), 'The site\'s own handle, e.g. "@acme".'),
        creator: desc(z.optional(z.string()), 'Default author handle, e.g. "@ada".'),
      }),
    ),
    'Twitter/X card defaults.',
  ),
  indexing: desc(
    z.optional(IndexingSchema),
    'How `vitops search notify` tells search engines about a deploy: which sitemap, IndexNow key, Search Console property, and which pages to verify afterwards.',
  ),
});

export type SeoConfig = z.infer<typeof SeoSchema>;
