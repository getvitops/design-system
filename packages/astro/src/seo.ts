/**
 * The `<Seo />` resolution layer — site-level defaults merged with per-page props
 * into the exact tags to emit.
 *
 * Kept separate from `Seo.astro` deliberately. The component this replaces
 * (`SEO.astro`, deleted in c949cae) fused resolution with markup, which is why it
 * was never unit-tested and why its title handling drifted: it computed a title
 * for `og:title` but left `<title>` to the layout, so the two could disagree.
 * Everything decidable lives here and is asserted in `seo.test.ts`; the component
 * only renders what this returns.
 */

/** Twitter card types, per <https://developer.x.com/en/docs/twitter-for-websites/cards>. */
export type SeoTwitterCard = 'summary' | 'summary_large_image' | 'app' | 'player';

/** Open Graph object types this component knows how to describe. */
export type SeoOgType = 'website' | 'article' | 'profile';

/**
 * Site-level SEO defaults, passed to `getvitops({ seo })` and baked into the
 * `virtual:getvitops/head` module. Per-page `<Seo />` props override these.
 *
 * The vocabulary mirrors the site-config schema's `seo` block
 * (`@getvitops/generator`, `src/site.ts`) so a `SiteConfig` → these adapter would
 * be a flat field map — but it is not imported from there. This is the
 * integration's own option surface, and it must stay JSON-serialisable: it is
 * `JSON.stringify`d into the virtual module, so no functions, no `URL`s, no dates.
 */
export interface GetvitopsSeoOptions {
  /** `og:site_name`, and the `<title>` when a page passes none. */
  siteName?: string;
  /**
   * Page-title pattern; `%s` is the page's own title. e.g. `'%s · Acme'`.
   *
   * Applies to `<title>` only. `og:title`/`twitter:title` get the untemplated
   * title: a social card already shows `og:site_name` and the domain, so the
   * suffix would sit directly above the brand it repeats. Override per page with
   * `ogTitle`.
   *
   * Skipped when a page's title already equals `siteName` — a homepage titled
   * "Acme" emits `Acme`, not `Acme · Acme` — and never applied to `defaultTitle`.
   */
  titleTemplate?: string;
  /** `<title>` for pages that pass none. Used verbatim — the template is not applied. */
  defaultTitle?: string;
  /** `<meta name="description">` for pages that pass none. */
  defaultDescription?: string;
  /** Site-wide robots directive, e.g. `'index,follow,max-image-preview:large'`. */
  robots?: string;
  /** Google Search Console verification token. */
  googleSiteVerification?: string;
  /** Bing Webmaster Tools verification token. */
  bingSiteVerification?: string;
  openGraph?: {
    /** Default `og:type` (default `'website'`). */
    type?: SeoOgType;
    /** `og:locale`. Written either way — `en-CA` and `en_CA` both emit `en_CA`. */
    locale?: string;
    /** Additional locales the same content exists in → `og:locale:alternate`. */
    localeAlternates?: string[];
    /** Fallback share image. Relative URLs resolve against `site`. */
    image?: { url: string; alt?: string; width?: number; height?: number; type?: string };
  };
  twitter?: {
    /** Card type when no image resolves (default `'summary'`). */
    card?: SeoTwitterCard;
    /** The site's own handle, `@acme`. */
    site?: string;
    /** Default author handle, `@ada`. */
    creator?: string;
  };
}

/** Per-page `<Seo />` props. Everything is optional; defaults fill the gaps. */
export interface SeoProps {
  /** Page title, before `titleTemplate` is applied. */
  title?: string;
  /**
   * `og:title`/`twitter:title`, when the social headline should differ from
   * `title`. Defaults to `title` **without** `titleTemplate` — see the note on
   * `titleTemplate` for why the suffix is dropped there.
   */
  ogTitle?: string;
  description?: string;
  /** Overrides the computed canonical. Relative values resolve against `site`. */
  canonical?: string;
  /** Overrides `og:site_name` and the title fallback. */
  siteName?: string;
  /** Share image for this page. Relative URLs resolve against `site`. */
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** MIME type of the share image, e.g. `'image/png'`. */
  imageType?: string;
  noindex?: boolean;
  nofollow?: boolean;
  noarchive?: boolean;
  nocache?: boolean;
  /** Extra robots directives, e.g. `'max-snippet:-1'`. Appended to the composed value. */
  robotsExtras?: string;
  /** Full robots override. Wins over the flags above and the site default. */
  robots?: string;
  /** `og:type` for this page (default: the site default, else `'website'`). */
  type?: SeoOgType;
  /** Emitted only when `type` is `'article'`. */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    expirationTime?: string;
    authors?: string[];
    section?: string;
    tags?: string[];
  };
  /** `og:locale` for this page. */
  locale?: string;
  /** Twitter author handle for this page, `@ada`. */
  twitterCreator?: string;
  /**
   * Translations of *this* page, as `<link rel="alternate" hreflang>`.
   *
   * Explicit only, and it must include the current page. Nothing is inferred:
   * the deleted component derived alternates from the site's locale list and
   * pointed every one of them at that locale's homepage, so every page on the
   * site claimed the homepage as its translation. Only the page knows its own
   * translated URLs. Pass `hreflang: 'x-default'` for the fallback entry.
   */
  alternates?: { hreflang: string; href: string }[];
}

