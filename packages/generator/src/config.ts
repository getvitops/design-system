/**
 * The top-level configuration schema — the umbrella around a
 * `design-system.json`-compliant `designSystem`.
 *
 * **Three sections, one document.** A config is `{ designSystem, organization,
 * site }`:
 *
 *  - `designSystem` — the token set (named themes + which theme/appearance).
 *  - `organization` — the company: who it is, where it is, how to reach it, what
 *    it sells. Facts that stay true if the site is rebuilt from scratch.
 *  - `site` — this published site: locales, domains, environments, SEO,
 *    analytics, legal, icons, deployment. Facts about *a* presentation of the
 *    organization.
 *
 * The split is not cosmetic. The flat predecessor (`SiteConfig`) held the company
 * and the deployment as peers, so no single noun described it — and the
 * multi-site case was inexpressible. With three sections, several sites can share
 * one `organization` and override only `site`.
 *
 * Authored with `zod/mini` (same instance the design-system schema uses), so the
 * two compose: `DesignSystemSchema` is embedded as `designSystem.themes.<theme>` and the
 * whole thing serialises to one JSON Schema via `z.toJSONSchema`. Everything a
 * generator needs derives from here: the `Config` type (`z.infer`), the
 * published JSON Schema (`configJsonSchema`), and runtime validation (`validateConfig`).
 *
 * Pure: no YAML/env/fs. `resolveConfig` takes an already-parsed object; a
 * thin loader (reading YAML, injecting `SITE_ENV`) lives outside this module.
 */
import * as z from 'zod/mini';
import { desc, DesignSystemPatchSchema, type DesignSystem } from './schema.ts';

// ── Primitives ────────────────────────────────────────────────────────────────

const LocalizableSchema = desc(
  z.union([z.string(), z.record(z.string(), z.string())]),
  'A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`).',
);

const ImageRefSchema = z.union([
  z.string(),
  z.object({
    src: z.string(),
    alt: z.string(),
    width: z.optional(z.number()),
    height: z.optional(z.number()),
  }),
]);

// Attribute bags on generated HTML — constrained to serialisable scalars so the
// exported JSON Schema still offers validation (vs. an opaque `unknown`).
const AttrValue = z.union([z.string(), z.number(), z.boolean()]);
const AttrsSchema = z.optional(z.record(z.string(), AttrValue));

const IsoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)); // YYYY-MM-DD
const Iso4217 = z.string().check(z.regex(/^[A-Z]{3}$/)); // currency code
const DayOfWeek = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

// ── Design system ───────────────────────────────────────────────────────────────
// Each `themes` entry is a full `DesignSystem` plus a localised `displayName` and
// an optional `extends` (another entry's key). Entries are lenient (all top-level
// fields optional) so an extending entry can be a partial patch; the resolved
// theme is validated against the full `DesignSystemSchema` by `resolveTheme`.

const DesignSystemEntry = z.extend(DesignSystemPatchSchema, {
  displayName: desc(
    z.optional(LocalizableSchema),
    'Human-readable theme name (localisable). The label a theme picker would show — nothing reads it yet, because nothing builds more than one theme (see `themes`).',
  ),
  extends: desc(
    z.optional(z.string()),
    'Another `themes` key to inherit from; this entry then only supplies what it overrides.',
  ),
});

/**
 * The design system as a whole: the named themes plus the facts that describe the
 * system rather than any one theme.
 *
 * `themes` is nested rather than being the block itself because the block used to
 * BE the map — every key was a theme name, so there was nowhere to put
 * system-wide metadata without it colliding with a theme of that name.
 *
 * Note the two axes here are independent, and deliberately so. `defaultTheme`
 * picks a *theme* (an authored design system); `defaultColorScheme` picks an
 * *appearance* (light/dark), which every theme already has because the flip is
 * derived from one ramp rather than authored. "Theme `elegant`, appearance
 * follows the OS" has to be sayable, and a single union could not express it.
 */
const DesignSystemBlock = desc(
  z.strictObject({
    themes: desc(
      z.record(z.string(), DesignSystemEntry),
      'Named themes. `default` is the base; others may `extends` another and supply a partial patch. Light/dark is NOT a theme — the functional tokens flip per appearance within each one, so `default` already has both. Only the default theme is built today; multi-theme output and a picker are not wired yet.',
    ),
    defaultTheme: desc(
      z.optional(z.string()),
      'Which `themes` entry to use (convention: "default"). Validated against the map; selecting a non-default theme is not wired yet.',
    ),
    defaultColorScheme: desc(
      z.optional(z.enum(['light', 'dark', 'system'])),
      'Initial appearance. `"system"` follows the OS via `prefers-color-scheme` and is what makes `<color-scheme-toggle>`\'s "System" position resolve to anything — it removes the theme attribute, so without this the page falls through to light. It also gives a no-JS page the OS appearance. Defaults to `"light"`, because switching an existing site to `"system"` visibly flips it dark for dark-OS visitors.',
    ),
  }),
  'The design system: named themes plus the system-wide facts (which theme, which appearance). A bare design system, or a bare theme map, is accepted as shorthand for `{ themes: … }`.',
);

// ── Locales ─────────────────────────────────────────────────────────────────────

const LocaleSchema = z.object({
  name: desc(z.string(), 'Display name of the locale (e.g. "English").'),
  tagline: desc(z.optional(z.string()), 'Site tagline in this locale.'),
  basePath: desc(z.optional(z.string()), 'URL prefix for this locale (e.g. "/fr").'),
});

// ── Domains ─────────────────────────────────────────────────────────────────────

const HttpRedirect = z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]);

const DomainAliasSchema = z.object({
  domain: z.string(),
  redirectType: HttpRedirect,
  redirectTo: z.string(),
  environment: z.optional(z.string()),
});

// ── Contact / address (schema.org-aligned) ──────────────────────────────────────

const PostalAddressSchema = desc(
  z.object({
    streetAddress: z.string(),
    addressLocality: desc(z.string(), 'City.'),
    addressRegion: desc(z.optional(z.string()), 'State / province.'),
    postalCode: z.optional(z.string()),
    addressCountry: desc(z.string(), 'Country (ISO 3166-1 alpha-2 preferred).'),
  }),
  'schema.org `PostalAddress` field names, so JSON-LD generation is lossless.',
);

const ContactObjectSchema = z.object({
  name: z.optional(z.string()),
  email: z.optional(z.email()),
  phone: z.optional(z.string()),
  address: z.optional(PostalAddressSchema),
});

// contact is either a string (location key reference) or an inline object
const ContactConfigSchema = z.union([z.string(), ContactObjectSchema]);

export type PostalAddress = z.infer<typeof PostalAddressSchema>;
export type ContactObject = z.infer<typeof ContactObjectSchema>;

// ── Locations (schema.org LocalBusiness) ────────────────────────────────────────

