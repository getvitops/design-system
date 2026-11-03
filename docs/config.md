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

## `$schema` *(optional)*

URL of the published config JSON Schema (stamped by `vitops init --site`) so editors provide autocomplete + validation.



## `configVersion` *(optional)*

The config shape version (see `CONFIG_VERSION`) — absent reads as version 1, which is every config validated by this schema so far.



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
  - `hoursSpecial` (array) — Holiday/temporary hours, as dated deviations from the recurring `hours` — distinct from it because these carry a date range rather than a weekday.
    - `[items]` (object)
      - `validFrom` (string, required)
      - `validThrough` (string)
      - `opens` (string)
      - `closes` (string)
  - `type` (LocalBusiness | Store | Restaurant | CafeOrCoffeeShop | ProfessionalService | MedicalBusiness | HealthAndBeautyBusiness | HomeAndConstructionBusiness | AutomotiveBusiness | FinancialService | LegalService | RealEstateAgent | Organization)
  - `description` (one of) — A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).
    - *one of*
    - *one of*
  - `areaServed` (array of string)
  - `priceRange` (string)
  - `paymentAccepted` (array of string)
  - `currenciesAccepted` (string)
  - `knowsLanguage` (array of string)
  - `photos` (array) — Location photos (logo, storefront, interior, …) → JSON-LD `image`. Every listing platform (GBP, Bing Places, Apple Business Connect) wants these; none can derive them.
    - `[items]` (one of)
      - *one of*
      - *one of*
        - `src` (string, required)
        - `alt` (string, required)
        - `width` (number)
        - `height` (number)
  - `sameAs` (array of string) — This location's own profile URLs (its Google Business Profile, Bing Places listing, Apple Business Connect location, Facebook page, …) → JSON-LD `sameAs`. Distinct from `organization.sameAs`, which is the company overall — a multi-location org's locations do not share one GBP listing.
  - `listings` (map) — External listing IDs for this location, keyed by platform — the Google Business Profile location id, the Bing Places business id, the Apple Business Connect location id. Not consumed by the generator today; recorded here so a future sync has a stable id to match against instead of risking a duplicate listing.

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
      - `price` (string,number)
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

### `google` *(optional)*

This site's Google Cloud project. Not a secret — the credentials stay in the environment.

- `project` (string, required) — Google Cloud project id that API usage is attributed to (quota and billing). One project per site keeps usage separate — Search Console today, Maps and anything else later. Sent as `x-goog-user-project`, which is required when the credential is a *user* one (an ADC login from `gcloud auth application-default login`, or `VITOPS_GOOGLE_*`): those use a shared OAuth client that carries no project of its own. A service-account credential belongs to a project already, so this is not needed for it. The identity must hold `serviceusage.services.use` on the project, and the APIs being called must be enabled there.

### `searchConsole` *(optional)*

Domains to onboard as Google Search Console *domain properties* via `vitops search setup`, keyed by bare hostname (mirrors `dns`). Credentials come from the environment (CLOUDFLARE_API_TOKEN + the Google OAuth vars) — never in this file. Set `google.project` when using a user credential.

- `<name>` (object)
  - `delegatedOwners` (array of string) — Emails added as verification owners on the Site Verification web resource. Automated via the API — additive and idempotent, never removes an existing owner.
  - `fullUserGroup` (string) — A Google Group to grant Full-User access in Search Console. SURFACED AS A REMINDER only: Search Console exposes no user/permission API, so this step stays manual by design.

### `environments`

Deploy environments (production, dev, …): URL, API origin, analytics toggle, robots policy, active A/B variant.

- `<name>` (object)
  - `url` (string, required) — Public origin of this environment.
  - `api` (string) — API origin, when different from `url`.
  - `analytics` (boolean) — Whether analytics fire in this environment.
  - `ads` (boolean) — Whether `site.ads` pixels fire in this environment. Defaults to `analytics`, then true — a preview deployment sending pageviews is survivable, one firing conversion pixels is not, so this can be turned off on its own.
  - `robots` (string) — Robots policy (e.g. "noindex,nofollow" for dev).
  - `variant` (string) — Active `abTesting.variants` key for this environment.

