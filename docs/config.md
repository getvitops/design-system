---
type: "Config Reference"
title: "Vitops — config authoring reference"
description: "Every field of the three-section config (designSystem / organization / site), generated from the published JSON Schema so it always matches validation."
resource: "site.json"
tags: [config, schema, authoring, site, organization]
generator: "@getvitops/generator"
---

# Config authoring reference

The document that describes a **whole project**: the token set, the company, and the
published site. It is the input every command that needs more than tokens is anchored
to — `vitops legal`, `vitops icons`, `vitops indexing` — and it can also stand in for
a `design-system.json` anywhere the toolchain takes one, since it carries a full
`designSystem`.

Consumers name the file whatever suits them (`site.json`, `company.json`,
`vitops.config.json`); it is recognised by **shape**, not by name — a document with a
top-level `designSystem` key is this, and one without it is a bare
`design-system.json`.

- Set `"$schema": "https://unpkg.com/@getvitops/generator/config.schema.json"` in the config for editor autocomplete + validation.
- Check one with `vitops validate`.

## The three sections

| Section | Holds | Changes when |
| --- | --- | --- |
| `designSystem` | the token set — named themes, which theme, which appearance | the brand's design changes |
| `organization` | the company — name, contact, locations, services, profiles | the company changes |
| `site` | this published site — locales, domains, environments, SEO, analytics, legal, icons, deployment | this site changes |

The split is what makes the multi-site case expressible: several sites can carry the
same `organization` and differ only in `site`. It is also what the generated legal
documents rely on — a privacy policy asserts facts about the *company* (who to contact,
where it is) and facts about the *site* (which forms exist, which analytics run), and
those two are separately true.

**Fields are described where they are, not where they were.** If you are migrating a
pre-3.0 flat config, `vitops validate` names every move rather than reporting a dozen
unknown keys.

## `designSystem`

The design system: named themes plus the system-wide facts (which theme, which appearance). A bare design system, or a bare theme map, is accepted as shorthand for `{ themes: … }`.

The token set. Its `themes.<name>` entries are full design systems — every field of
one is in [authoring.md](authoring.md). Only the wrapper is listed here.

### `themes`

Named themes. `default` is the base; others may `extends` another and supply a partial patch. Light/dark is NOT a theme — the functional tokens flip per appearance within each one, so `default` already has both. Only the default theme is built today; multi-theme output and a picker are not wired yet.