const GeoSchema = z.object({
  latitude: z.number().check(z.gte(-90), z.lte(90)),
  longitude: z.number().check(z.gte(-180), z.lte(180)),
});

/** schema.org `OpeningHoursSpecification` — per-day open/close (24h `HH:MM`). */
const OpeningHoursSchema = z.object({
  dayOfWeek: z.array(DayOfWeek),
  opens: z.string().check(z.regex(/^\d{2}:\d{2}$/)),
  closes: z.string().check(z.regex(/^\d{2}:\d{2}$/)),
});

// Common schema.org LocalBusiness subtypes (extend as needed).
const LocalBusinessType = z.enum([
  'LocalBusiness',
  'Store',
  'Restaurant',
  'CafeOrCoffeeShop',
  'ProfessionalService',
  'MedicalBusiness',
  'HealthAndBeautyBusiness',
  'HomeAndConstructionBusiness',
  'AutomotiveBusiness',
  'FinancialService',
  'LegalService',
  'RealEstateAgent',
  'Organization',
]);

const LocationSchema = z.object({
  slug: z.optional(LocalizableSchema),
  name: LocalizableSchema,
  email: z.optional(z.email()),
  phone: z.optional(z.string()),
  address: z.optional(PostalAddressSchema),
  geo: z.optional(GeoSchema),
  hours: z.optional(z.array(OpeningHoursSchema)),
  type: z.optional(LocalBusinessType),
  description: z.optional(LocalizableSchema),
  areaServed: z.optional(z.array(z.string())),
  priceRange: z.optional(z.string()),
  paymentAccepted: z.optional(z.array(z.string())),
  currenciesAccepted: z.optional(Iso4217),
  knowsLanguage: z.optional(z.array(z.string())),
});

// ── Organization (schema.org Organization) ──────────────────────────────────────

const OrganizationSchema = z.object({
  name: desc(
    z.optional(LocalizableSchema),
    'Trading name, as a reader would recognise it (e.g. "Acme"). Localisable.',
  ),
  legalName: desc(
    z.optional(z.string()),
    'Registered legal name (e.g. "Acme Widgets Inc."). The generated legal documents prefer this over `name` — a policy is a statement by the legal entity.',
  ),
  foundingDate: desc(z.optional(IsoDate), 'Date the organization was founded (YYYY-MM-DD).'),
  logo: desc(z.optional(ImageRefSchema), 'Organization logo → JSON-LD `logo`.'),
  email: desc(
    z.optional(z.email()),
    'General contact address. Also the last fallback for privacy requests — see `contact`.',
  ),
  phone: desc(z.optional(z.string()), 'General contact telephone number.'),
  address: desc(
    z.optional(PostalAddressSchema),
    'Registered/mailing address. Its `addressRegion` and `addressCountry` are what the governing-law clause of the generated terms of service defaults to.',
  ),
  taxID: desc(z.optional(z.string()), 'Tax identification number.'),
  vatID: desc(z.optional(z.string()), 'VAT identification number.'),
  sameAs: desc(z.optional(z.array(z.url())), 'Profile URLs → JSON-LD `sameAs` (mirrors `links`).'),
});

// ── DNS ──────────────────────────────────────────────────────────────────────

const DnsRecordType = z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA', 'PTR', 'SOA']);

const DnsRecordSchema = z.object({
  type: DnsRecordType,
  name: z.optional(z.string()),
  value: z.string(),
  ttl: z.optional(z.number().check(z.int(), z.positive())),
  proxied: z.optional(z.boolean()),
});

const DnsDomainSchema = z.object({
  provider: z.optional(z.string()),
  nameservers: z.optional(z.array(z.string())),
  records: z.optional(z.array(DnsRecordSchema)),
});

// ── Environments ──────────────────────────────────────────────────────────────

const RobotsSchema = z.string(); // e.g. "index,follow" / "noindex,nofollow"

const EnvironmentSchema = z.object({
  url: desc(z.url(), 'Public origin of this environment.'),
  api: desc(z.optional(z.url()), 'API origin, when different from `url`.'),
  analytics: desc(z.optional(z.boolean()), 'Whether analytics fire in this environment.'),
  robots: desc(z.optional(RobotsSchema), 'Robots policy (e.g. "noindex,nofollow" for dev).'),
  variant: desc(z.optional(z.string()), 'Active `abTesting.variants` key for this environment.'),
});

// ── A/B testing ─────────────────────────────────────────────────────────────────

const AbVariantSchema = z.object({
  environment: z.string(),
  description: z.optional(z.string()),
  // Deliberate escape hatch: overrides are deep-merged into the raw config
  // before validation, so their shape is the config's own.
  overrides: z.optional(z.record(z.string(), z.unknown())),
});

// ── Fonts (Astro Fonts API projection) ──────────────────────────────────────────
// Font *loading* — a serialisable projection of Astro's `fonts:[…]` config. A
// loader maps `provider` (string) → `fontProviders.<name>()`. Distinct from the
// design-system font *tokens* (`designSystem.themes.<theme>.fonts` / typography.families),
// which reference the same `cssVariable`.

const FontProvider = z.enum([
  'google',
  'fontsource',
  'adobe',
  'bunny',
  'fontshare',
  'googleicons',
  'npm',
  'local',
]);
const FontStyle = z.enum(['normal', 'italic']);
const FontDisplay = z.enum(['auto', 'block', 'swap', 'fallback', 'optional']);
const FontWeight = z.union([z.number(), z.string()]); // discrete, or a variable range like "100 900"

/** A local-font face (`provider: 'local'`). */
const FontVariantSchema = z.object({
  src: z.array(z.string()),
  weight: z.optional(FontWeight),
  style: z.optional(FontStyle),
  unicodeRange: z.optional(z.array(z.string())),
  display: z.optional(FontDisplay),
});

export const SiteFontSchema = z.object({
  name: z.string(),
  provider: FontProvider,
  cssVariable: z.string().check(z.regex(/^--/)),
  weights: z.optional(z.array(FontWeight)),
  styles: z.optional(z.array(FontStyle)),
  subsets: z.optional(z.array(z.string())),
  fallbacks: z.optional(z.array(z.string())),
  optimizedFallbacks: z.optional(z.boolean()),
  display: z.optional(FontDisplay),
  formats: z.optional(z.array(z.string())),
  unicodeRange: z.optional(z.array(z.string())),
  variants: z.optional(z.array(FontVariantSchema)), // local provider
  preload: desc(
    z.optional(
      z.union([
        z.boolean(),
        z.array(z.object({ weight: FontWeight, style: z.optional(FontStyle) })),
      ]),
    ),
    'Emit `<Font preload />` for this family (true, or a list of weight/style faces).',
  ),
});

// ── Templates (nav / form / nodes) ──────────────────────────────────────────────

