---
'@getvitops/astro': minor
---

`<Seo />`: `titleTemplate` now applies to `<title>` only — `og:title` and `twitter:title` get the
untemplated page title.

A social card is self-contained and already shows `og:site_name` and the domain, so the templated
value put the brand on screen twice: `og:title="Installation · Acme"` sitting directly above
`og:site_name="Acme"`. `<title>` keeps the suffix, because a browser tab or a search result has
nothing else to disambiguate it.

```html
<!-- before -->
<title>Installation · Acme</title>
<meta property="og:title" content="Installation · Acme" />
<meta property="og:site_name" content="Acme" />

<!-- after -->
<title>Installation · Acme</title>
<meta property="og:title" content="Installation" />
<meta property="og:site_name" content="Acme" />
```

Adds an `ogTitle` prop for pages that want a genuinely different social headline, and exposes the
resolved value as `socialTitle` on `resolveSeo()`'s return. Nothing changes for sites that don't set
`titleTemplate` — the two values are identical there.
