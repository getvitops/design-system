---
title: "@getvitops/astro"
description: "Astro integration — CSS generation, favicons/PWA, web-component bundles, <Head />."
section: "Packages"
order: 20
---

```sh
npm i -D @getvitops/astro
```


Astro integration for the Vitops design system. Generates your design-system CSS at build time,
copies the web-component bundles into `public/`, generates favicons + a PWA manifest, and gives you
a `<Head />` component that wires it all into the page.

Requires Astro >= 7 (and `astro-icon` >= 1).

```sh
npm i -D @getvitops/astro
```

## Setup

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vitops from '@getvitops/astro';

export default defineConfig({
  integrations: [
    vitops({
      css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' },
      favicon: { source: 'src/assets/logo.svg', name: 'My Site', themeColor: '#0b0b0c' },
    }),
  ],
});
```

`css.input` takes a `design-system.json` **or** the larger site config that embeds one (`company.json`) — told apart by shape. A site config also feeds `site`, `legal` and `fonts`, so those need no path of their own. `css.theme` picks a `designSystem.themes` entry other than the default.

```astro
---
// src/layouts/Base.astro
import Head from '@getvitops/astro/Head.astro';
---

<html lang="en">
  <head>
    <Head />
  </head>
  <body><slot /></body>
</html>
```

`<Head />` emits the favicon/PWA tags and the web-component runtime scripts in the correct order and
priority. It does **not** emit a stylesheet `<link>` — the integration imports the generated CSS into
Astro's module graph and Astro emits that link itself.

## Options

| option          | default              | does                                                              |
| --------------- | -------------------- | ----------------------------------------------------------------- |
| `css`           | off unless given     | generate + auto-inject the design-system CSS                      |
| `css.input`     | `design-system.json` | source config                                                     |
| `css.format`    | `tailwind`           | `tailwind` \| `css` \| `bricks`                                   |
| `css.out`       | `src/styles`         | directory the generated CSS is written to                         |
| `css.inject`    | `true`               | inject the stylesheet into every SSR page                         |
| `webComponents` | `true`               | copy + link the web-component bundles                             |
| `favicon`       | off unless given     | `source`, `lowResSource`, `name`, `themeColor`, `backgroundColor` |
| `sitemap`       | off unless given     | generate `sitemap-index.xml` via `@astrojs/sitemap`               |
| `seo`           | off unless given     | site-level defaults for `<Seo />`                                 |
| `analytics`     | off unless given     | providers for `<Analytics />` (GA4, Clarity, Matomo, Plausible)   |
| `consent`       | off unless given     | the consent gate + `<CookieConsent />`                            |
| `media`         | off unless given     | encode `raw/` video into WebM + MP4 + poster (needs `ffmpeg`)     |

Set `css.inject: false` when another integration adds routes that must not inherit the design system
(e.g. EmDash's `/_emdash/admin`) — then import the generated file (`<out>/tailwind.css` or
`<out>/styles.css`) from your own layout, so only your pages are styled.

## Sitemap

`sitemap: true` registers the official [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
and links the result from `<Head />`. Pass an object to configure it (`filter`, `customPages`,
`changefreq`, `priority`, `i18n`, `entryLimit`, `filenameBase`, `serialize`, …):

```js
vitops({ sitemap: { filter: (page) => !page.includes('/draft/') } });
```

Three things to know:

- **It's an optional peer — install it yourself:** `pnpm add -D @astrojs/sitemap`. Without it the
  build fails with a message telling you so, rather than silently emitting nothing.
- **It needs the `site` astro.config option**, since a sitemap lists absolute URLs. Without it the
  option warns and skips.
- **It lists prerendered routes only.** On an `output: 'server'` site, mark the pages you want
  indexed with `export const prerender = true`, or list them in `sitemap.customPages`.

**On an EmDash site, leave it off.** EmDash serves its own `/sitemap.xml` from the database, which
also covers on-demand pages a static sitemap can't; the option detects `emdash()` and skips with a
warning. The two write different filenames and so don't actually collide — if you want both (DB
content _and_ hand-authored `.astro` pages), add `sitemap()` to your own `integrations` array.
vitops detects that too and leaves yours in charge, which is also how you reach the handful of
`@astrojs/sitemap` options this integration doesn't mirror.

### Real `<lastmod>` dates

A sitemap without `<lastmod>` tells a crawler a page exists but never that it changed. `gitLastmod()`
stamps each entry from its source file's last commit:

```js
import vitops, { gitLastmod } from '@getvitops/astro';