const PresentSchema = z.optional(z.record(z.string(), z.unknown()));

const NavItemSchema: z.ZodMiniType = z.object({
  label: z.optional(LocalizableSchema),
  image: z.optional(ImageRefSchema),
  href: z.optional(z.string()),
  icon: z.optional(z.string()),
  attrs: AttrsSchema,
  itemAttrs: AttrsSchema,
  submenu: z.optional(
    z.object({
      present: PresentSchema,
      get items() {
        return z.optional(z.array(NavItemSchema));
      },
    }),
  ),
});

const FormFieldType = z.enum([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'password',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'date',
  'file',
  'hidden',
]);

const FormFieldSchema = z.object({
  name: z.string(),
  type: FormFieldType,
  label: z.optional(LocalizableSchema),
  required: z.optional(z.boolean()),
  validation: z.optional(z.string()), // regex source or named rule
  options: z.optional(
    z.union([z.string(), z.array(z.object({ label: z.string(), value: z.string() }))]),
  ),
  attrs: AttrsSchema,
});

const ContentNodeSchema: z.ZodMiniType = z.object({
  tag: z.string(),
  attrs: AttrsSchema,
  text: z.optional(z.string()),
  get children() {
    return z.optional(z.array(ContentNodeSchema));
  },
});

const TemplateSchema = z.union([
  z.object({
    type: z.literal('nav'),
    tags: z.optional(z.array(z.string())),
    present: PresentSchema,
    items: z.optional(z.array(NavItemSchema)),
  }),
  z.object({
    type: z.literal('form'),
    tags: z.optional(z.array(z.string())),
    present: PresentSchema,
    action: z.optional(z.string()),
    method: z.optional(z.enum(['get', 'post'])),
    fields: z.optional(z.array(FormFieldSchema)),
    submit: z.optional(z.record(z.string(), AttrValue)),
    honeypot: z.optional(z.boolean()),
  }),
  z.object({
    type: z.literal('nodes'),
    tags: z.optional(z.array(z.string())),
    nodes: z.optional(z.array(ContentNodeSchema)),
  }),
]);

// ── Galleries / testimonials ────────────────────────────────────────────────────

const GalleryImageSchema = z.object({
  src: z.string(),
  alt: LocalizableSchema,
  caption: z.optional(LocalizableSchema),
});

const GallerySchema = z.object({
  title: z.optional(LocalizableSchema),
  tags: z.optional(z.array(z.string())),
  images: z.array(GalleryImageSchema),
});

const TestimonialItemSchema = z.object({
  quote: LocalizableSchema,
  name: z.string(),
  role: z.optional(z.string()),
  rating: z.optional(z.number().check(z.gte(0), z.lte(5))),
  date: z.optional(IsoDate),
});

const TestimonialGroupSchema = z.object({
  title: z.optional(LocalizableSchema),
  items: z.array(TestimonialItemSchema),
});

// ── Services (schema.org Offer) ─────────────────────────────────────────────────

const OfferSchema = z.object({
  name: z.optional(LocalizableSchema),
  price: z.optional(z.union([z.string(), z.number()])),
  priceCurrency: z.optional(Iso4217),
  availability: z.optional(z.string()),
  url: z.optional(z.url()),
  validFrom: z.optional(IsoDate),
  priceValidUntil: z.optional(IsoDate),
});

const ServiceSchema = z.object({
  name: LocalizableSchema,
  description: z.optional(LocalizableSchema),
  slug: z.optional(LocalizableSchema),
  offers: z.optional(z.array(OfferSchema)),
});

// ── SEO / social ─────────────────────────────────────────────────────────────

const OpenGraphSchema = z.object({
  type: z.optional(z.string()),
  siteName: z.optional(z.string()),
  title: z.optional(LocalizableSchema),
  description: z.optional(LocalizableSchema),
  image: z.optional(ImageRefSchema),
  locale: z.optional(z.string()),
});

const TwitterSchema = z.object({
  card: z.optional(z.enum(['summary', 'summary_large_image', 'app', 'player'])),
  site: z.optional(z.string()),
  creator: z.optional(z.string()),
  title: z.optional(LocalizableSchema),
  description: z.optional(LocalizableSchema),
  image: z.optional(ImageRefSchema),
});

// ── Indexing ────────────────────────────────────────────────────────────────────

/**
 * What `vitops notify` needs to tell search engines a deploy happened.
 *
 * Scoped by what search engines actually accept, which is narrower than it looks:
 * Google exposes **no** "request indexing" API (the Search Console button is not in
 * its API, and URL Inspection is read-only), and it removed the sitemap ping
 * endpoint in 2023. So the sanctioned set is: an accurate sitemap, a Search Console
 * sitemap resubmit, an IndexNow ping — which Google does *not* honour but Bing,
 * Yandex, Naver, Seznam and Yep do — and a read-only inspection pass to find out
 * what Google actually did.
 *
 * Facts only, the same rule the legal block follows: this records what the site has
 * (a key, a property, which pages matter), never what to say about it.
 */
const IndexNowSchema = z.object({
  key: desc(
    z.string().check(z.regex(/^[a-zA-Z0-9-]{8,128}$/)),
    'IndexNow key (8–128 chars, hex is conventional). NOT a secret — it is served publicly at `keyLocation` so the engine can verify you own the host. Generate one with `vitops notify --new-key`.',
  ),
  keyLocation: desc(
    z.optional(z.url()),
    'Absolute URL of the key file. Defaults to `<canonical>/<key>.txt`; set it only when the file lives elsewhere.',
  ),
  endpoint: desc(
    z.optional(z.url()),
    'IndexNow endpoint (default `https://api.indexnow.org/indexnow`). Any participating engine shares submissions with the rest, so one is normally enough.',
  ),
});

const SearchConsoleSchema = z.object({
  siteUrl: desc(
    z.string(),
    'The property exactly as Search Console identifies it — `sc-domain:acme.ca` for a domain property, or the URL-prefix form `https://acme.ca/`. A mismatch here is a 403, not a "not found".',
  ),
  resubmitSitemap: desc(
    z.optional(z.boolean()),
    'Re-submit the sitemap through the Search Console API on each notify (default true when `searchConsole` is set). This is the automated equivalent of the manual resubmit in the UI.',
  ),
});

const IndexingSchema = z.object({
  sitemapUrl: desc(
    z.optional(z.url()),
    'The sitemap to submit and to diff for changed URLs. Defaults to `<canonical>/sitemap-index.xml`.',
  ),
  indexNow: desc(
    z.optional(IndexNowSchema),
    'IndexNow submission (Bing, Yandex, Naver, Seznam, Yep — not Google). Omit to skip the channel.',
  ),
  searchConsole: desc(
    z.optional(SearchConsoleSchema),
    'Google Search Console property. Needs a service-account credential in `VITOPS_GSC_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` at run time — never put the key in this file.',
  ),
  priorityUrls: desc(
    z.optional(z.array(z.url())),
    'The pages whose indexing actually matters. `vitops notify --check` inspects these and exits non-zero if Google has not indexed one. Kept explicit because URL Inspection is quota-bound (2000/day), so checking every page is neither affordable nor informative.',
  ),
});

