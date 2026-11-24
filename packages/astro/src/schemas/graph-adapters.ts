/**
 * `organization.locations` / `organization.services` → the options the JSON-LD builders take.
 *
 * The "no site-model layer" rule (see `packages/astro/AGENTS.md`) applied: these are pure functions
 * that take what they read as arguments and import no consumer state, the way `routes/config-adapters.ts`
 * does for `toNotifyContext`. A page does its own `Object.entries(config.organization.locations)` and
 * passes one resolved entry in.
 *
 * The entries are typed STRUCTURALLY, not as the schema's own `Config`. A plain
 * `import site from './site.json'` types every enum as `string` (a day of the week is `string`, not
 * `'Monday' | …`), which a strict `Config` rejects, and every scaffolded site calls these with exactly
 * such an import. So the weekday is checked at runtime rather than trusted to the type, the same trade
 * `resolveOrganizationName` makes.
 *
 * `listings` is dropped on purpose: it holds the ids a future listings sync matches against, and
 * schema.org has nothing to say about them.
 */
import { t, type Localizable } from '@getvitops/utils';
import type {
  LocalBusinessGraphOptions,
  OpeningHoursSpecification,
  ServiceGraphOptions,
  ServiceOffer,
  SpecialHoursSpecification,
} from '@getvitops/utils/schema';

export interface ImageRefSource {
  src: string;
  alt?: string;
}

export interface LocationSource {
  slug?: Localizable | undefined;
  name: Localizable;
  email?: string | undefined;
  phone?: string | undefined;
  address?:
    | {
        streetAddress?: string | undefined;
        addressLocality?: string | undefined;
        addressRegion?: string | undefined;
        postalCode?: string | undefined;
        addressCountry?: string | undefined;
      }
    | undefined;
  geo?: { latitude: number; longitude: number } | undefined;
  hours?: readonly { dayOfWeek: readonly string[]; opens: string; closes: string }[] | undefined;
  hoursSpecial?:
    | readonly {
        validFrom: string;
        validThrough?: string | undefined;
        opens?: string | undefined;
        closes?: string | undefined;
      }[]
    | undefined;
  type?: string | undefined;
  description?: Localizable | undefined;
  areaServed?: readonly string[] | undefined;
  priceRange?: string | undefined;
  paymentAccepted?: readonly string[] | undefined;
  currenciesAccepted?: string | undefined;
  knowsLanguage?: readonly string[] | undefined;
  photos?: readonly (string | ImageRefSource)[] | undefined;
  sameAs?: readonly string[] | undefined;
}

export interface OfferSource {
  name?: Localizable | undefined;
  price?: string | number | undefined;
  priceCurrency?: string | undefined;
  availability?: string | undefined;
  url?: string | undefined;
  validFrom?: string | undefined;
  priceValidUntil?: string | undefined;
}

export interface ServiceSource {
  slug?: Localizable | undefined;
  name: Localizable;
  description?: Localizable | undefined;
  offers?: readonly OfferSource[] | undefined;
}

export interface LocaleOpts {
  locale?: string | undefined;
  defaultLocale: string;
}

const WEEKDAYS = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

/**
 * The URL path segment for an entry: the per-locale `slug` override if there is one, else the record
 * key. The KEY is the stable identity everywhere else in the toolchain (`toNotifyContext`'s primary
 * location, `validateConfig`'s membership check), so a slug is an override of the path, never a
 * replacement identity. Normalised to a safe segment, since the author typed it.
 */
export function resolveSlug(
  key: string,
  slug: Localizable | undefined,
  locale: string | undefined,
  defaultLocale: string,
): string {
  const segment = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return segment(t(slug, locale ?? defaultLocale, defaultLocale)) || segment(key) || 'page';
}

const imageSrc = (photo: string | ImageRefSource): string =>
  typeof photo === 'string' ? photo : photo.src;

/** A relative path becomes absolute against `origin`; an absolute URL is left alone. */
const absolute = (src: string, origin: string | undefined): string => {
  if (!origin) return src;
  try {
    return new URL(src, origin).href;
  } catch {
    return src;
  }
};