- `<name>` (object)
  - `$schema` (string) — URL of the published JSON Schema (stamped by `vitops init`) so editors provide autocomplete + validation.
  - `meta` (object) — Brand identity for agent-facing output. Consumed only by the `design` format (`DESIGN.md`); it emits no CSS and no tokens.
    - `name` (string) — Brand/system name. Used as the `name` field and `<h1>` of the `design` format's `DESIGN.md`. Defaults to "Design System".
    - `description` (string) — One or two sentences on the brand personality and the feeling the UI should evoke — what an agent needs when no token answers the question. Becomes the DESIGN.md `description` field and opens its Overview section; if omitted, a generic description of the system's mechanics is used instead.
  - `colors` (object)
    - `palette` (map)
      - `<name>` (one of) — A palette hue, authored one of two ways: `{ seed, anchors? }` generates an 11-step numeric OKLCH scale (50…950) from the seed, or `{ tones }` supplies a fixed brand kit used verbatim.
    - `roles` (map)
      - `<name>` (one of)
    - `utilities` (array of bg | text | icon | border | outline | fill | stroke)
  - `shadows` (map) — Named shadows → `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Values are shadow parameter lists (offset/blur/colour). Each token feeds two consumers with different grammars — `box-shadow` (pattern geometry, via the `--ds-*` group aliases) and `filter: drop-shadow(…)` (the utilities and the `shadow:` state shortcut) — so values must stay in the intersection: **one layer, no spread radius, no `inset`**. `drop-shadow()` rejects all three, and rejecting them invalidates the whole filter, so the shadow vanishes rather than degrading.
  - `fonts` (map) — Raw font stacks by name, emitted as `--font-<name>` tokens (referenced by `typography.families`). **Stacks only — vitops does not load webfonts.** A value here is a `font-family` list and nothing more: it emits no `@font-face`, no preload, and no metrics-matched fallback. If a family needs loading, declare it in Astro's `fonts:` config (`astro.config`, or the site config's `fonts` array) and point the token at the family's `cssVariable` — `"display": "var(--font-league-spartan), sans-serif"`. Installing a `@fontsource*` package and importing its CSS also works but gives up subsetting, preload and `size-adjust`/`ascent-override` fallbacks, so it regresses CLS.
  - `typeScale` (object) — Fluid modular TYPE scale → `--text-<name>` tokens, consumed by typography roles and text-size utilities.
    - `base` (string, required) — Anchor size (a CSS length, e.g. "1rem") — the value at `baseStep`.
    - `ratio` (number, required) — Modular ratio between adjacent steps at large viewports.
    - `steps` (number) — Token count when `names` is absent (steps are then named 1..steps).
    - `names` (array of string) — Step names, smallest → largest (e.g. ["xs","sm","md",…]); each becomes a token suffix.
    - `baseStep` (number) — 1-based index of the step whose value is `base`.
    - `baseline` (string) — Named step used as the fluid pivot / GUI scale centre (defaults to `baseStep`).
    - `fluid` (object) — Makes the scale fluid: each step compiles to a clamp() that interpolates from `minRatio` at `minVw` to `ratio` at `maxVw`.
      - `minVw` (string, required) — Viewport width (CSS length) where fluid scaling bottoms out.
      - `maxVw` (string, required) — Viewport width (CSS length) where fluid scaling tops out.
      - `minRatio` (number, required) — Modular ratio at/below `minVw` (usually < `ratio`).
  - `spaceScale` (object) — Fluid modular SPACE scale → `--space-<name>` tokens, consumed by spacing/gap utilities and vertical rhythm.
    - `base` (string, required) — Anchor size (a CSS length, e.g. "1rem") — the value at `baseStep`.
    - `ratio` (number, required) — Modular ratio between adjacent steps at large viewports.
    - `steps` (number) — Token count when `names` is absent (steps are then named 1..steps).
    - `names` (array of string) — Step names, smallest → largest (e.g. ["xs","sm","md",…]); each becomes a token suffix.
    - `baseStep` (number) — 1-based index of the step whose value is `base`.
    - `baseline` (string) — Named step used as the fluid pivot / GUI scale centre (defaults to `baseStep`).
    - `fluid` (object) — Makes the scale fluid: each step compiles to a clamp() that interpolates from `minRatio` at `minVw` to `ratio` at `maxVw`.
      - `minVw` (string, required) — Viewport width (CSS length) where fluid scaling bottoms out.
      - `maxVw` (string, required) — Viewport width (CSS length) where fluid scaling tops out.
      - `minRatio` (number, required) — Modular ratio at/below `minVw` (usually < `ratio`).
  - `patterns` (object) — Component patterns and their token cascade: `defaults` → `groups` → per-pattern `overrides`, plus shape (`radii`) and z-index primitives.
    - `defaults` (map) — Cascade-wide fallback tokens, emitted as `--<prop>-default`.
    - `radii` (map) — Shape primitives, emitted as `--br-<name>` (referenced by pattern bases).
    - `groups` (map) — Group-level tokens, emitted as `--<prop>-<group>`; patterns opt in via their `group` key.
      - `<name>` (map) — A CSS declaration block: property → value. Values stay strings (they can be hex, var(), clamp(), keywords, …); the generator, not the schema, interprets them.
    - `z` (map) — Z-index tiers → `--z-tier-<name>`.
    - `items` (map) — The component patterns to emit, keyed by name.
      - `<name>` (object) — One component pattern (button, link, badge, card, …): base declarations + interaction states + semantic role variants, resolved through the pattern token cascade.
  - `typography` (object) — Typography: family aliases, semantic type roles (→ `font-<role>` classes), and the bare-element → role mapping.
    - `families` (map) — Role-facing family aliases → CSS font values, usually referencing the top-level `fonts` tokens (e.g. "var(--font-display)").
    - `roles` (map) — Semantic type roles (display, title, heading, body, quote, caption, eyebrow, code, lead, footnote, tag, …), each emitted as a `font-<role>` class.
      - `<name>` (map) — A bag of CSS-ish keys, each mapped to a declaration plus a `--<role>-<sfx>` override hook. The recognised set is **closed**: `family`, `size`, `weight`, `style`, `line-height`, `tracking` (→ `letter-spacing`), `text-transform`, `text-decoration`, `text-wrap`, `color`. Note the last four are spelled with their full CSS property names — `transform` and `decoration` are NOT accepted. Anything unrecognised is **ignored**, not passed through, so the generator warns rather than emitting it: a silently-dropped `transform: uppercase` is how title-case navigation reaches production. Note also that `style`, `text-transform`, `text-decoration` and `text-wrap` are emitted on **every** role at their identity value (`normal`/`none`/`none`/`wrap`) whether declared or not, so applying one role class over another fully resets it — which means **omitting `text-wrap` is not "inherit"**: it emits `text-wrap: wrap` and cancels the `pretty` the role would otherwise inherit from a `pretty` ancestor such as a `body`-mapped role. Declare it on every role — `balance` for heading-like roles, `pretty` for copy, `wrap` for short single-line labels.
    - `headings` (map) — Maps bare elements to type roles so unclassed markup picks up role styling — `{ "h1": "display", "h2": "heading" }`. The key is used verbatim as a selector, so it is not limited to h1…h6: **map `"body"` to your prose role** to bind base page typography to the role rather than hand-writing it. That binding is what makes the role editable — a stylesheet that re-states `font-family`/`line-height` as literals on `body` shadows `--<role>-ff`/`--<role>-lh`, and the live theme editor then appears to do nothing.
  - `animations` (object) — Animation effect + journey classes (pure value layers). The animation engine itself — keyframes, drivers, floats, utilities — is static framework CSS, not configured here.
    - `effects` (map) — Effect classes to emit (`.fade-in`, `.reveal-left`, …), keyed by class name.
      - `<name>` (object) — A named animation effect class — a pure value layer (`--_anim` + `--<prop>-from/-to`) over the static keyframe engine.
    - `journeys` (object) — Multi-part journey classes composed from `base` building blocks.
      - `base` (map) — Named journey building blocks: part name → var map.
      - `compose` (array of array) — Combinations of base parts, each emitted as a `.<parts>-journey` class.
  - `displayName` (one of) — Human-readable theme name (localisable). The label a theme picker would show — nothing reads it yet, because nothing builds more than one theme (see `themes`).
    - *one of*
    - *one of*
  - `extends` (string) — Another `themes` key to inherit from; this entry then only supplies what it overrides.

### `defaultTheme` *(optional)*

Which `themes` entry to use (convention: "default"). Validated against the map; selecting a non-default theme is not wired yet.

### `defaultColorScheme` *(optional)*

Initial appearance. `"system"` follows the OS via `prefers-color-scheme` and is what makes `<color-scheme-toggle>`'s "System" position resolve to anything — it removes the theme attribute, so without this the page falls through to light. It also gives a no-JS page the OS appearance. Defaults to `"light"`, because switching an existing site to `"system"` visibly flips it dark for dark-OS visitors.

## `organization` *(optional)*

The company: schema.org Organization details for JSON-LD (name, legalName, logo, tax IDs, sameAs), plus its contact, physical locations, services and public profiles. These stay true across sites — several sites can share one `organization` and differ only in `site`.

### `name` *(optional)*

Trading name, as a reader would recognise it (e.g. "Acme"). Localisable.

### `legalName` *(optional)*

Registered legal name (e.g. "Acme Widgets Inc."). The generated legal documents prefer this over `name` — a policy is a statement by the legal entity.

### `foundingDate` *(optional)*

Date the organization was founded (YYYY-MM-DD).

### `logo` *(optional)*

Organization logo → JSON-LD `logo`.

### `email` *(optional)*

General contact address. Also the last fallback for privacy requests — see `contact`.

### `phone` *(optional)*

General contact telephone number.

### `address` *(optional)*

Registered/mailing address. Its `addressRegion` and `addressCountry` are what the governing-law clause of the generated terms of service defaults to.

- `streetAddress` (string, required)
- `addressLocality` (string, required) — City.
- `addressRegion` (string) — State / province.
- `postalCode` (string)
- `addressCountry` (string, required) — Country (ISO 3166-1 alpha-2 preferred).

### `taxID` *(optional)*

Tax identification number.

### `vatID` *(optional)*

VAT identification number.

### `sameAs` *(optional)*

Profile URLs → JSON-LD `sameAs` (mirrors `links`).

### `contact` *(optional)*

Primary contact: either a `locations` key (string reference) or an inline name/email/phone/address object.

### `primaryLocation` *(optional)*

The main `locations` key (for JSON-LD and defaults).

### `locations` *(optional)*

Physical locations (schema.org LocalBusiness): address, geo, opening hours, service area.

- `<name>` (object)
  - `slug` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `name` (one of, required) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `email` (string)
  - `phone` (string)
  - `address` (object) — schema.org `PostalAddress` field names, so JSON-LD generation is lossless.
    - `streetAddress` (string, required)
    - `addressLocality` (string, required) — City.
    - `addressRegion` (string) — State / province.
    - `postalCode` (string)
    - `addressCountry` (string, required) — Country (ISO 3166-1 alpha-2 preferred).
  - `geo` (object)
    - `latitude` (number, required)
    - `longitude` (number, required)
  - `hours` (array)
    - `[items]` (object)
      - `dayOfWeek` (array of Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday, required)
      - `opens` (string, required)
      - `closes` (string, required)
  - `type` (LocalBusiness | Store | Restaurant | CafeOrCoffeeShop | ProfessionalService | MedicalBusiness | HealthAndBeautyBusiness | HomeAndConstructionBusiness | AutomotiveBusiness | FinancialService | LegalService | RealEstateAgent | Organization)
  - `description` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `areaServed` (array of string)
  - `priceRange` (string)
  - `paymentAccepted` (array of string)
  - `currenciesAccepted` (string)
  - `knowsLanguage` (array of string)

### `services` *(optional)*

Services offered (schema.org Service/Offer): name, description, slug, price offers.

- `<name>` (object)
  - `name` (one of, required) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `description` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `slug` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `offers` (array)
    - `[items]` (object)
      - `name` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
      - `price` (string | number)
      - `priceCurrency` (string)
      - `availability` (string)
      - `url` (string)
      - `validFrom` (string)
      - `priceValidUntil` (string)

### `links` *(optional)*

Public profile URLs (also feed JSON-LD `sameAs` via `organization.sameAs`).

- `googleMaps` (string)
- `instagram` (string)
- `facebook` (string)
- `x` (string)
- `linkedin` (string)
- `youtube` (string)
- `github` (string)

## `site`

This published site: locales, domains, environments, content templates, SEO, analytics, legal documents, icons, favicon and deployment. Facts about a *presentation* of the organization rather than the organization itself.

### `defaultLocale`

The locale used when none is specified; must be a `locales` key.

### `locales`

Locales the site is published in, keyed by BCP 47 tag (e.g. "en", "fr").

- `<name>` (object)
  - `name` (string, required) — Display name of the locale (e.g. "English").
  - `tagline` (string) — Site tagline in this locale.
  - `basePath` (string) — URL prefix for this locale (e.g. "/fr").

### `domains` *(optional)*

Canonical domain + redirecting aliases.

- `canonical` (string, required) — The canonical origin used for absolute URLs and SEO.
- `aliases` (array) — Alias domains and how they redirect to the canonical one.
  - `[items]` (object)
    - `domain` (string, required)
    - `redirectType` (number | number | number | number, required)
    - `redirectTo` (string, required)
    - `environment` (string)

### `dns` *(optional)*

Desired DNS state per domain (provider, nameservers, records) — declarative reference, not applied automatically.

- `<name>` (object)
  - `provider` (string)
  - `nameservers` (array of string)
  - `records` (array)
    - `[items]` (object)
      - `type` (A | AAAA | CNAME | TXT | MX | NS | SRV | CAA | PTR | SOA, required)
      - `name` (string)
      - `value` (string, required)
      - `ttl` (integer)
      - `proxied` (boolean)

### `cloudflare` *(optional)*

Deliberate escape hatch for provider-specific Cloudflare settings — out of scope to model here.

### `environments`

Deploy environments (production, dev, …): URL, API origin, analytics toggle, robots policy, active A/B variant.

- `<name>` (object)
  - `url` (string, required) — Public origin of this environment.
  - `api` (string) — API origin, when different from `url`.
  - `analytics` (boolean) — Whether analytics fire in this environment.
  - `robots` (string) — Robots policy (e.g. "noindex,nofollow" for dev).
  - `variant` (string) — Active `abTesting.variants` key for this environment.

### `abTesting` *(optional)*

A/B testing: cookie-based split plus named variants whose `overrides` patch the config per environment.

- `enabled` (boolean, required)
- `cookieName` (string)
- `cookieMaxAge` (integer) — Seconds.
- `splitRatio` (number) — Fraction of traffic sent to the variant (0–1).
- `variants` (map) — Named variants; each targets an environment and may deep-merge config `overrides`.
  - `<name>` (object)
    - `environment` (string, required)
    - `description` (string)
    - `overrides` (map)

### `fonts` *(optional)*

Font LOADING (a serialisable projection of the Astro Fonts API: provider, weights, subsets, preload). Font TOKENS live in `designSystem.themes.<theme>.fonts` and reference the same `cssVariable`.

- `[items]` (object)
  - `name` (string, required)
  - `provider` (google | fontsource | adobe | bunny | fontshare | googleicons | npm | local, required)
  - `cssVariable` (string, required)
  - `weights` (array)
    - `[items]` (number | string)
  - `styles` (array of normal | italic)
  - `subsets` (array of string)
  - `fallbacks` (array of string)
  - `optimizedFallbacks` (boolean)
  - `display` (auto | block | swap | fallback | optional)
  - `formats` (array of string)
  - `unicodeRange` (array of string)
  - `variants` (array)
    - `[items]` (object)
      - `src` (array of string, required)
      - `weight` (number | string)
      - `style` (normal | italic)
      - `unicodeRange` (array of string)
      - `display` (auto | block | swap | fallback | optional)
  - `preload` (one of) — Emit `<Font preload />` for this family (true, or a list of weight/style faces).
    - *one of*
    - *one of*
      - `[items]` (object)

### `tags` *(optional)*

Free-form content-tag taxonomy (site-specific; not interpreted by the generator).

### `postTypes` *(optional)*

Free-form content-type definitions (site-specific; not interpreted by the generator).

### `galleries` *(optional)*

Named image galleries (title, tags, images with localisable alt/caption).

- `<name>` (object)
  - `title` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `tags` (array of string)
  - `images` (array, required)
    - `[items]` (object)
      - `src` (string, required)
      - `alt` (one of, required) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
      - `caption` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).

### `testimonials` *(optional)*

Named testimonial groups (quote, name, role, rating, date).

- `<name>` (object)
  - `title` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `items` (array, required)
    - `[items]` (object)
      - `quote` (one of, required) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
      - `name` (string, required)
      - `role` (string)
      - `rating` (number)
      - `date` (string)

### `templates` *(optional)*

Named content templates rendered at SSR time: `nav` (menu trees), `form` (field lists + submit), or `nodes` (raw element trees).

- `<name>` (one of)
  - *one of*
    - `type` (string, required)
    - `tags` (array of string)
    - `present` (map)
    - `items` (array)
  - *one of*
    - `type` (string, required)
    - `tags` (array of string)
    - `present` (map)
    - `action` (string)
    - `method` (get | post)
    - `fields` (array)
      - `[items]` (object)
    - `submit` (map)
      - `<name>` (string | number | boolean)
    - `honeypot` (boolean)
  - *one of*
    - `type` (string, required)
    - `tags` (array of string)
    - `nodes` (array)

### `navigation` *(optional)*

Site navigation settings (which nav template renders where).

- `activeTemplate` (object) — Which nav template is active, optionally per breakpoint.
  - `default` (string) — A `templates` key.
  - `breakpoints` (map) — Breakpoint name → `templates` key overrides.

### `seo` *(optional)*

SEO defaults: title/description templates, robots policy, verification tokens, Open Graph + Twitter cards, and post-deploy indexing notification.

- `titleTemplate` (string) — Page-title pattern (e.g. "%s · Acme").
- `descriptionTemplate` (string)
- `robots` (string) — e.g. "index,follow" / "noindex,nofollow".
- `googleSiteVerification` (string)
- `bingSiteVerification` (string)
- `openGraph` (object)
  - `type` (string)
  - `siteName` (string)
  - `title` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `description` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `image` (one of)
    - *one of*
    - *one of*
      - `src` (string, required)
      - `alt` (string, required)
      - `width` (number)
      - `height` (number)
  - `locale` (string)
- `twitter` (object)
  - `card` (summary | summary_large_image | app | player)
  - `site` (string)
  - `creator` (string)
  - `title` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `description` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `image` (one of)
    - *one of*
    - *one of*
      - `src` (string, required)
      - `alt` (string, required)
      - `width` (number)
      - `height` (number)
- `indexing` (object) — How `vitops notify` tells search engines about a deploy: which sitemap, IndexNow key, Search Console property, and which pages to verify afterwards.
  - `sitemapUrl` (string) — The sitemap to submit and to diff for changed URLs. Defaults to `<canonical>/sitemap-index.xml`.
  - `indexNow` (object) — IndexNow submission (Bing, Yandex, Naver, Seznam, Yep — not Google). Omit to skip the channel.
    - `key` (string, required) — IndexNow key (8–128 chars, hex is conventional). NOT a secret — it is served publicly at `keyLocation` so the engine can verify you own the host. Generate one with `vitops notify --new-key`.
    - `keyLocation` (string) — Absolute URL of the key file. Defaults to `<canonical>/<key>.txt`; set it only when the file lives elsewhere.
    - `endpoint` (string) — IndexNow endpoint (default `https://api.indexnow.org/indexnow`). Any participating engine shares submissions with the rest, so one is normally enough.
  - `searchConsole` (object) — Google Search Console property. Needs a service-account credential in `VITOPS_GSC_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` at run time — never put the key in this file.
    - `siteUrl` (string, required) — The property exactly as Search Console identifies it — `sc-domain:acme.ca` for a domain property, or the URL-prefix form `https://acme.ca/`. A mismatch here is a 403, not a "not found".
    - `resubmitSitemap` (boolean) — Re-submit the sitemap through the Search Console API on each notify (default true when `searchConsole` is set). This is the automated equivalent of the manual resubmit in the UI.
  - `priorityUrls` (array of string) — The pages whose indexing actually matters. `vitops notify --check` inspects these and exits non-zero if Google has not indexed one. Kept explicit because URL Inspection is quota-bound (2000/day), so checking every page is neither affordable nor informative.