### `plan` *(optional)*

Commercial plan/add-on entitlement, gating which capability fields below may be turned on. Absence means unrestricted.

- `key` (string, required) — Commercial plan identifier (e.g. "essentials", "growth") — open string, not a closed enum.
- `addons` (array of string) — Add-on keys this site is entitled to (e.g. "ab_testing", "server_side_tracking") — checked against PLAN_CAPABILITIES.

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

### `experiments` *(optional)*

Runtime, per-visitor content experiments — one config-schema-free page branches on a cookie the vitopsAbTesting() middleware assigns. Distinct from `abTesting`, which merges a whole build/environment variant at resolve time; this instead lets one page (e.g. a real, nav-linked /contact) run a copy test without a second URL or a second deploy. Keyed by an open experiment name so more than one can run at once.

- `<name>` (object)
  - `enabled` (boolean, required)
  - `category` (analytics | marketing) — Consent category this experiment's assignment cookie waits on (default `analytics`) — independent of `site.tracking.category`, so an experiment never piggybacks on ad-attribution consent.
  - `cookieName` (string) — Default `_ab_<experiment key>`.
  - `cookieMaxAge` (integer) — Seconds.
  - `splitRatio` (number) — Fraction of new visitors auto-assigned to `variants[1]` (default 0.5). 0 means nobody is auto-assigned — a manually or query-param-set cookie still pins a visitor to `variants[1]`, which is what makes 0 a real blue/green-preview mode rather than a no-op.
  - `variants` (array, required) — Exactly two variant names, e.g. ["control", "new-form"]. `variants[0]` is the default a visitor with no assignment yet effectively sees.

### `fonts` *(optional)*

Font LOADING (a serialisable projection of the Astro Fonts API: provider, weights, subsets, preload). Font TOKENS live in `designSystem.themes.<theme>.fonts` and reference the same `cssVariable`.

- `[items]` (object)
  - `name` (string, required)
  - `provider` (google | fontsource | adobe | bunny | fontshare | googleicons | npm | local, required)
  - `cssVariable` (string, required)
  - `weights` (array of number,string)
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
      - `weight` (number,string)
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
  - `abVariantDimensions` (map) — Pre-created Matomo custom-dimension index per `site.experiments` key — Matomo requires the dimension to exist in the instance before a value can be pushed for it.

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
    - `verifySender` (boolean) — Set false to skip `vitops email check`'s deploy-time onboarding warning for this site — for a `from` domain the scan cannot see is correct (e.g. built dynamically), which would otherwise be a false positive.
- `actionUrl` (string) — Optional action-link template added to the conversion email (e.g. a link into your ad platform or your own CRM/portal). `{clickId}` is replaced with the ad click ID captured on `_ac` (gclid, fbclid, …). Omitted from the email when the event carries no click ID to interpolate, rather than rendering a broken link.

### `tracking` *(optional)*

Ad-click attribution for conversion tracking.

- `enabled` (boolean) — Capture ad click IDs and UTMs from the landing URL into the `_ac` cookie, for attributing conversions.
- `category` (marketing | analytics) — Consent category the `_ac` cookie waits on (default `marketing`). It is a 90-day identifier tying a visitor to the ad that brought them, so it is only written once this category is granted — and asking for it is what raises the banner.
- `platforms` (array of string) — Informational list of ad platforms in use. Capture recognises every known click-ID parameter regardless.

### `ads` *(optional)*

Ad properties this site is linked to, keyed by platform. Read by `vitops ads setup` (ensure the DNS verification record), `vitops ads tags` (emit the consent-gated pixel), and the generated cookie notice (disclose what each pixel stores). Credentials never live here — the DNS write uses CLOUDFLARE_API_TOKEN from the environment.