export default defineConfig({
  site: 'https://acme.ca',
  integrations: [vitops({ sitemap: { serialize: await gitLastmod() } })],
});
```

It maps file-based routes exactly (`src/pages/about.astro` → `/about`) and content entries by unique
slug. Three deliberate refusals, all the same kind — **no date beats a wrong one**, because Google
weighs `lastmod` only while it stays consistent with what actually changed:

- **Dynamic routes get nothing.** One `[slug].astro` backs many URLs; its commit date describes the
  template, not any page.
- **An ambiguous slug gets nothing** rather than a coin flip presented as a fact.
- **A shallow clone gets nothing, loudly.** It shells out to `git`, so `fetch-depth: 1` (the
  actions/checkout default) yields no history — it warns and emits no dates. Set `fetch-depth: 0`.

This is also what lets [`vitops indexing`](/packages/cli/) submit only what changed, rather than
everything on every deploy.

## Video (`media`)

Encode raw video into web-ready outputs in the same pass that generates your CSS:

```js
vitops({
  css: { input: 'design-system.json' },
  media: { raw: 'raw', out: 'src/assets/processed' },
});
```

Each source in `raw/` becomes a **VP9/WebM**, an **H.264/MP4** fallback and a **JPG poster**, so you
can import them like any other asset and let the bundler content-hash them. Runs are cached on
source content plus encode settings, and `ffmpeg` must be installed — it's an external tool, not an
npm dependency. Full behaviour, flags and the caching contract: [`vitops media`](/packages/cli/).

## `<Seo />`

Page metadata: `<title>`, description, canonical, Open Graph, Twitter cards, robots, `article:*`,
`hreflang`, verification tokens. Site-level defaults go in the integration; pages pass what differs.

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
import Head from '@getvitops/astro/Head.astro';
import Seo from '@getvitops/astro/Seo.astro';
---
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <Seo title={title} description={description} image={cover} />
  <Head />
</head>
```

**It owns `<title>` and `<meta name="description">` — delete yours when you adopt it.** That isn't
tidiness: it already computes the resolved title for `og:title`/`twitter:title`, and splitting the
two is how they drift out of sync. `<Head />` is orthogonal (favicons, theme-color, the
web-component runtime); use both.

Behaviour worth knowing:

- **`titleTemplate` applies to `<title>` only.** `og:title`/`twitter:title` get the _untemplated_
  title, because a social card already shows `og:site_name` and the domain — "Pricing · Acme" would
  sit directly above "Acme". Pass `ogTitle` for a different social headline. The template is also
  skipped when a page's title already equals `siteName`, so a homepage titled "Acme" emits `Acme`,
  not `Acme · Acme`, and it never applies to `defaultTitle`.
- **Canonical needs the `site` astro.config option.** Without it, canonical, `og:url` and any
  _relative_ `og:image` are omitted rather than derived from the request — a canonical built from a
  dev or preview origin can de-index you. The integration warns at build time. Absolute image URLs
  still work.
- **`base` is handled for you.** `Astro.url.pathname` already includes it; don't prepend it yourself.
  Under the default `trailingSlash: 'ignore'` dev and build can disagree on the trailing slash, so
  pin `'always'` or `'never'` if you need a byte-stable canonical.
- **`robots` is omitted unless it says something.** `index, follow` is what crawlers already assume.
  Set `noindex`/`nofollow`/`noarchive`/`nocache`/`robotsExtras` per page, `robots` for a full
  override, or `seo.robots` for a site-wide default.
- **`twitter:card`** becomes `summary_large_image` whenever an image resolves.
- **`hreflang` alternates are explicit only.** Pass `alternates={[{ hreflang, href }, …]}` including
  the current page; nothing is inferred from a locale list, because only the page knows where its own
  translations live.
- **No JSON-LD.** The structured-data components in `./schemas/` take _entity_ data, `<Seo />` takes
  _page_ data. Compose them: `<Seo … />` then `<Organization {...org} />`.

