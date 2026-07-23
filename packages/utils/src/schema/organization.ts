export interface OrganizationGraphOptions {
  name: string;
  url?: string;
  logo?: string;
  description?: string;
  email?: string;
  telephone?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  sameAs?: string[];
  foundingDate?: string;
  founders?: string[];
  numberOfEmployees?: number | { minValue: number; maxValue: number };
  parentOrganization?: {
    name: string;
    url?: string;
  };
  subOrganization?: {
    name: string;
    url?: string;
  }[];
  contactPoint?: {
    type?: 'customer service' | 'technical support' | 'sales' | 'billing support' | 'reservations';
    telephone: string;
    email?: string;
    contactType: string;
    availableLanguage?: string[];
    areaServed?: string[];
  }[];
  areaServed?: string[];
  brand?: string;
  award?: string[];
  memberOf?: {
    name: string;
    url?: string;
  }[];
}

/** Build a schema.org Organization JSON-LD graph. */
export function organizationGraph(options: OrganizationGraphOptions): Record<string, unknown> {
  const {
    name,
    url,
    logo,
    description,
    email,
    telephone,
    address,
    sameAs,
    foundingDate,
    founders,
    numberOfEmployees,
    parentOrganization,
    subOrganization,
    contactPoint,
    areaServed,
    brand,
    award,
    memberOf,
  } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    ...(url && { url }),
    ...(logo && { logo }),
    ...(description && { description }),
    ...(email && { email }),
    ...(telephone && { telephone }),
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
    ...(sameAs && { sameAs }),
    ...(foundingDate && { foundingDate }),
    ...(founders && {
      founders: founders.map((f) => ({
        '@type': 'Person',
        name: f,
      })),
    }),
    ...(numberOfEmployees && {
      numberOfEmployees:
        typeof numberOfEmployees === 'number'
          ? { '@type': 'QuantitativeValue', value: numberOfEmployees }
          : {
              '@type': 'QuantitativeValue',
              minValue: numberOfEmployees.minValue,
              maxValue: numberOfEmployees.maxValue,
            },
    }),
    ...(parentOrganization && {
      parentOrganization: {
        '@type': 'Organization',
        name: parentOrganization.name,
        ...(parentOrganization.url && { url: parentOrganization.url }),
      },
    }),
    ...(subOrganization && {
      subOrganization: subOrganization.map((sub) => ({
        '@type': 'Organization',
        name: sub.name,
        ...(sub.url && { url: sub.url }),
      })),
    }),
    ...(contactPoint && {
      contactPoint: contactPoint.map((cp) => ({
        '@type': 'ContactPoint',
        telephone: cp.telephone,
        contactType: cp.contactType,
        ...(cp.email && { email: cp.email }),
        ...(cp.availableLanguage && { availableLanguage: cp.availableLanguage }),
        ...(cp.areaServed && { areaServed: cp.areaServed }),
      })),
    }),
    ...(areaServed && { areaServed }),
    ...(brand && { brand: { '@type': 'Brand', name: brand } }),
    ...(award && { award }),
    ...(memberOf && {
      memberOf: memberOf.map((m) => ({
        '@type': 'Organization',
        name: m.name,
        ...(m.url && { url: m.url }),
      })),
    }),
  };
}