- `<name>` (object)
  - `accountId` (string) — The advertising account as the platform shows it — Google Ads customer ID, Meta ad account, LinkedIn partner ID, Reddit advertiser ID. For LinkedIn this is also the Insight Tag id; everywhere else the tag id is `pixelId`.
  - `pixelId` (string) — The tag/pixel ID the browser snippet initialises — Meta pixel, TikTok pixel, Reddit pixel, Microsoft UET tag ID, Pinterest tag ID, Snap pixel, or the Google Ads conversion ID (`AW-…`, which is NOT the customer ID).
  - `conversionLabel` (one of) — Google Ads only: the conversion action label(s) paired with the `AW-…` conversion ID — either one bare label (back-compat, treated as the `call` action) or a map of action → label, so a call, an email click and a form submission each fire their own Google Ads conversion action instead of all three reporting as the same one.
    - *one of*
    - *one of*
      - `call` (string) — Fired on a tel: link click.
      - `email` (string) — Fired on a mailto: link click.
      - `form` (string) — Fired client-side by `vitopsFormConversion()` — the consumer's own submit handler calls it once a form POST succeeds.
  - `conversionActionId` (one of) — Google Ads only: the conversion action **resource id(s)** (a numeric id, or a full `customers/…/conversionActions/…` resource name) used for server-side offline conversion upload — NOT the same value as `conversionLabel`, which is the opaque label the web tag uses and which the Ads API's upload endpoint does not accept. Only meaningful when `reporting: "server"`.
    - *one of*
    - *one of*
      - `call` (string) — Fired on a tel: link click.
      - `email` (string) — Fired on a mailto: link click.
      - `form` (string) — Fired on a form submission.
  - `reporting` (client | server) — Google Ads only: `"client"` (default) fires the conversion via `gtag.js` in the browser at click/submit time; `"server"` uploads it via the Ads API from the conversion endpoint instead (see `conversionActionId`). An action with no matching `conversionActionId` keeps firing client-side regardless of this setting, so setting it before `conversionActionId` is filled in never silently drops a conversion.
  - `domain` (string) — Bare hostname to verify with this platform. Defaults to the host of `domains.canonical` — set it only when the ad account is verified against a different domain.
  - `domainVerification` (string) — The verification token from the platform UI, for the platforms that verify by DNS TXT (Meta, TikTok, Pinterest, Snapchat). `vitops ads setup` prompts for it and writes it here on first run. NOT a secret — it is published in DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key. A value containing `=` is used as the whole record, which is the escape hatch if a platform changes its prefix.
  - `category` (marketing | analytics) — Consent category the tag waits on (default `marketing`). An ad pixel is advertising by default; `analytics` is for a site using one purely for its own measurement.
  - `enabled` (boolean) — Set false to keep the property on record without emitting its tag.

### `reviews` *(optional)*

Google Business Profile reviews to cache and display, keyed by `organization.locations`. Read by `vitops reviews`. Credentials never live here — a Google OAuth credential comes from the environment, same as `site.searchConsole`.

- `accountId` (string) — Default GBP account resource id (`accounts/…`) for locations that do not override it.
- `locations` (map, required) — Which `organization.locations` to fetch Google reviews for, and how each one’s reviews are filtered/ordered. `vitops reviews` writes the result to `.vitops/reviews.json`.
  - `<name>` (object)
    - `accountId` (string) — GBP account resource id (`accounts/…`), overriding `site.reviews.accountId` for this location.
    - `locationId` (string, required) — GBP location resource id (`locations/…`) to fetch reviews for.
    - `featured` (array of string) — Review ids to always include, in this order, ahead of everything else automatically selected.
    - `minRating` (number) — Drop reviews below this star rating (default 4) from the automatic (non-featured) selection.
    - `limit` (number) — Keep at most this many reviews after filtering.
    - `sort` (recent | rating) — Ordering for the non-featured remainder (default `recent`).
- `schema` (boolean) — Emit `Review` JSON-LD for these reviews (default false). Off by default: Google’s structured-data policy treats a business marking up reviews of itself as ineligible for review rich results, and risks a manual action.
- `avatars` (boolean) — Render the reviewer’s Google-hosted avatar photo (default false). Off by default: every visitor would otherwise issue a third-party request to googleusercontent.com, and the URLs are not guaranteed to stay live.

### `crm` *(optional)*

