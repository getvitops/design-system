/**
 * Company / site-level configuration schema — the umbrella around a
 * `design-system.json`-compliant `designSystem`.
 *
 * Authored with `zod/mini` (same instance the design-system schema uses), so the
 * two compose: `DesignSystemSchema` is embedded as `designSystem.<theme>` and the
 * whole thing serialises to one JSON Schema via `z.toJSONSchema`. Everything a
 * generator needs derives from here: the `SiteConfig` type (`z.infer`), the
 * published JSON Schema (`siteJsonSchema`), and runtime validation (`validateSite`).
 *
 * Pure: no YAML/env/fs. `resolveSiteConfig` takes an already-parsed object; a
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

// ── Design system (named-theme map) ─────────────────────────────────────────────
// Each entry is a full `DesignSystem` plus a localised `displayName` and an
// optional `extends` (another entry's key). Entries are lenient (all top-level
// fields optional) so an extending entry can be a partial patch; the resolved
// theme is validated against the full `DesignSystemSchema` by `resolveTheme`.

const DesignSystemEntry = z.extend(DesignSystemPatchSchema, {
  displayName: desc(z.optional(LocalizableSchema), 'Human-readable theme name (localisable).'),
  extends: desc(
    z.optional(z.string()),
    'Another `designSystem` key to inherit from; this entry then only supplies what it overrides.',
  ),
});

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
  name: z.optional(LocalizableSchema),
  legalName: z.optional(z.string()),
  foundingDate: z.optional(IsoDate),
  logo: z.optional(ImageRefSchema),
  email: z.optional(z.email()),
  phone: z.optional(z.string()),
  address: z.optional(PostalAddressSchema),
  taxID: z.optional(z.string()),
  vatID: z.optional(z.string()),
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
// design-system font *tokens* (`designSystem.<theme>.fonts` / typography.families),
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

const FontSchema = z.object({
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

// ── Legal ───────────────────────────────────────────────────────────────────────

/**
 * Which template set the generated legal documents are written against. This is
 * a closed enum rather than a free string because an unrecognised value would
 * otherwise silently fall back to the wrong body of law; `validateSite` rejects
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

// ── Top-level schema ────────────────────────────────────────────────────────────

export const SiteConfigSchema = z.object({
  defaultLocale: desc(
    z.string(),
    'The locale used when none is specified; must be a `locales` key.',
  ),
  locales: desc(
    z.record(z.string(), LocaleSchema),
    'Locales the site is published in, keyed by BCP 47 tag (e.g. "en", "fr").',
  ),
  organization: desc(
    z.optional(OrganizationSchema),
    'schema.org Organization details for JSON-LD (name, legalName, logo, tax IDs, sameAs profiles).',
  ),
  contact: desc(
    z.optional(ContactConfigSchema),
    'Primary contact: either a `locations` key (string reference) or an inline name/email/phone/address object.',
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

  designSystem: desc(
    z.record(z.string(), DesignSystemEntry),
    'Named-theme map of design systems. `default` is the base; other entries may `extends` another and supply a partial patch. Light/dark is automatic (functional tokens flip per appearance), not a separate theme entry. A bare design system (with `colors`) is shorthand for `{ default: … }`.',
  ),
  defaultTheme: desc(
    z.optional(z.string()),
    'Which `designSystem` entry to use by default (convention: "default").',
  ),
  defaultColorScheme: desc(
    z.optional(z.enum(['light', 'dark'])),
    'Initial appearance to render before any user/system preference applies.',
  ),
  respectSystemPreference: desc(
    z.optional(z.boolean()),
    "Follow the user's OS light/dark preference.",
  ),

  fonts: desc(
    z.optional(z.array(FontSchema)),
    'Font LOADING (a serialisable projection of the Astro Fonts API: provider, weights, subsets, preload). Font TOKENS live in `designSystem.<theme>.fonts` and reference the same `cssVariable`.',
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
      }),
    ),
    'SEO defaults: title/description templates, robots policy, verification tokens, Open Graph + Twitter cards.',
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
      z.object({
        ui: desc(z.optional(z.string()), 'Icon set used for UI chrome (e.g. "lucide").'),
        brand: desc(z.optional(z.string()), 'Icon set used for brand marks.'),
        semantic: desc(z.optional(z.array(z.string())), 'Named semantic icons to include.'),
        'fa7-solid': z.optional(z.array(z.string())),
        'fa7-regular': z.optional(z.array(z.string())),
        'fa7-light': z.optional(z.array(z.string())),
        'fa7-thin': z.optional(z.array(z.string())),
        'fa7-brands': z.optional(z.array(z.string())),
        'simple-icons': z.optional(z.array(z.string())),
        'material-symbols': z.optional(z.array(z.string())),
        lucide: z.optional(z.array(z.string())),
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

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

// ── JSON Schema + validation ────────────────────────────────────────────────────

export const SITE_SCHEMA_URL = 'https://unpkg.com/@getvitops/generator/site.schema.json';

/** The published JSON Schema (draft-2020-12), derived from the zod schema. */
export const siteJsonSchema = {
  $id: SITE_SCHEMA_URL,
  ...z.toJSONSchema(SiteConfigSchema, { target: 'draft-2020-12' }),
};