// ── Legal ───────────────────────────────────────────────────────────────────────

/**
 * Which template set the generated legal documents are written against. This is
 * a closed enum rather than a free string because an unrecognised value would
 * otherwise silently fall back to the wrong body of law; `validateConfig` rejects
 * anything without a registered template. Add a member here and a matching entry
 * in `legal/templates/index.ts` — the two are checked against each other.
 */
export const JURISDICTIONS = ['ca'] as const;
const JurisdictionSchema = z.enum(JURISDICTIONS);
export type Jurisdiction = (typeof JURISDICTIONS)[number];

/**
 * A third party that receives personal information. The generator derives the
 * ones it can see (analytics IDs, Turnstile, the deploy platform); this is for
 * the rest, which no other part of the config implies.
 *
 * Deliberately facts, not prose: the config records *what is true*, the template
 * owns *how it is said*. That keeps a policy correct when the wording changes.
 */
const ProcessorSchema = z.object({
  name: desc(z.string(), 'The provider, as a reader would recognise it (e.g. "Stripe").'),
  purpose: desc(
    z.string(),
    'Why they receive it, as a noun phrase that reads after "for" (e.g. "payment processing").',
  ),
  country: desc(
    z.optional(z.string()),
    'Where they process it, as it should read in a sentence (e.g. "the United States"). Feeds the cross-border-transfer disclosure.',
  ),
  privacyUrl: z.optional(z.url()),
});

// ── The `site` section ──────────────────────────────────────────────────────────
// This published site: where it lives, what it says, how it is built. Everything
// here is a fact about a *presentation* of the organization — swap the site and
// these change while `organization` does not.