**On an EmDash site, use `<EmDashHead>` instead** — it emits the same tags from the CMS. Rendering
both duplicates every one of them; the integration warns if you configure `seo` alongside `emdash()`.

The merge logic is a pure function, exported as `resolveSeo(defaults, props, ctx)` if you need to
drive it yourself.

## Analytics

`<Analytics />` emits the tags for the providers you configure. Nothing touches the critical path,
and anything that sets cookies waits for consent.

```js
// astro.config.mjs
vitops({
  analytics: {
    googleAnalytics: 'G-XXXXXXXXXX',
    clarity: 'abcd1234',
    matomo: { url: 'https://stats.acme.com', siteId: '1' },
    plausible: 'acme.com',
    strategy: 'idle',
  },
  consent: { policyUrl: '/legal/cookies' },
});
```

```astro
---
import Analytics from '@getvitops/astro/Analytics.astro';
import CookieConsent from '@getvitops/astro/CookieConsent.astro';
---
<head>
  <Head />
  <Analytics />
</head>
<body>
  <slot />
  <CookieConsent />
</body>
```

| provider               | sets cookies | consent category | notes                                                                            |
| ---------------------- | ------------ | ---------------- | -------------------------------------------------------------------------------- |
| **Google Analytics** 4 | yes          | `analytics`      | `_ga`, `_ga_*`, `_gid`. `category: 'marketing'` if the property feeds Ads        |
| **Microsoft Clarity**  | yes          | `analytics`      | session replay + heatmaps; `_clck`, `_clsk`, `MUID`                              |
| **Matomo**             | **no**       | `necessary`      | `disableCookies` by default; `cookies: true` opts in and moves it to `analytics` |
| **Plausible**          | no           | `necessary`      | cookieless, ~1 KB                                                                |

**The category is derived, not declared.** It follows from whether the provider sets cookies, which
follows from that provider's own configuration. You can't mark Google Analytics `necessary` to skip
the banner — but you _can_ pick a genuinely cookieless provider and be done with it, which is the
choice the table is trying to make legible.

### Loading

`strategy` decides when a tag runs. The default keeps analytics off the critical path entirely:

| `strategy`       | loads                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `idle` (default) | after `load`, on an idle callback (3s timeout)                   |
| `async`          | immediately, with the vendor's own `async` semantics             |
| `interaction`    | on first pointer/key/scroll, or after 8s — whichever comes first |

`interaction` is the cheapest and the least accurate: a visitor who reads and leaves is counted only
by the 8s fallback. No `preconnect` is emitted for any of them — warming a third-party connection
during parse is exactly the cost `idle` exists to avoid.

### How consent actually blocks a tag

Gated tags render as `<script type="text/plain">` with the URL on `data-src`. The browser never parses
the body and never fetches the library, so an undecided or declining visitor's page issues **no
third-party request at all**. Consent implemented by asking a tracker not to track is a promise; this
is a fact about the document.

For Google Analytics that means **basic consent mode, not advanced**: nothing reaches Google until the
visitor accepts, rather than loading immediately with signals denied to send cookieless pings. Fewer
modelled conversions, nothing to defend. Clarity is gated the same way and additionally receives
`clarity('consentv2', …)`, because Microsoft enforces the signal separately for EEA/UK/CH traffic.

## Cookie consent

`consent: true` ships `@getvitops/core/consent` — a 2.3 KB gzipped, Lit-free bundle — and enables
`<CookieConsent />`.

**It is not an analytics feature.** The gate is general: mark anything `data-consent="<category>"`
and it waits on the same choice.

```html
<script type="text/plain" data-vitops-tag data-consent="marketing" data-src="https://…"></script>
<iframe data-consent="marketing" data-consent-src="https://www.youtube.com/embed/…"></iframe>
```

Categories are `necessary` (always granted), `analytics`, `marketing`, `preferences`. The banner
offers only the ones something is actually waiting on.

Anything else — A/B assignment, account personalisation, your own scripts — uses `window.vitopsConsent`:

```js
window.vitopsConsent.subscribe((state) => {
  if (window.vitopsConsent.granted('preferences')) restoreSavedLayout();
});
```