/** A `<meta property>` tag (Open Graph uses `property`, not `name`). */
export interface SeoPropertyTag {
  property: string;
  content: string;
}

/** A `<meta name>` tag. */
export interface SeoNameTag {
  name: string;
  content: string;
}

/** Everything `<Seo />` renders, already decided. `null` means "emit nothing". */
export interface ResolvedSeo {
  title: string | null;
  /** `og:title`/`twitter:title` — the page title without `titleTemplate`. */
  socialTitle: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  openGraph: SeoPropertyTag[];
  twitter: SeoNameTag[];
  verification: SeoNameTag[];
  alternates: { hreflang: string; href: string }[];
}

/** Render context supplied by the component from `Astro`. */
export interface SeoContext {
  /**
   * The deployed origin — `Astro.site`, or `config.site` via the virtual module.
   *
   * `undefined` when neither is set, and then every absolute-URL tag is dropped
   * rather than being derived from the request. `astro-seo` falls back to
   * `Astro.url` here; on a static build that is `http://localhost:4321`, which
   * would bake a localhost canonical into production HTML.
   */
  site?: URL | undefined;
  /** `Astro.url.pathname` — already includes `base`. */
  pathname: string;
  /** `Astro.url.search`, if the canonical should keep the query string. */
  search?: string;
}

/** `en-CA` → `en_CA`; Open Graph wants the underscore form. */
const ogLocale = (locale: string) => locale.replace('-', '_');

/**
 * Absolute URLs pass through; relative ones resolve against `site`, or are
 * dropped when there is no `site` to resolve them against. A relative `og:image`
 * or canonical is worse than none — crawlers resolve it against whatever origin
 * served the page.
 */
function absolute(url: string | undefined, site: URL | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).href;
  } catch {
    return site ? new URL(url, site).href : null;
  }
}

/** Composes the robots directive, or null when nothing meaningful was asked for. */
function resolveRobots(props: SeoProps, defaults: GetvitopsSeoOptions): string | null {
  if (props.robots) return props.robots;
  const { noindex, nofollow, noarchive, nocache, robotsExtras } = props;
  if (noindex || nofollow || noarchive || nocache || robotsExtras) {
    return [
      noindex ? 'noindex' : 'index',
      nofollow ? 'nofollow' : 'follow',
      ...(noarchive ? ['noarchive'] : []),
      ...(nocache ? ['nocache'] : []),
      ...(robotsExtras ? [robotsExtras] : []),
    ].join(', ');
  }
  // No explicit default either: emit nothing. `index, follow` is what crawlers
  // already assume, so stating it adds bytes and no meaning.
  return defaults.robots ?? null;
}

/**
 * Merges site defaults with page props into the final tag set.
 *
 * Pure — no `Astro`, no filesystem, no config lookup. Everything it needs comes
 * through its three arguments, which is what makes it testable and what keeps the
 * package free of the consumer-global coupling that sank the previous site model.
 */