const SiteSectionSchema = z.object({
  defaultLocale: desc(
    z.string(),
    'The locale used when none is specified; must be a `locales` key.',
  ),
  locales: desc(
    z.record(z.string(), LocaleSchema),
    'Locales the site is published in, keyed by BCP 47 tag (e.g. "en", "fr").',
  ),
  domains: desc(
    z.optional(
      z.object({
        canonical: desc(z.url(), 'The canonical origin used for absolute URLs and SEO.'),
        aliases: desc(
          z.optional(z.array(DomainAliasSchema)),
          'Alias domains and how they redirect to the canonical one.',
        ),
      }),
    ),
    'Canonical domain + redirecting aliases.',
  ),
  dns: desc(
    z.optional(z.record(z.string(), DnsDomainSchema)),
    'Desired DNS state per domain (provider, nameservers, records) — declarative reference, not applied automatically.',
  ),
  cloudflare: desc(
    z.optional(z.record(z.string(), z.unknown())),
    'Deliberate escape hatch for provider-specific Cloudflare settings — out of scope to model here.',
  ),
  environments: desc(
    z.record(z.string(), EnvironmentSchema),
    'Deploy environments (production, dev, …): URL, API origin, analytics toggle, robots policy, active A/B variant.',
  ),
  abTesting: desc(
    z.optional(
      z.object({
        enabled: z.boolean(),
        cookieName: z.optional(z.string()),
        cookieMaxAge: desc(z.optional(z.number().check(z.int(), z.positive())), 'Seconds.'),
        splitRatio: desc(
          z.optional(z.number().check(z.gte(0), z.lte(1))),
          'Fraction of traffic sent to the variant (0–1).',
        ),
        variants: desc(
          z.optional(z.record(z.string(), AbVariantSchema)),
          'Named variants; each targets an environment and may deep-merge config `overrides`.',
        ),
      }),
    ),
    'A/B testing: cookie-based split plus named variants whose `overrides` patch the config per environment.',
  ),
  fonts: desc(
    z.optional(z.array(SiteFontSchema)),
    'Font LOADING (a serialisable projection of the Astro Fonts API: provider, weights, subsets, preload). Font TOKENS live in `designSystem.themes.<theme>.fonts` and reference the same `cssVariable`.',
  ),

  tags: desc(
    z.optional(z.record(z.string(), z.unknown())),
    'Free-form content-tag taxonomy (site-specific; not interpreted by the generator).',
  ),
  postTypes: desc(
    z.optional(z.record(z.string(), z.unknown())),
    'Free-form content-type definitions (site-specific; not interpreted by the generator).',
  ),
  galleries: desc(
    z.optional(z.record(z.string(), GallerySchema)),
    'Named image galleries (title, tags, images with localisable alt/caption).',
  ),
  testimonials: desc(
    z.optional(z.record(z.string(), TestimonialGroupSchema)),
    'Named testimonial groups (quote, name, role, rating, date).',
  ),
  templates: desc(
    z.optional(z.record(z.string(), TemplateSchema)),
    'Named content templates rendered at SSR time: `nav` (menu trees), `form` (field lists + submit), or `nodes` (raw element trees).',
  ),
  navigation: desc(
    z.optional(
      z.object({
        activeTemplate: desc(
          z.optional(
            z.object({
              default: desc(z.optional(z.string()), 'A `templates` key.'),
              breakpoints: desc(
                z.optional(z.record(z.string(), z.string())),
                'Breakpoint name → `templates` key overrides.',
              ),
            }),
          ),
          'Which nav template is active, optionally per breakpoint.',
        ),
      }),
    ),
    'Site navigation settings (which nav template renders where).',
  ),
  seo: desc(
    z.optional(
      z.object({
        titleTemplate: desc(z.optional(z.string()), 'Page-title pattern (e.g. "%s · Acme").'),
        descriptionTemplate: z.optional(z.string()),
        robots: desc(z.optional(RobotsSchema), 'e.g. "index,follow" / "noindex,nofollow".'),
        googleSiteVerification: z.optional(z.string()),
        bingSiteVerification: z.optional(z.string()),
        openGraph: z.optional(OpenGraphSchema),
        twitter: z.optional(TwitterSchema),
        indexing: desc(
          z.optional(IndexingSchema),
          'How `vitops notify` tells search engines about a deploy: which sitemap, IndexNow key, Search Console property, and which pages to verify afterwards.',
        ),
      }),
    ),
    'SEO defaults: title/description templates, robots policy, verification tokens, Open Graph + Twitter cards, and post-deploy indexing notification.',
  ),
  analytics: desc(
    z.optional(
      z.object({
        googleAnalyticsId: z.optional(z.string()),
        plausibleDomain: z.optional(z.string()),
        googleTagManagerId: z.optional(z.string()),
        clarityId: desc(z.optional(z.string()), 'Microsoft Clarity project ID.'),
        matomo: desc(
          z.optional(
            z.object({
              url: desc(z.string(), 'Instance base URL (self-hosted, or `*.matomo.cloud`).'),
              siteId: desc(z.string(), 'Site ID within that instance.'),
              cookies: desc(
                z.optional(z.boolean()),
                'Default false — Matomo runs cookieless (`disableCookies`), which is what lets the cookie notice state positively that it sets none.',
              ),
            }),
          ),
          'Matomo instance.',
        ),
      }),
    ),
    'Analytics provider IDs (gated per environment via `environments.<env>.analytics`). Which provider is set is also what the generated privacy policy and cookie notice disclose — see `legal`.',
  ),
  notifications: desc(
    z.optional(z.object({ email: z.optional(z.email()) })),
    'Where site notifications (e.g. form submissions) are sent.',
  ),
  tracking: desc(
    z.optional(
      z.object({
        enabled: z.optional(z.boolean()),
        platforms: z.optional(z.array(z.string())),
      }),
    ),
    'Marketing/conversion tracking toggles per platform.',
  ),
  security: desc(
    z.optional(
      z.object({
        turnstile: z.optional(
          z.object({
            siteKey: desc(z.optional(z.string()), 'Cloudflare Turnstile site key (public).'),
          }),
        ),
      }),
    ),
    'Security integrations (bot protection).',
  ),
  legal: desc(
    z.optional(
      z.object({
        jurisdiction: desc(
          z.optional(JurisdictionSchema),
          'Which legal template set the generated documents use. Default `ca`.',
        ),
        privacyPolicy: z.optional(
          z.object({
            enabled: z.boolean(),
            url: z.optional(z.url()),
            lastUpdated: z.optional(IsoDate),
            privacyOfficer: desc(
              z.optional(ContactConfigSchema),
              'Who privacy requests go to. Falls back to `contact`, then `primaryLocation`.',
            ),
            retention: desc(
              z.optional(z.string()),
              'How long personal information is kept, in prose (e.g. "24 months after last contact").',
            ),
            processors: desc(
              z.optional(z.array(ProcessorSchema)),
              'Third parties that receive personal information and cannot be inferred from the rest of the config (payment processors, CRMs, mail senders). Known providers implied by `analytics`, `security` and `deployment` are added automatically — list only the rest.',
            ),
          }),
        ),
        termsOfService: z.optional(
          z.object({
            enabled: z.boolean(),
            url: z.optional(z.url()),
            lastUpdated: z.optional(z.nullable(IsoDate)),
            governingLaw: desc(
              z.optional(z.string()),
              'Governing-law clause, in prose (e.g. "the Province of Ontario"). Defaults from the contact address.',
            ),
          }),
        ),
        cookieConsent: z.optional(
          z.object({
            enabled: z.boolean(),
            type: desc(z.optional(z.enum(['opt-in', 'opt-out'])), 'Consent model.'),
            position: z.optional(z.enum(['top', 'bottom', 'center'])),
            categories: z.optional(z.array(z.string())),
          }),
        ),
      }),
    ),
    'Legal pages: which documents exist, where they live, and the facts the generated prose asserts.',
  ),
  icons: desc(
    z.optional(
      // LOOSE on purpose. The per-set keys below are the sets `iconMap` knows
      // semantically, but the value shape is "any iconify collection name → a
      // list of icons", which is open-ended by definition. A closed object
      // silently DROPPED unlisted collections (`icons: { ph: [...] }` vanished
      // in validateConfig with no error) while `generateIconInclude`'s parameter
      // type advertised `[prefix: string]` — so the config validated, the icons
      // never bundled, and the failure only showed as missing glyphs in prod.
      z.looseObject({
        ui: desc(z.optional(z.string()), 'Icon set used for UI chrome (e.g. "lucide", "ph").'),
        brand: desc(z.optional(z.string()), 'Icon set used for brand marks.'),
        weight: desc(
          z.optional(z.string()),
          'Weight for suffix-weighted sets like Phosphor ("regular" | "bold" | "duotone" | "fill" | "light" | "thin"). Ignored by sets that split weights across collections, e.g. Font Awesome.',
        ),
        sprite: desc(
          z.optional(z.boolean()),
          'Emit an SVG sprite (icons.svg) alongside the stylesheet, for consumers that cannot run an icon integration (Bricks/WordPress, EmDash renderers).',
        ),
        semantic: desc(z.optional(z.array(z.string())), 'Named semantic icons to include.'),
        'fa7-solid': z.optional(z.array(z.string())),
        'fa7-regular': z.optional(z.array(z.string())),
        'fa7-light': z.optional(z.array(z.string())),
        'fa7-thin': z.optional(z.array(z.string())),
        'fa7-brands': z.optional(z.array(z.string())),
        'simple-icons': z.optional(z.array(z.string())),
        'material-symbols': z.optional(z.array(z.string())),
        lucide: z.optional(z.array(z.string())),
        ph: z.optional(z.array(z.string())),
      }),
    ),
    'Icon sets and the specific icons to bundle from each (keys are iconify collection names).',
  ),
  favicon: desc(
    z.optional(
      z.object({
        source: desc(z.string(), 'Source image (SVG/PNG) the favicon set is generated from.'),
        lowResSource: desc(
          z.optional(z.string()),
          'Alternate source for small raster sizes (16/32px) when the main source scales down poorly.',
        ),
        name: desc(z.optional(z.string()), 'App name for the generated web manifest / PWA.'),
        themeColor: desc(
          z.optional(z.string()),
          'PWA theme color (also `<meta name="theme-color">`).',
        ),
        backgroundColor: desc(z.optional(z.string()), 'PWA background color.'),
      }),
    ),
    'Favicon/PWA asset generation (consumed by `@getvitops/utils` favicon tooling).',
  ),
  deployment: desc(
    z.optional(
      z.object({
        platform: z.optional(z.string()),
        buildCommand: z.optional(z.string()),
        deployCommand: z.optional(z.string()),
        outputDirectory: z.optional(z.string()),
        type: z.optional(z.string()),
      }),
    ),
    'How the site is built and deployed (platform, commands, output directory) — informational for tooling.',
  ),
});

// ── The `organization` section ──────────────────────────────────────────────────
// The company itself. `OrganizationSchema` above is the schema.org core; the
// section adds the things that describe the same entity rather than the site —
// where it operates, how to reach it, what it sells, where it can be found.
// Defined here rather than beside `OrganizationSchema` because it references
// `ServiceSchema`, which is declared further down.

