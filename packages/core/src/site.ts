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
import { DesignSystemPatchSchema, type DesignSystem } from './schema.ts';

// ── Primitives ────────────────────────────────────────────────────────────────

/** A string, or a per-locale map of strings (`{ en: "…", fr: "…" }`). */
const LocalizableSchema = z.union([z.string(), z.record(z.string(), z.string())]);

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
  displayName: z.optional(LocalizableSchema),
  extends: z.optional(z.string()),
});

// ── Locales ─────────────────────────────────────────────────────────────────────

const LocaleSchema = z.object({
  name: z.string(),
  tagline: z.optional(z.string()),
  basePath: z.optional(z.string()),
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

/** schema.org `PostalAddress` field names, so JSON-LD generation is lossless. */
const PostalAddressSchema = z.object({
  streetAddress: z.string(),
  addressLocality: z.string(), // city
  addressRegion: z.optional(z.string()), // state/province
  postalCode: z.optional(z.string()),
  addressCountry: z.string(), // ISO 3166-1 alpha-2 preferred
});

const ContactObjectSchema = z.object({
  name: z.optional(z.string()),
  email: z.optional(z.email()),
  phone: z.optional(z.string()),
  address: z.optional(PostalAddressSchema),
});

// contact is either a string (location key reference) or an inline object
const ContactConfigSchema = z.union([z.string(), ContactObjectSchema]);

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
  /** Profile URLs → JSON-LD `sameAs` (mirrors `links`). */
  sameAs: z.optional(z.array(z.url())),
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
  url: z.url(),
  api: z.optional(z.url()),
  analytics: z.optional(z.boolean()),
  robots: z.optional(RobotsSchema),
  variant: z.optional(z.string()),
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
  /** Emit `<Font preload />` for this family. */
  preload: z.optional(
    z.union([z.boolean(), z.array(z.object({ weight: FontWeight, style: z.optional(FontStyle) }))]),
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

// ── Top-level schema ────────────────────────────────────────────────────────────

export const SiteConfigSchema = z.object({
  defaultLocale: z.string(),
  locales: z.record(z.string(), LocaleSchema),
  organization: z.optional(OrganizationSchema),
  contact: z.optional(ContactConfigSchema),
  domains: z.optional(
    z.object({
      canonical: z.url(),
      aliases: z.optional(z.array(DomainAliasSchema)),
    }),
  ),
  primaryLocation: z.optional(z.string()),
  locations: z.optional(z.record(z.string(), LocationSchema)),
  services: z.optional(z.record(z.string(), ServiceSchema)),
  links: z.optional(
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
  dns: z.optional(z.record(z.string(), DnsDomainSchema)),
  // Deliberate escape hatch — provider-specific, out of scope to model here.
  cloudflare: z.optional(z.record(z.string(), z.unknown())),
  environments: z.record(z.string(), EnvironmentSchema),
  abTesting: z.optional(
    z.object({
      enabled: z.boolean(),
      cookieName: z.optional(z.string()),
      cookieMaxAge: z.optional(z.number().check(z.int(), z.positive())),
      splitRatio: z.optional(z.number().check(z.gte(0), z.lte(1))),
      variants: z.optional(z.record(z.string(), AbVariantSchema)),
    }),
  ),

  // Design system: named-theme map. `default` is the base; other entries may
  // `extends` another and supply a partial patch. Light/dark lives *inside* an
  // entry (design-system `colors.schemes`), not as separate entries.
  designSystem: z.record(z.string(), DesignSystemEntry),
  defaultTheme: z.optional(z.string()), // convention: "default"
  defaultColorScheme: z.optional(z.enum(['light', 'dark'])), // initial appearance to render
  respectSystemPreference: z.optional(z.boolean()),

  // Font *loading* (Astro Fonts API). Font *tokens* live in `designSystem`.
  fonts: z.optional(z.array(FontSchema)),

  tags: z.optional(z.record(z.string(), z.unknown())),
  postTypes: z.optional(z.record(z.string(), z.unknown())),
  galleries: z.optional(z.record(z.string(), GallerySchema)),
  testimonials: z.optional(z.record(z.string(), TestimonialGroupSchema)),
  templates: z.optional(z.record(z.string(), TemplateSchema)),
  navigation: z.optional(
    z.object({
      activeTemplate: z.optional(
        z.object({
          default: z.optional(z.string()),
          breakpoints: z.optional(z.record(z.string(), z.string())),
        }),
      ),
    }),
  ),
  seo: z.optional(
    z.object({
      titleTemplate: z.optional(z.string()),
      descriptionTemplate: z.optional(z.string()),
      robots: z.optional(RobotsSchema),
      googleSiteVerification: z.optional(z.string()),
      bingSiteVerification: z.optional(z.string()),
      openGraph: z.optional(OpenGraphSchema),
      twitter: z.optional(TwitterSchema),
    }),
  ),
  analytics: z.optional(
    z.object({
      googleAnalyticsId: z.optional(z.string()),
      plausibleDomain: z.optional(z.string()),
      googleTagManagerId: z.optional(z.string()),
    }),
  ),
  notifications: z.optional(z.object({ email: z.optional(z.email()) })),
  tracking: z.optional(
    z.object({
      enabled: z.optional(z.boolean()),
      platforms: z.optional(z.array(z.string())),
    }),
  ),
  security: z.optional(
    z.object({
      turnstile: z.optional(z.object({ siteKey: z.optional(z.string()) })),
    }),
  ),
  legal: z.optional(
    z.object({
      privacyPolicy: z.optional(
        z.object({
          enabled: z.boolean(),
          url: z.optional(z.url()),
          lastUpdated: z.optional(IsoDate),
        }),
      ),
      termsOfService: z.optional(
        z.object({
          enabled: z.boolean(),
          url: z.optional(z.url()),
          lastUpdated: z.optional(z.nullable(IsoDate)),
        }),
      ),
      cookieConsent: z.optional(
        z.object({
          enabled: z.boolean(),
          type: z.optional(z.enum(['opt-in', 'opt-out'])),
          position: z.optional(z.enum(['top', 'bottom', 'center'])),
          categories: z.optional(z.array(z.string())),
        }),
      ),
    }),
  ),
  icons: z.optional(
    z.object({
      ui: z.optional(z.string()),
      brand: z.optional(z.string()),
      semantic: z.optional(z.array(z.string())),
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
  favicon: z.optional(
    z.object({
      source: z.string(),
      lowResSource: z.optional(z.string()),
    }),
  ),
  deployment: z.optional(
    z.object({
      platform: z.optional(z.string()),
      buildCommand: z.optional(z.string()),
      deployCommand: z.optional(z.string()),
      outputDirectory: z.optional(z.string()),
      type: z.optional(z.string()),
    }),
  ),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

// ── JSON Schema + validation ────────────────────────────────────────────────────

export const SITE_SCHEMA_URL = 'https://unpkg.com/@getvitops/core/site.schema.json';

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

  if (errors.length) return { ok: false, data: undefined, errors };
  return { ok: true, data: cfg, errors: [] };
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
