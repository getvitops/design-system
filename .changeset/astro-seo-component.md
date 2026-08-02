---
'@getvitops/astro': minor
---

Add `<Seo />` — page metadata for non-EmDash sites: `<title>`, description, canonical, Open Graph,
Twitter cards, robots, `article:*`, `hreflang` and verification tokens.

Site-level defaults go in the integration; pages pass only what differs.

```js
// astro.config.mjs
vitops({
  seo: {
    siteName: 'Acme',
    titleTemplate: '%s · Acme',
    defaultDescription: 'We make the thing.',
    openGraph: {
      locale: 'en_CA',
      image: { url: '/og.png', alt: 'Acme', width: 1200, height: 630 },
    },
    twitter: { site: '@acme' },
  },
});
```

```astro
---
import Seo from '@getvitops/astro/Seo.astro';
---
<Seo title={title} description={description} image={cover} />
```

**`<Seo />` owns `<title>` and `<meta name="description">` — remove them from your layout when you
adopt it.** It already computes the resolved title for `og:title`/`twitter:title`, and emitting those
in one place while the layout emits `<title>` in another is how the two drift apart. `<Head />` is
unaffected and still handles favicons, theme-color and the web-component runtime; use both.

Notable behaviour:

- `titleTemplate` is skipped when a page's title already equals `siteName`, so a homepage titled
  "Acme" emits `Acme` rather than `Acme · Acme`. It never applies to `defaultTitle`.
- Canonical, `og:url` and relative `og:image` values need the `site` astro.config option. Without it
  they're omitted rather than derived from the request URL — a canonical built from a dev or preview
  origin can de-index you — and the integration warns at build time. Absolute image URLs still work.
- `robots` is omitted unless it says something; `index, follow` is what crawlers already assume. Use
  `noindex`/`nofollow`/`noarchive`/`nocache`/`robotsExtras` per page, `robots` for a full override, or
  `seo.robots` site-wide.
- `twitter:card` upgrades to `summary_large_image` whenever an image resolves.
- `hreflang` alternates are explicit only — pass `alternates`, including the current page. Nothing is
  inferred from a locale list.
- No JSON-LD. The `./schemas/*` components take entity data and compose alongside it.

**On an EmDash site use `<EmDashHead>` instead** — it emits the same tags from the CMS, and rendering
both duplicates every one of them. The integration warns if `seo` is configured alongside `emdash()`.

The merge logic ships as the pure `resolveSeo(defaults, props, ctx)` if you need to drive it yourself.