export function resolveSeo(
  defaults: GetvitopsSeoOptions,
  props: SeoProps,
  ctx: SeoContext,
): ResolvedSeo {
  const { site } = ctx;
  const siteName = props.siteName ?? defaults.siteName ?? null;

  // The template applies to a page's own title only, and only when that title
  // isn't already the site name. Two ways to get "Acme · Acme" otherwise: running
  // it over `defaultTitle`, and a homepage whose own title happens to equal the
  // site name — which is the common case, not an edge case.
  const templated = props.title && defaults.titleTemplate && props.title !== siteName;
  const fallbackTitle = defaults.defaultTitle ?? siteName;
  const title = props.title
    ? templated
      ? String(defaults.titleTemplate).replaceAll('%s', props.title)
      : props.title
    : fallbackTitle;

  /*
   * `og:title`/`twitter:title` take the page's title *without* the template.
   *
   * The two are read in different places. `<title>` is navigational — a browser
   * tab or a search result, competing with a dozen others, so it needs the brand
   * suffix to disambiguate. A social card is self-contained and already shows
   * `og:site_name` and the domain, so repeating the brand there is furniture:
   * "Installation · Acme" sitting directly above "Acme".
   *
   * They still derive from one value, which is the part that matters — the
   * component this replaces computed them in separate places and they drifted.
   * Pass `ogTitle` when a page wants a genuinely different social headline.
   */
  const socialTitle = props.ogTitle ?? props.title ?? fallbackTitle;

  const description = props.description ?? defaults.defaultDescription ?? null;

  const canonical = props.canonical
    ? absolute(props.canonical, site)
    : site
      ? new URL(ctx.pathname + (ctx.search ?? ''), site).href
      : null;

  const image = absolute(props.image, site) ?? absolute(defaults.openGraph?.image?.url, site);
  // Only inherit the default image's metadata when the page didn't bring its own
  // image — otherwise a page's image would carry the default's alt text.
  const usingDefaultImage = !props.image;
  const defaultImage = defaults.openGraph?.image;
  const imageAlt = props.imageAlt ?? (usingDefaultImage ? defaultImage?.alt : undefined);
  const imageWidth = props.imageWidth ?? (usingDefaultImage ? defaultImage?.width : undefined);
  const imageHeight = props.imageHeight ?? (usingDefaultImage ? defaultImage?.height : undefined);
  const imageType = props.imageType ?? (usingDefaultImage ? defaultImage?.type : undefined);

  const type = props.type ?? defaults.openGraph?.type ?? 'website';
  const locale = props.locale ?? defaults.openGraph?.locale;

  const openGraph: SeoPropertyTag[] = [];
  const og = (property: string, content: string | number | null | undefined) => {
    if (content !== null && content !== undefined && content !== '')
      openGraph.push({ property, content: String(content) });
  };

  og('og:type', type);
  og('og:title', socialTitle);
  og('og:description', description);
  og('og:url', canonical);
  og('og:site_name', siteName);
  og('og:locale', locale ? ogLocale(locale) : null);
  for (const alt of defaults.openGraph?.localeAlternates ?? [])
    og('og:locale:alternate', ogLocale(alt));
  og('og:image', image);
  if (image) {
    og('og:image:alt', imageAlt);
    og('og:image:width', imageWidth);
    og('og:image:height', imageHeight);
    og('og:image:type', imageType);
  }
  if (type === 'article' && props.article) {
    const a = props.article;
    og('article:published_time', a.publishedTime);
    og('article:modified_time', a.modifiedTime);
    og('article:expiration_time', a.expirationTime);
    for (const author of a.authors ?? []) og('article:author', author);
    og('article:section', a.section);
    for (const tag of a.tags ?? []) og('article:tag', tag);
  }

  const twitter: SeoNameTag[] = [];
  const tw = (name: string, content: string | null | undefined) => {
    if (content) twitter.push({ name, content });
  };
  // A card with a large image is only honoured if there *is* an image.
  tw('twitter:card', image ? 'summary_large_image' : (defaults.twitter?.card ?? 'summary'));
  tw('twitter:site', defaults.twitter?.site);
  tw('twitter:creator', props.twitterCreator ?? defaults.twitter?.creator);
  tw('twitter:title', socialTitle);
  tw('twitter:description', description);
  tw('twitter:image', image);
  tw('twitter:image:alt', image ? imageAlt : null);

  const verification: SeoNameTag[] = [];
  if (defaults.googleSiteVerification)
    verification.push({
      name: 'google-site-verification',
      content: defaults.googleSiteVerification,
    });
  if (defaults.bingSiteVerification)
    verification.push({ name: 'msvalidate.01', content: defaults.bingSiteVerification });

  return {
    title,
    socialTitle,
    description,
    canonical,
    robots: resolveRobots(props, defaults),
    openGraph,
    twitter,
    verification,
    alternates: props.alternates ?? [],
  };
}
