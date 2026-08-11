export interface OpeningHoursSpecification {
  dayOfWeek: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday')[];
  opens: string;
  closes: string;
}

/**
 * A dated deviation from the recurring `openingHoursSpecification` — holiday
 * hours, a one-off closure, a temporary schedule. Same schema.org shape
 * (`OpeningHoursSpecification`), distinguished by carrying `validFrom`. A full
 * closure omits `opens`/`closes` rather than encoding it as an open interval.
 */
export interface SpecialHoursSpecification {
  validFrom: string;
  validThrough?: string;
  opens?: string;
  closes?: string;
}

export interface LocalBusinessGraphOptions {
  /** schema.org `LocalBusiness` subtype, e.g. `'Restaurant'`, `'ProfessionalService'`. Defaults to `'LocalBusiness'`. */
  type?: string;
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  email?: string;
  image?: string | string[];
  priceRange?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: OpeningHoursSpecification[];
  specialOpeningHoursSpecification?: SpecialHoursSpecification[];
  aggregateRating?: {
    ratingValue: number;
    reviewCount?: number;
    ratingCount?: number;
    bestRating?: number;
    worstRating?: number;
  };
  review?: {
    author: string;
    datePublished: string;
    reviewBody: string;
    reviewRating?: {
      ratingValue: number;
      bestRating?: number;
      worstRating?: number;
    };
  }[];
  paymentAccepted?: string[];
  currenciesAccepted?: string;
  areaServed?: string[];
  sameAs?: string[];
  knowsLanguage?: string[];
}

/** Build a schema.org LocalBusiness (or subtype) JSON-LD graph. */
export function localBusinessGraph(options: LocalBusinessGraphOptions): Record<string, unknown> {
  const {
    type = 'LocalBusiness',
    name,
    description,
    url,
    telephone,
    email,
    image,
    priceRange,
    address,
    geo,
    openingHoursSpecification,
    specialOpeningHoursSpecification,
    aggregateRating,
    review,
    paymentAccepted,
    currenciesAccepted,
    areaServed,
    sameAs,
    knowsLanguage,
  } = options;

  const hours = [
    ...(openingHoursSpecification ?? []).map((spec) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: spec.dayOfWeek,
      opens: spec.opens,
      closes: spec.closes,
    })),
    ...(specialOpeningHoursSpecification ?? []).map((spec) => ({
      '@type': 'OpeningHoursSpecification',
      validFrom: spec.validFrom,
      ...(spec.validThrough && { validThrough: spec.validThrough }),
      ...(spec.opens && { opens: spec.opens }),
      ...(spec.closes && { closes: spec.closes }),
    })),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    ...(description && { description }),
    ...(url && { url }),
    ...(telephone && { telephone }),
    ...(email && { email }),
    ...(image && { image: Array.isArray(image) ? image : [image] }),
    ...(priceRange && { priceRange }),
    ...(address && {
      address: {
        '@type': 'PostalAddress',
        ...(address.streetAddress && { streetAddress: address.streetAddress }),
        ...(address.addressLocality && { addressLocality: address.addressLocality }),
        ...(address.addressRegion && { addressRegion: address.addressRegion }),
        ...(address.postalCode && { postalCode: address.postalCode }),
        ...(address.addressCountry && { addressCountry: address.addressCountry }),
      },
    }),
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    }),
    ...(hours.length > 0 && { openingHoursSpecification: hours }),
    ...(aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregateRating.ratingValue,
        ...(aggregateRating.reviewCount && { reviewCount: aggregateRating.reviewCount }),
        ...(aggregateRating.ratingCount && { ratingCount: aggregateRating.ratingCount }),
        bestRating: aggregateRating.bestRating ?? 5,
        worstRating: aggregateRating.worstRating ?? 1,
      },
    }),
    ...(review && {
      review: review.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        datePublished: r.datePublished,
        reviewBody: r.reviewBody,
        ...(r.reviewRating && {
          reviewRating: {
            '@type': 'Rating',
            ratingValue: r.reviewRating.ratingValue,
            bestRating: r.reviewRating.bestRating ?? 5,
            worstRating: r.reviewRating.worstRating ?? 1,
          },
        }),
      })),
    }),
    ...(paymentAccepted && { paymentAccepted }),
    ...(currenciesAccepted && { currenciesAccepted }),
    ...(areaServed && { areaServed }),
    ...(sameAs && { sameAs }),
    ...(knowsLanguage && { knowsLanguage }),
  };
}