### `analytics` *(optional)*

Analytics provider IDs (gated per environment via `environments.<env>.analytics`). Which provider is set is also what the generated privacy policy and cookie notice disclose — see `legal`.

- `googleAnalyticsId` (string)
- `plausibleDomain` (string)
- `googleTagManagerId` (string)
- `clarityId` (string) — Microsoft Clarity project ID.
- `matomo` (object) — Matomo instance.
  - `url` (string, required) — Instance base URL (self-hosted, or `*.matomo.cloud`).
  - `siteId` (string, required) — Site ID within that instance.
  - `cookies` (boolean) — Default false — Matomo runs cookieless (`disableCookies`), which is what lets the cookie notice state positively that it sets none.

### `notifications` *(optional)*

Where site notifications (e.g. form submissions) are sent.

- `email` (string)

### `tracking` *(optional)*

Marketing/conversion tracking toggles per platform.

- `enabled` (boolean)
- `platforms` (array of string)

### `security` *(optional)*

Security integrations (bot protection).

- `turnstile` (object)
  - `siteKey` (string) — Cloudflare Turnstile site key (public).

### `legal` *(optional)*

Legal pages: which documents exist, where they live, and the facts the generated prose asserts.

- `jurisdiction` (ca) — Which legal template set the generated documents use. Default `ca`.
- `privacyPolicy` (object)
  - `enabled` (boolean, required)
  - `url` (string)
  - `lastUpdated` (string)
  - `privacyOfficer` (one of) — Who privacy requests go to. Falls back to `contact`, then `primaryLocation`.
    - *one of*
    - *one of*
      - `name` (string)
      - `email` (string)
      - `phone` (string)
      - `address` (object) — schema.org `PostalAddress` field names, so JSON-LD generation is lossless.
  - `retention` (string) — How long personal information is kept, in prose (e.g. "24 months after last contact").
  - `processors` (array) — Third parties that receive personal information and cannot be inferred from the rest of the config (payment processors, CRMs, mail senders). Known providers implied by `analytics`, `security` and `deployment` are added automatically — list only the rest.
    - `[items]` (object)
      - `name` (string, required) — The provider, as a reader would recognise it (e.g. "Stripe").
      - `purpose` (string, required) — Why they receive it, as a noun phrase that reads after "for" (e.g. "payment processing").
      - `country` (string) — Where they process it, as it should read in a sentence (e.g. "the United States"). Feeds the cross-border-transfer disclosure.
      - `privacyUrl` (string)
