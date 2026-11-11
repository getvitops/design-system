# @getvitops/config

## 8.3.0-alpha.5

### Minor Changes

- bb61a35: **Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

  - **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
  - **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
  - The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
  - `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
  - `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
  - `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

  `@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.

- 4d94c8b: **Added: `site.chrome` — a configurable masthead and nav behaviour.** Non-breaking.

  - `site.chrome.masthead` (new `@getvitops/config` schema): `position` (`static|sticky|fixed`), `behavior` (`always|hide-on-scroll`), `surface` (`solid|glass|transparent|transparent-until-scrolled`), `tone` (a `colors.roles` key), `layout` (`full|inset|floating`), `width`, `elevation` (`shadow`, `border`, `onScroll`), `height` and `inset`. `height` and `inset` take fluid lengths (`calc()`, `clamp()`, `min()`, `max()`, with `cqi`/`vw`/… units), checked against a closed grammar because they are written into CSS. `validateConfig` rejects a `tone` or `shadow` the design system does not define (only when the default theme states them directly, not via `extends`).
  - `site.chrome.nav`: `compact` (`drawer|dropdown`), `drawerSide`, `breakpoint`/`mobileBreakpoint`/`megaBreakpoint`, `depth`, `megaDepth`.
  - `<Masthead config={site}>` (`@getvitops/astro`, slots `brand`/default/`actions`) and `resolveMasthead()` / `resolveNavOptions()`. A prop overrides one field per layout. The key is `chrome`/`masthead` on purpose: `<header>` is valid in any section and `banner` already means the announcement bar and the landmark role.
  - `<SiteNav>` gains `compact="dropdown"` (a columnar panel anchored under the toggle), `drawerSide` (previously hardcoded to the end edge in Astro), `megaDepth` and `megaPanel`. `.sitenav--mega` now styles second-level items as column headings and has an optional featured column.
  - `@getvitops/emdash`: `VitopsMegaPanel` fills that column from the widget area `mega-<item url slug>` (or a `mega-area:<name>` class on the menu item). No area means no column.
  - `@getvitops/create` (emdash template): the layout renders through `<Masthead>`; `site.json` ships a sticky glass masthead with a shadow once scrolled. The hand-written `.navbar { block-size: 64px }` is gone (use `masthead.height`).
  - CSS (`patterns/masthead.css`, `patterns/sitenav.css`): **all formats**, including tailwind, where the patterns are inlined into `@layer components`. Hide-on-scroll and the `*-on-scroll` states are `scroll-state()` container queries that only subtract from a settled (solid, elevated, visible) bar, so a browser without them (Firefox today) shows that bar rather than a transparent one. A sticky or fixed masthead sets `--header-offset` / `--top-offset` so anchors land below it.
  - `@getvitops/generator`: new `TIERS.masthead`; `TIERS.sitenav` documents the new props.

### Patch Changes

- 785b8b3: Docs only: the `site.ads.google.conversionLabel` field descriptions and `vitops ads` now state which Google Ads category each conversion action needs (`call` → Phone call lead, `email` → Contact, `form` → Submit lead form). The category is set on the action in Google Ads, not by the tag, so a wrong one reports under the wrong goal with no code-side signal. `vitopsFormConversion()`'s docblock also warns against firing a form conversion from a success-page query parameter. No behaviour change.

## 8.3.0-alpha.4

## 8.3.0-alpha.3

## 8.3.0-alpha.2

## 8.3.0-alpha.1

## 8.3.0-alpha.0

## 8.2.0

### Minor Changes

- 89265af: **New package: `@getvitops/config`** — the site-config provider blocks (`site.crm`, `site.ads`,
  `site.reviews`, `site.seo.indexing`, `site.searchConsole`, `site.notifications`, `site.tracking`,
  `site.security`, `site.deployment`) as zod schemas and inferred types, with the closed provider lists
  (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`) on a zod-free `./providers` entry. It joins the
  `fixed` group.

  Why: `@getvitops/utils` holds the provider code but could not import its configuration types — the schema
  lived in `@getvitops/generator`, a layer above — so it kept a hand-copied mirror beside each module,
  an adapter converting into it, and a test holding the copy to the schema. The mirrors are gone.

  - **`@getvitops/generator`**: `AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`, `AdProvider` and
    `CrmProviderConfig` are re-exported unchanged. No import path changes.
  - **`@getvitops/utils`**: the config types in `./crm`, `./ads`, `./indexing`, `./onboarding`, `./reviews`,
    `./tracking` and `./notify` (`CrmConfig`, `HubSpotConfig`, `BiginConfig`, `JobberConfig`,
    `IndexNowConfig`, `SearchConsoleConfig`, `ReviewsConfig`, `ReviewLocationConfig`, `TrackingConfig`,
    `NotificationsConfig`, `EmailChannelConfig`, `DomainSetup`, `AdPropertySetup`) are now inferred from the
    schema. Same names, same fields, but **optional fields now follow zod's inference**, so a hand-written
    object literal typed against them may need `| undefined` handled. `AdPropertySetup` gains the fields the
    schema always had (`conversionActionId`, `reporting`).
  - **`@getvitops/astro`**: `GetvitopsAdProperty` and `GetvitopsTrackingOptions` are aliases of the schema
    types. `toCrmConfig()` and `toGoogleAdsConfig()` are **deprecated** — they returned their argument's
    field unchanged; pass `config.site.crm` / `config.site.ads?.google` directly.
  - **`@getvitops/cli`**: `vitops ads` now passes `conversionActionId` and `reporting` through to the planner;
    it previously copied a hand-picked subset of the block and dropped them.

  Formats reached: none — no CSS change.

- 7fd5f8f: **`site.seo` is now the single source of site-level SEO defaults** (ADR-0002). Until now `site.seo`
  declared `titleTemplate`, verification tokens, `openGraph` and `twitter` that nothing read, while
  `<Seo />` took a second, differently-shaped vocabulary through `vitops({ seo })` that no other stack
  could see.

  - `SeoSchema` moves to `@getvitops/config` and gains what only the integration had: `siteName`,
    `defaultTitle`, `defaultDescription`, `openGraph.localeAlternates` and `openGraph.image` as
    `{ src, alt, width, height, type }`. Text fields are localisable.
  - `@getvitops/astro` exports `resolveSeoDefaults(config, { locale, env })`. The integration reads
    `site.seo` from the site config it already loads; `siteName` falls back to `organization.name`, and
    the environment's `robots` wins over `site.seo.robots`, the same fact `vitops robots` and
    `search notify` read.
  - `vitops({ seo })` keeps working unchanged and is now an **override** merged over the config, field by
    field (`openGraph` and `twitter` merge key by key).
  - **Removed from the config schema** (nothing read them): `descriptionTemplate` → use
    `defaultDescription`; `openGraph.siteName`/`title`/`description` and
    `twitter.title`/`description`/`image` → set per page on `<Seo />`, or the site-wide values above.
    A config that still carries one now fails `vitops validate` with an unrecognised-key error.
  - `openGraph.type` is now `website | article | profile`.