export type SiteValidationResult =
  | { ok: true; data: SiteConfig; errors: [] }
  | { ok: false; data: undefined; errors: z.core.$ZodIssue[] };

type Issue = z.core.$ZodIssue;
const issue = (path: (string | number)[], message: string): Issue =>
  ({ code: 'custom', path, message }) as Issue;

/**
 * Validate a raw (already parsed) config: shape via zod, then the cross-field
 * integrity that JSON Schema can't express (referential keys, extends acyclicity).
 * These live only here — the published JSON Schema enforces shape, not integrity.
 */
export function validateSite(input: unknown): SiteValidationResult {
  const parsed = z.safeParse(SiteConfigSchema, input);
  if (!parsed.success) return { ok: false, data: undefined, errors: parsed.error.issues };
  const cfg = parsed.data;
  const errors: Issue[] = [];
  const has = (m: Record<string, unknown> | undefined, k: string) => !!m && k in m;

  if (!has(cfg.locales, cfg.defaultLocale))
    errors.push(issue(['defaultLocale'], `defaultLocale "${cfg.defaultLocale}" is not in locales`));

  if (!has(cfg.designSystem, 'default') && cfg.defaultTheme == null)
    errors.push(issue(['designSystem'], 'designSystem must include a "default" theme'));

  if (cfg.defaultTheme != null && !has(cfg.designSystem, cfg.defaultTheme))
    errors.push(
      issue(['defaultTheme'], `defaultTheme "${cfg.defaultTheme}" is not in designSystem`),
    );

  for (const [key, entry] of Object.entries(cfg.designSystem)) {
    if (entry.extends != null && !has(cfg.designSystem, entry.extends))
      errors.push(
        issue(
          ['designSystem', key, 'extends'],
          `extends "${entry.extends}" is not a designSystem key`,
        ),
      );
  }
  // extends acyclicity + each resolved theme is a complete DesignSystem
  for (const key of Object.keys(cfg.designSystem)) {
    try {
      resolveTheme(cfg.designSystem as Record<string, DesignSystemEntryT>, key);
    } catch (e) {
      errors.push(issue(['designSystem', key], (e as Error).message));
    }
  }

  if (cfg.primaryLocation != null && !has(cfg.locations, cfg.primaryLocation))
    errors.push(
      issue(['primaryLocation'], `primaryLocation "${cfg.primaryLocation}" is not in locations`),
    );
  if (typeof cfg.contact === 'string' && !has(cfg.locations, cfg.contact))
    errors.push(issue(['contact'], `contact "${cfg.contact}" is not a locations key`));

  for (const [name, v] of Object.entries(cfg.abTesting?.variants ?? {}))
    if (!has(cfg.environments, v.environment))
      errors.push(
        issue(
          ['abTesting', 'variants', name, 'environment'],
          `environment "${v.environment}" is not in environments`,
        ),
      );
  for (const [i, a] of (cfg.domains?.aliases ?? []).entries())
    if (a.environment != null && !has(cfg.environments, a.environment))
      errors.push(
        issue(
          ['domains', 'aliases', i, 'environment'],
          `environment "${a.environment}" is not in environments`,
        ),
      );

  const templates = cfg.templates;
  const at = cfg.navigation?.activeTemplate;
  if (at?.default != null && !has(templates, at.default))
    errors.push(
      issue(
        ['navigation', 'activeTemplate', 'default'],
        `template "${at.default}" is not in templates`,
      ),
    );
  for (const [bp, tpl] of Object.entries(at?.breakpoints ?? {}))
    if (!has(templates, tpl))
      errors.push(
        issue(
          ['navigation', 'activeTemplate', 'breakpoints', bp],
          `template "${tpl}" is not in templates`,
        ),
      );

  // Legal. An enabled document is a promise to publish a specific, correct
  // sentence — so the inputs those sentences interpolate are required here
  // rather than allowed to render as a blank. `jurisdiction` needs no check:
  // the enum rejects an unregistered value at parse time.
  const privacy = cfg.legal?.privacyPolicy;
  if (typeof privacy?.privacyOfficer === 'string' && !has(cfg.locations, privacy.privacyOfficer))
    errors.push(
      issue(
        ['legal', 'privacyPolicy', 'privacyOfficer'],
        `privacyOfficer "${privacy.privacyOfficer}" is not a locations key`,
      ),
    );
  if (privacy?.enabled) {
    if (resolvePrivacyContact(cfg) == null)
      errors.push(
        issue(
          ['legal', 'privacyPolicy'],
          'privacyPolicy.enabled requires a contact for privacy requests — set legal.privacyPolicy.privacyOfficer, contact, or organization.email/address',
        ),
      );
    if (cfg.domains?.canonical == null)
      errors.push(
        issue(
          ['legal', 'privacyPolicy'],
          'privacyPolicy.enabled requires domains.canonical — the policy states where information is held',
        ),
      );
  }

  if (errors.length) return { ok: false, data: undefined, errors };
  return { ok: true, data: cfg, errors: [] };
}