export function locationToLocalBusiness(
  location: LocationSource,
  opts: LocaleOpts & {
    /** This page's canonical URL → JSON-LD `url`. */
    url?: string | undefined;
    /** Resolves relative photo paths: schema.org wants absolute image URLs. */
    origin?: string | undefined;
  },
): LocalBusinessGraphOptions {
  const locale = opts.locale ?? opts.defaultLocale;
  const resolve = (value: Localizable | undefined) => t(value, locale, opts.defaultLocale);

  const description = resolve(location.description);
  const image = (location.photos ?? []).map((p) => absolute(imageSrc(p), opts.origin));
  const hours: OpeningHoursSpecification[] = (location.hours ?? []).map((h) => ({
    dayOfWeek: h.dayOfWeek.filter((d): d is OpeningHoursSpecification['dayOfWeek'][number] =>
      WEEKDAYS.has(d),
    ),
    opens: h.opens,
    closes: h.closes,
  }));
  const special: SpecialHoursSpecification[] = (location.hoursSpecial ?? []).map((h) => ({
    validFrom: h.validFrom,
    ...(h.validThrough && { validThrough: h.validThrough }),
    ...(h.opens && { opens: h.opens }),
    ...(h.closes && { closes: h.closes }),
  }));

  return {
    name: resolve(location.name),
    ...(location.type && { type: location.type }),
    ...(description && { description }),
    ...(opts.url && { url: opts.url }),
    ...(location.phone && { telephone: location.phone }),
    ...(location.email && { email: location.email }),
    ...(image.length > 0 && { image }),
    ...(location.priceRange && { priceRange: location.priceRange }),
    ...(location.address && {
      // Each field only when set: the builder's address type has no `undefined`.
      address: {
        ...(location.address.streetAddress && { streetAddress: location.address.streetAddress }),
        ...(location.address.addressLocality && {
          addressLocality: location.address.addressLocality,
        }),
        ...(location.address.addressRegion && { addressRegion: location.address.addressRegion }),
        ...(location.address.postalCode && { postalCode: location.address.postalCode }),
        ...(location.address.addressCountry && {
          addressCountry: location.address.addressCountry,
        }),
      },
    }),
    ...(location.geo && { geo: { ...location.geo } }),
    ...(hours.length > 0 && { openingHoursSpecification: hours }),
    ...(special.length > 0 && { specialOpeningHoursSpecification: special }),
    ...(location.paymentAccepted?.length && { paymentAccepted: [...location.paymentAccepted] }),
    ...(location.currenciesAccepted && { currenciesAccepted: location.currenciesAccepted }),
    ...(location.areaServed?.length && { areaServed: [...location.areaServed] }),
    ...(location.sameAs?.length && { sameAs: [...location.sameAs] }),
    ...(location.knowsLanguage?.length && { knowsLanguage: [...location.knowsLanguage] }),
  };
}

export function serviceToGraph(
  service: ServiceSource,
  opts: LocaleOpts & {
    /** The business providing it: `resolveOrganizationName(config)`. */
    providerName?: string | undefined;
    url?: string | undefined;
    areaServed?: readonly string[] | undefined;
  },
): ServiceGraphOptions {
  const locale = opts.locale ?? opts.defaultLocale;
  const resolve = (value: Localizable | undefined) => t(value, locale, opts.defaultLocale);
  const description = resolve(service.description);
  const offers: ServiceOffer[] = (service.offers ?? []).map((offer) => {
    const name = resolve(offer.name);
    return {
      ...(name && { name }),
      ...(offer.price !== undefined && { price: offer.price }),
      ...(offer.priceCurrency && { priceCurrency: offer.priceCurrency }),
      ...(offer.availability && { availability: offer.availability }),
      ...(offer.url && { url: offer.url }),
      ...(offer.validFrom && { validFrom: offer.validFrom }),
      ...(offer.priceValidUntil && { priceValidUntil: offer.priceValidUntil }),
    };
  });

  return {
    name: resolve(service.name),
    ...(description && { description }),
    ...(opts.url && { url: opts.url }),
    ...(opts.providerName && { provider: opts.providerName }),
    ...(opts.areaServed?.length && { areaServed: [...opts.areaServed] }),
    ...(offers.length > 0 && { offers }),
  };
}