- `termsOfService` (object)
  - `enabled` (boolean, required)
  - `url` (string)
  - `lastUpdated` (string | null)
  - `governingLaw` (string) — Governing-law clause, in prose (e.g. "the Province of Ontario"). Defaults from the contact address.
- `cookieConsent` (object)
  - `enabled` (boolean, required)
  - `type` (opt-in | opt-out) — Consent model.
  - `position` (top | bottom | center)
  - `categories` (array of string)

### `icons` *(optional)*

Icon sets and the specific icons to bundle from each (keys are iconify collection names).

- `ui` (string) — Icon set used for UI chrome (e.g. "lucide", "ph").
- `brand` (string) — Icon set used for brand marks.
- `weight` (string) — Weight for suffix-weighted sets like Phosphor ("regular" | "bold" | "duotone" | "fill" | "light" | "thin"). Ignored by sets that split weights across collections, e.g. Font Awesome.
- `sprite` (boolean) — Emit an SVG sprite (icons.svg) alongside the stylesheet, for consumers that cannot run an icon integration (Bricks/WordPress, EmDash renderers).
- `semantic` (array of string) — Named semantic icons to include.
- `fa7-solid` (array of string)
- `fa7-regular` (array of string)
- `fa7-light` (array of string)
- `fa7-thin` (array of string)
- `fa7-brands` (array of string)
- `simple-icons` (array of string)
- `material-symbols` (array of string)
- `lucide` (array of string)
- `ph` (array of string)

### `favicon` *(optional)*

Favicon/PWA asset generation (consumed by `@getvitops/utils` favicon tooling).

- `source` (string, required) — Source image (SVG/PNG) the favicon set is generated from.
- `lowResSource` (string) — Alternate source for small raster sizes (16/32px) when the main source scales down poorly.
- `name` (string) — App name for the generated web manifest / PWA.
- `themeColor` (string) — PWA theme color (also `<meta name="theme-color">`).
- `backgroundColor` (string) — PWA background color.

### `deployment` *(optional)*

How the site is built and deployed (platform, commands, output directory) — informational for tooling.

- `platform` (string)
- `buildCommand` (string)
- `deployCommand` (string)
- `outputDirectory` (string)
- `type` (string)
