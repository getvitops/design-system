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
to — `vitops legal`, `vitops icons`, `vitops search` — and it can also stand in for
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

### `defaultTheme` *(optional)*

Which `themes` entry to use (convention: "default"). Validated against the map; selecting a non-default theme is not wired yet.

### `defaultColorScheme` *(optional)*

Initial appearance. `"system"` follows the OS via `prefers-color-scheme` and is what makes `<wc-color-scheme-toggle>`'s "System" position resolve to anything — it removes the theme attribute, so without this the page falls through to light. It also gives a no-JS page the OS appearance. Defaults to `"light"`, because switching an existing site to `"system"` visibly flips it dark for dark-OS visitors.

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

### `searchConsole` *(optional)*

Domains to onboard as Google Search Console *domain properties* via `vitops search setup`, keyed by bare hostname (mirrors `dns`). Credentials come from the environment (CLOUDFLARE_API_TOKEN + the Google OAuth vars) — never in this file.

- `<name>` (object)
  - `delegatedOwners` (array of string) — Emails added as verification owners on the Site Verification web resource. Automated via the API — additive and idempotent, never removes an existing owner.
  - `fullUserGroup` (string) — A Google Group to grant Full-User access in Search Console. SURFACED AS A REMINDER only: Search Console exposes no user/permission API, so this step stays manual by design.

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
- `indexing` (object) — How `vitops search notify` tells search engines about a deploy: which sitemap, IndexNow key, Search Console property, and which pages to verify afterwards.
  - `sitemapUrl` (string) — The sitemap to submit and to diff for changed URLs. Defaults to `<canonical>/sitemap-index.xml`.
  - `indexNow` (object) — IndexNow submission (Bing, Yandex, Naver, Seznam, Yep — not Google). Omit to skip the channel.
    - `key` (string, required) — IndexNow key (8–128 chars, hex is conventional). NOT a secret — it is served publicly at `keyLocation` so the engine can verify you own the host. Generate one with `vitops search notify --new-key`.
    - `keyLocation` (string) — Absolute URL of the key file. Defaults to `<canonical>/<key>.txt`; set it only when the file lives elsewhere.
    - `endpoint` (string) — IndexNow endpoint (default `https://api.indexnow.org/indexnow`). Any participating engine shares submissions with the rest, so one is normally enough.
  - `searchConsole` (object) — Google Search Console property. Needs a credential at run time — either a service account in `VITOPS_GSC_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`, or the user OAuth credential `vitops search setup` uses (`VITOPS_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`). The service account wins when both are set. Never put a key in this file.
    - `siteUrl` (string, required) — The property exactly as Search Console identifies it — `sc-domain:acme.ca` for a domain property, or the URL-prefix form `https://acme.ca/`. A mismatch here is a 403, not a "not found".
    - `resubmitSitemap` (boolean) — Re-submit the sitemap through the Search Console API on each notify (default true when `searchConsole` is set). This is the automated equivalent of the manual resubmit in the UI.
  - `priorityUrls` (array of string) — The pages whose indexing actually matters. `vitops search notify --check` inspects these and exits non-zero if Google has not indexed one. Kept explicit because URL Inspection is quota-bound (2000/day), so checking every page is neither affordable nor informative.

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

Where site notifications (form submissions, tracked calls) are sent. TODO: `sms` and `persist` channels — only `email` is implemented.

- `email` (one of) — Where conversion notifications are e-mailed. A bare address is shorthand for `{ provider: "cloudflare", to }`.
  - *one of*
  - *one of*
    - `provider` (string, required) — Delivery provider. Only Cloudflare Email Sending is implemented; the field is stated so adding another is additive.
    - `to` (string) — Recipient. Defaults to the primary location’s `email`, then the first location that has one.
    - `from` (string) — Sender. Defaults to `noreply@<domains.canonical>`. Its domain must be onboarded (`wrangler email sending enable <domain>`) or every send fails.
    - `fromName` (string) — Display name on the From header. Defaults to `organization.name`.
    - `replyTo` (string) — Reply-To header.
    - `binding` (string) — Workers `send_email` binding name (default `EMAIL`). Set it when using a restricted binding.

### `tracking` *(optional)*

Ad-click attribution for conversion tracking.

- `enabled` (boolean) — Capture ad click IDs and UTMs from the landing URL into the `_ac` cookie, for attributing conversions.
- `category` (marketing | analytics) — Consent category the `_ac` cookie waits on (default `marketing`). It is a 90-day identifier tying a visitor to the ad that brought them, so it is only written once this category is granted — and asking for it is what raises the banner.
- `platforms` (array of string) — Informational list of ad platforms in use. Capture recognises every known click-ID parameter regardless.

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
      - `country` (string) — Shorthand for the common case where one country is both where they store it and whose laws reach it: asserts BOTH `storage: [{ country }]` AND `operatorCountry`. Reads inside a sentence (e.g. "the United States"). When the two differ — a Canadian region operated by a US company — state `storage` and `operatorCountry` instead; setting this alongside either is rejected.
      - `storage` (array) — Where the information actually rests. Feeds the "stored or processed outside of <jurisdiction>" disclosure and nothing else. Several entries are allowed, each optionally scoped to a category of information — which is what makes a Canadian-region tenant holding identity data in the US expressible.
      - `operatorCountry` (string) — The jurisdiction that can compel this provider to hand the information over — where it is established, or from which it is controlled. Reads after "the laws of" (e.g. "the United States"); a bloc is acceptable. A SEPARATE fact from `storage`, because privacy law cares about foreign *access*, not only foreign storage: a Canadian-region service run by a US company is `storage: [{ country: "Canada" }]` with `operatorCountry: "the United States"`.
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