Push form submissions into a client CRM (HubSpot, Zoho Bigin, or Jobber) alongside the notification email. Read by `createConversionRoute()`'s `crm` option and `vitops crm check`/`vitops crm setup`. Credentials never live here.

- `provider` (hubspot | bigin | jobber, required) — Which CRM this site pushes form submissions into.
- `enabled` (boolean) — Set false to keep the block on record without writing to the CRM.
- `hubspot` (object) — Required when `provider` is `hubspot`.
  - `portalId` (string, required) — The HubSpot portal (hub) ID the form belongs to.
  - `formGuid` (string, required) — The HubSpot form GUID to submit against.
  - `dataCenter` (na | eu) — Which regional submissions API to post to (default `na`).
- `bigin` (object) — Required when `provider` is `bigin`.
  - `dataCenter` (com | ca | eu | in | com.au | jp, required) — The self-client's data centre — determines both the OAuth accounts host and the API host (`www.zohoapis.<dc>`).
  - `duplicateCheckField` (string) — Bigin field the upsert dedupes on (default `Email`, Bigin's own unique field).
  - `pipeline` (object) — Also open a Pipelines record alongside the Contact.
    - `enabled` (boolean, required) — Also open a Pipelines record for the new/updated contact.
    - `subPipeline` (string) — Sub-pipeline to file the record under.
    - `stage` (string) — Starting stage for the pipeline record.
- `jobber` (object) — Required when `provider` is `jobber`.
  - `apiVersion` (string) — Override the pinned `X-JOBBER-GRAPHQL-VERSION` date this integration is tested against. An escape hatch for an app pinned to a different version — Jobber's schema can change field names between versions.
  - `dedupe` (boolean) — Look up an existing client by email before creating one (default false pending verification of Jobber's search API against a live schema — see AGENTS.md). Jobber's `clientCreate` has no upsert, so without this a resubmitting visitor creates a second client.
  - `note` (object) — Attach a best-effort note carrying the submitted message and any attribution/extra fields with no dedicated Jobber field.
    - `enabled` (boolean) — Attach a best-effort note carrying the message and unmapped attribution (default true). A failure here never loses the client record itself.
- `fieldMap` (map) — Submitted form field name → CRM property name. A field with no entry here is dropped, not guessed — an unmapped field never reaches the CRM.
- `trackingFields` (map) — `_ac` attribution key (a click-ID param, a UTM param, `landingPage`, `referrer`, or `ab_variant`) → CRM property name. Same drop-if-unmapped rule as `fieldMap`; a visitor with no `_ac` cookie maps to no attribution fields at all, never an error.

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
- `name` (string) — App name for the generated web manifest. Setting this AND `themeColor` is what makes the site installable: together they emit `site.webmanifest` (with `display: "standalone"`) and link it. Neither alone does anything. A marketing site that does not want a browser offering to install it should leave one of them unset.
- `themeColor` (string) — Browser UI colour, emitted as `<meta name="theme-color">` on every page — so it applies with or without a manifest. Note it is also half the manifest switch: see `name`.
- `backgroundColor` (string) — Background composited under the OPAQUE generated icons — `apple-touch-icon.png` and the maskable `icon-mask.png` — which are produced whether or not there is a manifest. Defaults to white, so a dark logo on a transparent source needs this set. It is also the manifest `background_color` when one is emitted, but it is not manifest-only.

### `deployment` *(optional)*

How the site is built and deployed (platform, commands, output directory) — informational for tooling.

- `platform` (string)
- `buildCommand` (string)
- `deployCommand` (string)
- `outputDirectory` (string)
- `type` (string)
- `repo` (string) — `owner/name` of this site's GitHub repository. Read by the EmDash design-system-editor plugin route to auto-commit a client's admin edit back to `branch` — see AGENTS.md's "EmDash plugin as the design-system editing surface" section. Absent means that sync is skipped (the live override still applies); nothing else in this toolchain reads it today.
- `branch` (string) — Branch the design-system-editor sync commits to. Default `"dev"` — never `main`/production directly; a commit here still needs this repo's own `promote` PR + admin approval to reach production, the same gate every other change goes through.