`get()` · `granted(category)` · `needed()` · `set({ analytics: true })` · `acceptAll()` ·
`rejectAll()` · `reset()` · `open()` · `subscribe(fn)`. A `vitops:consent` event fires on `document`
at startup and on every change. Anything with `[data-consent-open]` reopens the banner, so a footer
"Cookie settings" link needs no JS of its own.

Behaviour worth knowing:

- **Nothing is stored until the visitor chooses.** No cookie, no localStorage. Showing the banner
  can't be the thing that needs consent. An unreadable or wrong-version cookie re-prompts rather than
  being read permissively.
- **Revoking clears cookies and reloads.** An already-executing tracker can't be unloaded any other
  way. `<CookieConsent noReloadOnRevoke />` turns the reload off, at the cost of that tracker running
  until the next navigation.
- **Rejecting is a decision** — the banner stays gone, it doesn't keep asking until told yes.
- **No geo detection.** The banner shows for everyone once enabled. Suppressing it from a timezone or
  an IP guess fails toward _not asking_, which is the expensive direction to be wrong in.
- **With no JS, nothing happens and that's correct** — the gate never runs, so no gated tag loads and
  no non-essential cookie is set. The banner stays hidden because there is nothing to consent to.
- **`<Analytics />` alone still uses the runtime** for scheduling, unless every provider is cookieless
  _and_ `strategy: 'async'` — the one configuration that ships no consent JavaScript at all.

### Keep it in step with your cookie notice

`vitops legal` derives the privacy policy and cookie notice from your **site config**, and
`vitops({ analytics })` is a separate surface. Declare each provider in both:

```jsonc
// site config — what the documents disclose
{ "analytics": { "googleAnalyticsId": "G-XXXXXXXXXX", "clarityId": "abcd1234" } }
```

Configure `legal` alongside `analytics` and the integration checks this for you, naming any provider
you'd otherwise be running without disclosing. It also warns when a cookie-setting provider is
configured with no `consent` gate.

## Components

Thin authoring helpers that emit the framework's HTML/CSS patterns — **none require runtime JS**:

```astro
import Subgrid from '@getvitops/astro/components/Subgrid.astro';
import Cards from '@getvitops/astro/components/Cards.astro';
import NodeRenderer from '@getvitops/astro/components/NodeRenderer.astro';
import Popover from '@getvitops/astro/components/Popover.astro';
import Details from '@getvitops/astro/components/Details.astro';
import Drawer from '@getvitops/astro/components/Drawer.astro';
import WebComponentLoader from '@getvitops/astro/components/WebComponentLoader.astro';
```

They emit framework classes only — never a Tailwind utility — so they render the same under
`css.format: 'tailwind'`, `'css'` and `'bricks'`, and need no Tailwind installed.

### `Subgrid` / `Cards`

`Subgrid` re-emits each slotted child as an `<li>` of a `.subgrid` grid, carrying the child's own
`class` and `style` across; `Cards` does the same with `card` added to every item. Each item spans
`--subgrid-row-span` row tracks and re-declares them as `subgrid`, so the tranches inside every
card — head, body, footer — land on the same row lines regardless of content length.

```astro
<Cards class="plans">
  <article><h3>Basics</h3><p>…</p><a class="cta" href="#">Start</a></article>
  <article><h3>Managed</h3><p>…</p><a class="cta" href="#">Start</a></article>
</Cards>

<style>
  .plans {
    --subgrid-cols: 2;      /* columns */
    --subgrid-row-span: 3;  /* tranches per card: head, body, CTA */
    --subgrid-gap: 1.5rem;  /* grid gap: between columns, and between tranches */
    --subgrid-row-gap: 2rem; /* extra space between wrapped rows of cards */
  }
  @media (width < 48rem) { .plans { --subgrid-cols: 1; } }
</style>
```

Set the custom properties from your own CSS rather than inline, so media-query overrides win.
Sizing and gaps stay yours: the pattern only sets the grid gap from `--subgrid-gap`.

`--subgrid-row-gap` exists because the grid's row gap is the gap between an item's *tranches*, so
it cannot also be the gap between *rows of items*; it's applied with `sibling-index()`, and where
that isn't supported (currently everything but Chromium) wrapped rows simply fall back to the grid
gap. `--num-items` is set on the `<ul>` for nth-child-style maths.