const OrganizationSectionSchema = z.extend(OrganizationSchema, {
  contact: desc(
    z.optional(ContactConfigSchema),
    'Primary contact: either a `locations` key (string reference) or an inline name/email/phone/address object.',
  ),
  primaryLocation: desc(
    z.optional(z.string()),
    'The main `locations` key (for JSON-LD and defaults).',
  ),
  locations: desc(
    z.optional(z.record(z.string(), LocationSchema)),
    'Physical locations (schema.org LocalBusiness): address, geo, opening hours, service area.',
  ),
  services: desc(
    z.optional(z.record(z.string(), ServiceSchema)),
    'Services offered (schema.org Service/Offer): name, description, slug, price offers.',
  ),
  links: desc(
    z.optional(
      z.object({
        googleMaps: z.optional(z.url()),
        instagram: z.optional(z.url()),
        facebook: z.optional(z.url()),
        x: z.optional(z.url()),
        linkedin: z.optional(z.url()),
        youtube: z.optional(z.url()),
        github: z.optional(z.url()),
      }),
    ),
    'Public profile URLs (also feed JSON-LD `sameAs` via `organization.sameAs`).',
  ),
});

// ── Top-level schema ────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  designSystem: DesignSystemBlock,
  organization: desc(
    z.optional(OrganizationSectionSchema),
    'The company: schema.org Organization details for JSON-LD (name, legalName, logo, tax IDs, sameAs), plus its contact, physical locations, services and public profiles. These stay true across sites — several sites can share one `organization` and differ only in `site`.',
  ),
  site: desc(
    SiteSectionSchema,
    'This published site: locales, domains, environments, content templates, SEO, analytics, legal documents, icons, favicon and deployment. Facts about a *presentation* of the organization rather than the organization itself.',
  ),
});

export type Config = z.infer<typeof ConfigSchema>;
/** The `organization` section — the company, independent of any one site. */
export type OrganizationConfig = z.infer<typeof OrganizationSectionSchema>;
/** The `site` section — one published presentation of the organization. */
export type SiteSection = z.infer<typeof SiteSectionSchema>;
/** One `fonts[]` entry — a serialisable projection of an Astro Fonts API family. */
export type SiteFont = z.infer<typeof SiteFontSchema>;
/** The `seo.indexing` block — what `vitops notify` reads. */
export type SiteIndexing = z.infer<typeof IndexingSchema>;
/** IndexNow submission settings. The `key` is public by design. */
export type SiteIndexNow = z.infer<typeof IndexNowSchema>;
/** Google Search Console property settings. The credential is never in the config. */
export type SiteSearchConsole = z.infer<typeof SearchConsoleSchema>;

// ── JSON Schema + validation ────────────────────────────────────────────────────

export const CONFIG_SCHEMA_URL = 'https://unpkg.com/@getvitops/generator/config.schema.json';

/** The published JSON Schema (draft-2020-12), derived from the zod schema. */
export const configJsonSchema = {
  $id: CONFIG_SCHEMA_URL,
  ...z.toJSONSchema(ConfigSchema, { target: 'draft-2020-12' }),
};

export type ConfigValidationResult =
  | { ok: true; data: Config; errors: [] }
  | { ok: false; data: undefined; errors: z.core.$ZodIssue[] };

type Issue = z.core.$ZodIssue;
const issue = (path: (string | number)[], message: string): Issue =>
  ({ code: 'custom', path, message }) as Issue;

// ── Migration from the flat `SiteConfig` ────────────────────────────────────────

/**
 * Where each key of the old flat config now lives.
 *
 * This exists so the restructure fails with a sentence a reader can act on. Zod
 * reports a flat config as a dozen separate `unrecognized_keys` issues plus a
 * missing required `site` — an accurate description of the document that teaches
 * nobody where anything went. Checked first, and it short-circuits: once we know
 * the document is the old shape, every other error is downstream noise.
 */
const MOVED_KEYS: Record<string, 'site' | 'organization'> = {
  defaultLocale: 'site',
  locales: 'site',
  domains: 'site',
  dns: 'site',
  cloudflare: 'site',
  environments: 'site',
  abTesting: 'site',
  fonts: 'site',
  tags: 'site',
  postTypes: 'site',
  galleries: 'site',
  testimonials: 'site',
  templates: 'site',
  navigation: 'site',
  seo: 'site',
  analytics: 'site',
  notifications: 'site',
  tracking: 'site',
  security: 'site',
  legal: 'site',
  icons: 'site',
  favicon: 'site',
  deployment: 'site',
  contact: 'organization',
  primaryLocation: 'organization',
  locations: 'organization',
  services: 'organization',
  links: 'organization',
};

/**
 * Detect the pre-3.0 flat shape and name the moves.
 *
 * Keyed on a moved key sitting at the ROOT, not on the absence of `site` — a
 * config that simply forgot `site` should get the ordinary "required" error, and
 * a partially-migrated one (some keys moved, some not) is exactly the case worth
 * catching loudly.
 */
function migrationIssues(raw: unknown): Issue[] {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return [];
  const found = Object.keys(raw).filter((k) => k in MOVED_KEYS);
  if (found.length === 0) return [];
  const moves = found.map((k) => `  ${k} → ${MOVED_KEYS[k]}.${k}`).join('\n');
  return [
    issue(
      [],
      'this is the pre-3.0 flat site config. The top level is now three sections — ' +
        '`designSystem`, `organization`, `site` — and these keys moved:\n' +
        `${moves}\n` +
        '`designSystem` and the fields already under `organization` stay where they are.',
    ),
  ];
}

/**
 * Validate a raw (already parsed) config: shape via zod, then the cross-field
 * integrity that JSON Schema can't express (referential keys, extends acyclicity).
 * These live only here — the published JSON Schema enforces shape, not integrity.
 */
