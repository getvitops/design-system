export interface ServiceOffer {
  name?: string;
  price?: string | number;
  priceCurrency?: string;
  /** A schema.org `ItemAvailability` URL or its short name, passed through as given. */
  availability?: string;
  url?: string;
  validFrom?: string;
  priceValidUntil?: string;
}

export interface ServiceGraphOptions {
  name: string;
  description?: string;
  url?: string;
  /** The business providing it: a name, or a name with its own URL. Rendered as a nested `Organization`. */
  provider?: string | { name: string; url?: string };
  areaServed?: string[];
  offers?: ServiceOffer[];
}

/** Build a schema.org Service JSON-LD graph. Optional fields are omitted when empty. */
export function serviceGraph(options: ServiceGraphOptions): Record<string, unknown> {
  const { name, description, url, provider, areaServed, offers } = options;
  const org = typeof provider === 'string' ? { name: provider } : provider;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    ...(description && { description }),
    ...(url && { url }),
    ...(org?.name && {
      provider: {
        '@type': 'Organization',
        name: org.name,
        ...(org.url && { url: org.url }),
      },
    }),
    ...(areaServed?.length && { areaServed }),
    ...(offers?.length && {
      offers: offers.map((offer) => ({
        '@type': 'Offer',
        ...(offer.name && { name: offer.name }),
        ...(offer.price !== undefined && offer.price !== '' && { price: offer.price }),
        ...(offer.priceCurrency && { priceCurrency: offer.priceCurrency }),
        ...(offer.availability && { availability: offer.availability }),
        ...(offer.url && { url: offer.url }),
        ...(offer.validFrom && { validFrom: offer.validFrom }),
        ...(offer.priceValidUntil && { priceValidUntil: offer.priceValidUntil }),
      })),
    }),
  };
}