/**
 * Resolve who privacy requests go to: the explicit privacy officer, else the
 * site contact, else the primary location, else the organization itself.
 *
 * Exported because `validateSite` and the legal-document derivation must agree
 * on it exactly — a config that validates must be one the policy can render, and
 * two copies of this precedence would drift into a policy with a blank address.
 */
export function resolvePrivacyContact(cfg: SiteConfig): ContactObject | undefined {
  // A location's `name` is Localizable and a contact's is a plain string; the
  // name is not used in the rendered address, so drop it rather than pick a locale.
  const deref = (c: string | ContactObject | undefined): ContactObject | undefined => {
    if (c == null) return undefined;
    if (typeof c !== 'string') return c;
    const loc = cfg.locations?.[c];
    return loc && { email: loc.email, phone: loc.phone, address: loc.address };
  };
  const org = cfg.organization;
  const candidates = [
    deref(cfg.legal?.privacyPolicy?.privacyOfficer),
    deref(cfg.contact),
    deref(cfg.primaryLocation),
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
 * Resolve a raw (already-parsed) config into a validated `SiteConfig`:
 *  1. strip YAML nulls,
 *  2. apply the active A/B variant's `overrides` (by `siteEnv`),
 *  3. normalise a bare-`DesignSystem` `designSystem` shorthand to `{ default: … }`,
 *  4. validate (shape + cross-field).
 * Pure — no YAML/env access. A loader supplies `siteEnv`.
 */
export function resolveSiteConfig(input: unknown, siteEnv = 'production'): SiteConfig {
  const raw = stripNulls(input) as Record<string, unknown>;

  const envConfig = (raw.environments as Record<string, { variant?: string }> | undefined)?.[
    siteEnv
  ];
  if (envConfig?.variant) {
    const overrides = (
      raw.abTesting as { variants?: Record<string, { overrides?: Record<string, unknown> }> }
    )?.variants?.[envConfig.variant]?.overrides;
    if (overrides) deepMerge(raw, overrides);
  }

  // Shorthand: a bare DesignSystem (has `colors`) → { default: … }.
  const ds = raw.designSystem as Record<string, unknown> | undefined;
  if (ds != null && 'colors' in ds) raw.designSystem = { default: ds };

  const result = validateSite(raw);
  if (!result.ok) {
    const msg = result.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid site config:\n${msg}`);
  }
  return result.data;
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