export function validateConfig(input: unknown): ConfigValidationResult {
  const migration = migrationIssues(input);
  if (migration.length) return { ok: false, data: undefined, errors: migration };

  const parsed = z.safeParse(ConfigSchema, input);
  if (!parsed.success) return { ok: false, data: undefined, errors: parsed.error.issues };
  const cfg = parsed.data;
  const site = cfg.site;
  const org = cfg.organization;
  const errors: Issue[] = [];
  const has = (m: Record<string, unknown> | undefined, k: string) => !!m && k in m;

  if (!has(site.locales, site.defaultLocale))
    errors.push(
      issue(['site', 'defaultLocale'], `defaultLocale "${site.defaultLocale}" is not in locales`),
    );

  const themes = cfg.designSystem?.themes ?? {};
  const defaultTheme = cfg.designSystem?.defaultTheme;

  if (!has(themes, 'default') && defaultTheme == null)
    errors.push(issue(['designSystem', 'themes'], 'themes must include a "default" entry'));

  if (defaultTheme != null && !has(themes, defaultTheme))
    errors.push(
      issue(
        ['designSystem', 'defaultTheme'],
        `defaultTheme "${defaultTheme}" is not in designSystem.themes`,
      ),
    );

  for (const [key, entry] of Object.entries(themes)) {
    if (entry.extends != null && !has(themes, entry.extends))
      errors.push(
        issue(
          ['designSystem', 'themes', key, 'extends'],
          `extends "${entry.extends}" is not a themes key`,
        ),
      );
  }
  // extends acyclicity + each resolved theme is a complete DesignSystem
  for (const key of Object.keys(themes)) {
    try {
      resolveTheme(themes as Record<string, DesignSystemEntryT>, key);
    } catch (e) {
      errors.push(issue(['designSystem', 'themes', key], (e as Error).message));
    }
  }

  if (org?.primaryLocation != null && !has(org.locations, org.primaryLocation))
    errors.push(
      issue(
        ['organization', 'primaryLocation'],
        `primaryLocation "${org.primaryLocation}" is not in organization.locations`,
      ),
    );
  if (typeof org?.contact === 'string' && !has(org.locations, org.contact))
    errors.push(
      issue(
        ['organization', 'contact'],
        `contact "${org.contact}" is not an organization.locations key`,
      ),
    );

  for (const [name, v] of Object.entries(site.abTesting?.variants ?? {}))
    if (!has(site.environments, v.environment))
      errors.push(
        issue(
          ['site', 'abTesting', 'variants', name, 'environment'],
          `environment "${v.environment}" is not in site.environments`,
        ),
      );
  for (const [i, a] of (site.domains?.aliases ?? []).entries())
    if (a.environment != null && !has(site.environments, a.environment))
      errors.push(
        issue(
          ['site', 'domains', 'aliases', i, 'environment'],
          `environment "${a.environment}" is not in site.environments`,
        ),
      );

  const templates = site.templates;
  const at = site.navigation?.activeTemplate;
  if (at?.default != null && !has(templates, at.default))
    errors.push(
      issue(
        ['site', 'navigation', 'activeTemplate', 'default'],
        `template "${at.default}" is not in site.templates`,
      ),
    );
  for (const [bp, tpl] of Object.entries(at?.breakpoints ?? {}))
    if (!has(templates, tpl))
      errors.push(
        issue(
          ['site', 'navigation', 'activeTemplate', 'breakpoints', bp],
          `template "${tpl}" is not in site.templates`,
        ),
      );

  // Legal. An enabled document is a promise to publish a specific, correct
  // sentence — so the inputs those sentences interpolate are required here
  // rather than allowed to render as a blank. `jurisdiction` needs no check:
  // the enum rejects an unregistered value at parse time.
  const privacy = site.legal?.privacyPolicy;
  if (typeof privacy?.privacyOfficer === 'string' && !has(org?.locations, privacy.privacyOfficer))
    errors.push(
      issue(
        ['site', 'legal', 'privacyPolicy', 'privacyOfficer'],
        `privacyOfficer "${privacy.privacyOfficer}" is not an organization.locations key`,
      ),
    );
  if (privacy?.enabled) {
    if (resolvePrivacyContact(cfg) == null)
      errors.push(
        issue(
          ['site', 'legal', 'privacyPolicy'],
          'privacyPolicy.enabled requires a contact for privacy requests — set site.legal.privacyPolicy.privacyOfficer, organization.contact, or organization.email/address',
        ),
      );
    if (site.domains?.canonical == null)
      errors.push(
        issue(
          ['site', 'legal', 'privacyPolicy'],
          'privacyPolicy.enabled requires site.domains.canonical — the policy states where information is held',
        ),
      );
  }

  // Indexing. Both defaults (the sitemap URL and the IndexNow key location) are
  // built from `domains.canonical`, so without it the block is unresolvable —
  // and the failure would otherwise surface at deploy time, as a submission
  // against `undefined/sitemap-index.xml`, rather than here.
  const indexing = site.seo?.indexing;
  if (indexing != null && site.domains?.canonical == null) {
    if (indexing.sitemapUrl == null)
      errors.push(
        issue(
          ['site', 'seo', 'indexing', 'sitemapUrl'],
          'site.seo.indexing needs site.domains.canonical to derive the sitemap URL — set one, or state sitemapUrl explicitly',
        ),
      );
    if (indexing.indexNow != null && indexing.indexNow.keyLocation == null)
      errors.push(
        issue(
          ['site', 'seo', 'indexing', 'indexNow', 'keyLocation'],
          'site.seo.indexing.indexNow needs site.domains.canonical to derive the key location — set one, or state keyLocation explicitly',
        ),
      );
  }

  if (errors.length) return { ok: false, data: undefined, errors };
  return { ok: true, data: cfg, errors: [] };
}

/**
 * Resolve who privacy requests go to: the explicit privacy officer, else the
 * organization's contact, else its primary location, else the organization itself.
 *
 * Exported because `validateConfig` and the legal-document derivation must agree
 * on it exactly — a config that validates must be one the policy can render, and
 * two copies of this precedence would drift into a policy with a blank address.
 *
 * Note every candidate but the first now lives in `organization`, and the first
 * (`site.legal.privacyPolicy.privacyOfficer`) still dereferences against
 * `organization.locations` — the officer is a person at the company, named by the
 * site because a company may publish more than one policy.
 */
export function resolvePrivacyContact(cfg: Config): ContactObject | undefined {
  const org = cfg.organization;
  // A location's `name` is Localizable and a contact's is a plain string; the
  // name is not used in the rendered address, so drop it rather than pick a locale.
  const deref = (c: string | ContactObject | undefined): ContactObject | undefined => {
    if (c == null) return undefined;
    if (typeof c !== 'string') return c;
    const loc = org?.locations?.[c];
    return loc && { email: loc.email, phone: loc.phone, address: loc.address };
  };
  const candidates = [
    deref(cfg.site.legal?.privacyPolicy?.privacyOfficer),
    deref(org?.contact),
    deref(org?.primaryLocation),
    org && { email: org.email, phone: org.phone, address: org.address },
  ];
  // A contact with no reachable channel is not a contact — skip to the next.
  return candidates.find((c) => c != null && (c.email != null || c.address != null));
}

// ── Theme resolution (extends) ──────────────────────────────────────────────────

type DesignSystemEntryT = Partial<DesignSystem> & { displayName?: unknown; extends?: string };

/**
 * Resolve a design-system theme by following its `extends` chain and deep-merging
 * base → child (child wins; arrays replace wholesale, correct for token overrides).
 * Throws on unknown keys or an `extends` cycle. The result is a plain
 * `DesignSystem` (validate it against `DesignSystemSchema` for completeness).
 */
export function resolveTheme(
  designSystem: Record<string, DesignSystemEntryT>,
  key: string,
): DesignSystem {
  const chain: DesignSystemEntryT[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = key;
  while (cur != null) {
    if (seen.has(cur)) throw new Error(`extends cycle in designSystem at "${cur}"`);
    seen.add(cur);
    const entry: DesignSystemEntryT | undefined = designSystem[cur];
    if (entry == null) throw new Error(`designSystem theme "${cur}" not found`);
    chain.unshift(entry);
    cur = entry.extends;
  }
  const out: Record<string, unknown> = {};
  for (const entry of chain) {
    const { extends: _e, displayName: _d, ...ds } = entry;
    deepMerge(out, ds as Record<string, unknown>);
  }
  return out as DesignSystem;
}

/**
 * Normalise the two `designSystem` shorthands to the canonical
 * `{ themes: { … } }` shape.
 *
 * Both are keyed off what CANNOT be a theme name in the other reading:
 *  - `colors` → a bare `DesignSystem` was written inline.
 *  - `themes` → already canonical.
 *  - neither → the legacy bare theme map, from before the block gained
 *    system-wide fields. Every config authored against the old schema takes this
 *    branch, which is what keeps the change forgiving at runtime even though the
 *    published JSON Schema moved.
 */
function normaliseDesignSystem(raw: Record<string, unknown>): void {
  const ds = raw.designSystem as Record<string, unknown> | undefined;
  if (ds == null || typeof ds !== 'object') return;
  if ('themes' in ds) return;
  raw.designSystem = 'colors' in ds ? { themes: { default: ds } } : { themes: ds };
}

/**
 * Resolve a raw (already-parsed) config into a validated `Config`:
 *  1. strip YAML nulls,
 *  2. normalise the `designSystem` shorthands to `{ themes: … }`,
 *  3. apply the active A/B variant's `overrides` (by `siteEnv`),
 *  4. validate (shape + cross-field).
 * Pure — no YAML/env access. A loader supplies `siteEnv`.
 *
 * Steps 2 and 3 are in this order deliberately. Normalising first means an
 * `abTesting` override always addresses the canonical shape
 * (`designSystem.themes.<name>`), whatever shorthand the base config used. With
 * the merge first, an override's key path depended on how the base happened to be
 * written — so the same patch hit a different place in two configs that were
 * otherwise equivalent.
 *
 * The A/B lookup reads `site.environments` / `site.abTesting`, and the overrides
 * still deep-merge at the **root** — a variant patches whichever section it names,
 * which is what lets one target `designSystem` and another `site.seo`.
 */
export function resolveConfig(input: unknown, siteEnv = 'production'): Config {
  const raw = stripNulls(input) as Record<string, unknown>;

  normaliseDesignSystem(raw);

  const site = raw.site as Record<string, unknown> | undefined;
  const envConfig = (site?.environments as Record<string, { variant?: string }> | undefined)?.[
    siteEnv
  ];
  if (envConfig?.variant) {
    const overrides = (
      site?.abTesting as { variants?: Record<string, { overrides?: Record<string, unknown> }> }
    )?.variants?.[envConfig.variant]?.overrides;
    if (overrides) {
      // An override may itself use a shorthand; normalise it to the same shape or
      // deepMerge would nest a bare map under the canonical one.
      normaliseDesignSystem(overrides);
      deepMerge(raw, overrides);
    }
  }

  const result = validateConfig(raw);
  if (!result.ok) {
    const msg = result.errors
      .map((e) => `  ${e.path.join('.') || '<root>'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid config:\n${msg}`);
  }
  return result.data;
}

// ── Accepting either config kind ────────────────────────────────────────────────

/**
 * Is this raw config a full `Config` rather than a bare `design-system.json`?
 *
 * The discriminator is **total**, not a heuristic, and both halves are load-
 * bearing: `ConfigSchema` cannot validate without a `designSystem` (it is a
 * required key), and `DesignSystemSchema` is strict, so a `designSystem` key in a
 * design system is an `unrecognized_keys` error. No document can be read as both,
 * and no document that is neither reaches here without failing validation anyway.
 *
 * The restructure did not weaken this: `designSystem` stayed at the root
 * precisely so the discriminator kept working unchanged.
 *
 * Deliberately shape-based rather than filename-based: consumers name this file
 * whatever suits them (`company.json`, `site.json`, `vitops.config.json`), and a
 * rule keyed to a name would silently stop working the moment someone renamed it.
 */
export function isConfig(raw: unknown): boolean {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw) && 'designSystem' in raw;
}

/** What a config file turned out to hold. */
export interface ResolvedInput {
  /** The design system to build from — a resolved theme, if the input was a full `Config`. */
  designSystem: DesignSystem;
  /** The whole config, when that is what the input was. */
  config?: Config;
  /** Which `themes` key was selected. Absent for a bare `design-system.json`. */
  theme?: string;
}

/**
 * Resolve a raw config of either kind into the design system to build from.
 *
 * Every entry point that used to take a `design-system.json` goes through this,
 * so a consumer who keeps their tokens inside the larger config points the
 * same option at that file instead of maintaining a second one. The config
 * is handed back too, because the parts of generation that depend on site-level
 * facts (`designSystem.defaultColorScheme`, the legal documents, the icon
 * sprite) would otherwise need the same path declared a second time.
 *
 * The returned `designSystem` is **not** validated here — the caller does that,
 * so it can say which file and which theme the errors belong to. Validation of
 * the config itself has already happened (`resolveConfig` throws).
 */
export function resolveInput(
  raw: unknown,
  opts: { theme?: string; siteEnv?: string } = {},
): ResolvedInput {
  if (!isConfig(raw)) {
    if (opts.theme != null)
      throw new Error(
        `theme "${opts.theme}" was requested, but this is a design-system.json — it holds one ` +
          'design system and no `themes` map. Point at a full config to select a theme.',
      );
    return { designSystem: raw as DesignSystem };
  }
  const config = resolveConfig(raw, opts.siteEnv);
  const themes = (config.designSystem?.themes ?? {}) as Record<string, DesignSystemEntryT>;
  const theme = opts.theme ?? config.designSystem?.defaultTheme ?? 'default';
  if (!(theme in themes))
    throw new Error(
      `designSystem.themes has no "${theme}" entry (found: ${Object.keys(themes).join(', ') || 'none'})`,
    );
  return { designSystem: resolveTheme(themes, theme), config, theme };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Strip nulls (YAML `~`/`null`) → undefined so optional fields validate. */
export function stripNulls(obj: unknown): unknown {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const stripped = stripNulls(value);
      if (stripped !== undefined) result[key] = stripped;
    }
    return result;
  }
  return obj;
}

/** Deep-merge `source` into `target` (in place). Arrays replace wholesale. */
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = target[key];
    if (
      s &&
      typeof s === 'object' &&
      !Array.isArray(s) &&
      t &&
      typeof t === 'object' &&
      !Array.isArray(t)
    ) {
      deepMerge(t as Record<string, unknown>, s as Record<string, unknown>);
    } else {
      target[key] = s;
    }
  }
}
