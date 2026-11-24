import { describe, expect, it } from 'vite-plus/test';
import {
  locationToLocalBusiness,
  resolveSlug,
  serviceToGraph,
  type LocationSource,
} from './graph-adapters.ts';

const opts = { locale: 'en', defaultLocale: 'en' };

describe('resolveSlug', () => {
  it('uses the record key when there is no slug override', () => {
    expect(resolveSlug('ottawa', undefined, 'en', 'en')).toBe('ottawa');
  });
  it('prefers the slug for the active locale, falling back to the default locale', () => {
    const slug = { en: 'ottawa-roofing', fr: 'toiture-ottawa' };
    expect(resolveSlug('ottawa', slug, 'fr', 'en')).toBe('toiture-ottawa');
    expect(resolveSlug('ottawa', { en: 'ottawa-roofing' }, 'fr', 'en')).toBe('ottawa-roofing');
  });
  it('normalises what the author typed into a safe path segment', () => {
    expect(resolveSlug('x', 'Ottawa & Gatineau!', 'en', 'en')).toBe('ottawa-gatineau');
    expect(resolveSlug('x', 'Montréal Centre', 'en', 'en')).toBe('montreal-centre');
    expect(resolveSlug('x', '../admin', 'en', 'en')).toBe('admin');
  });
  it('falls back to the key, then to a constant, when the slug normalises to nothing', () => {
    expect(resolveSlug('Ottawa', '!!!', 'en', 'en')).toBe('ottawa');
    expect(resolveSlug('!!!', '!!!', 'en', 'en')).toBe('page');
  });
});

describe('locationToLocalBusiness', () => {
  const full: LocationSource = {
    name: { en: 'Ottawa shop', fr: 'Boutique Ottawa' },
    description: 'Roofing since 1998',
    phone: '+1 613 555 0100',
    email: 'ottawa@example.com',
    type: 'HomeAndConstructionBusiness',
    address: {
      streetAddress: '1 Main St',
      addressLocality: 'Ottawa',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    geo: { latitude: 45.4, longitude: -75.7 },
    hours: [{ dayOfWeek: ['Monday', 'Tuesday'], opens: '09:00', closes: '17:00' }],
    hoursSpecial: [{ validFrom: '2026-12-25', validThrough: '2026-12-26' }],
    photos: ['/a.jpg', { src: 'https://cdn.example.com/b.jpg', alt: 'Front' }],
    areaServed: ['Ottawa'],
    sameAs: ['https://g.page/x'],
    priceRange: '$$',
    paymentAccepted: ['Cash'],
    currenciesAccepted: 'CAD',
    knowsLanguage: ['en', 'fr'],
  };

  it('passes the shape-identical fields straight through', () => {
    const out = locationToLocalBusiness(full, opts);
    expect(out).toMatchObject({
      name: 'Ottawa shop',
      description: 'Roofing since 1998',
      telephone: '+1 613 555 0100',
      email: 'ottawa@example.com',
      type: 'HomeAndConstructionBusiness',
      address: full.address,
      geo: full.geo,
      areaServed: ['Ottawa'],
      sameAs: ['https://g.page/x'],
      priceRange: '$$',
      paymentAccepted: ['Cash'],
      currenciesAccepted: 'CAD',
      knowsLanguage: ['en', 'fr'],
      openingHoursSpecification: [
        { dayOfWeek: ['Monday', 'Tuesday'], opens: '09:00', closes: '17:00' },
      ],
      specialOpeningHoursSpecification: [{ validFrom: '2026-12-25', validThrough: '2026-12-26' }],
    });
  });

  it('resolves localised text for the active locale', () => {
    expect(locationToLocalBusiness(full, { locale: 'fr', defaultLocale: 'en' }).name).toBe(
      'Boutique Ottawa',
    );
  });

  it('flattens photos to urls, dropping alt, and absolutises relative ones against the origin', () => {
    expect(locationToLocalBusiness(full, { ...opts, origin: 'https://example.com' }).image).toEqual(
      ['https://example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    );
    expect(locationToLocalBusiness(full, opts).image).toEqual([
      '/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('drops a weekday that is not one, rather than emitting invalid JSON-LD', () => {
    const out = locationToLocalBusiness(
      { name: 'x', hours: [{ dayOfWeek: ['Monday', 'Funday'], opens: '09:00', closes: '10:00' }] },
      opts,
    );
    expect(out.openingHoursSpecification?.[0]?.dayOfWeek).toEqual(['Monday']);
  });

  it('never carries listings, and omits what is absent', () => {
    const out = locationToLocalBusiness(
      { name: 'x', listings: { google: 'abc' } } as LocationSource & { listings: unknown },
      opts,
    );
    expect(out).toEqual({ name: 'x' });
  });

  it('adds the page url when given', () => {
    expect(
      locationToLocalBusiness({ name: 'x' }, { ...opts, url: 'https://e.ca/locations/x' }).url,
    ).toBe('https://e.ca/locations/x');
  });
});

describe('serviceToGraph', () => {
  it('resolves text and offers, and names the provider', () => {
    const out = serviceToGraph(
      {
        name: { en: 'Roof repair', fr: 'Réparation de toit' },
        description: 'Leaks fixed',
        offers: [
          { name: { en: 'Inspection' }, price: 0, priceCurrency: 'CAD', url: 'https://e.ca/buy' },
        ],
      },
      { ...opts, providerName: 'Acme', areaServed: ['Ottawa'], url: 'https://e.ca/services/roof' },
    );
    expect(out).toEqual({
      name: 'Roof repair',
      description: 'Leaks fixed',
      url: 'https://e.ca/services/roof',
      provider: 'Acme',
      areaServed: ['Ottawa'],
      offers: [{ name: 'Inspection', price: 0, priceCurrency: 'CAD', url: 'https://e.ca/buy' }],
    });
  });
  it('keeps a price of zero and omits an empty provider', () => {
    const out = serviceToGraph(
      { name: 'x', offers: [{ price: 0 }] },
      { ...opts, providerName: '' },
    );
    expect(out.offers).toEqual([{ price: 0 }]);
    expect(out).not.toHaveProperty('provider');
  });
  it('localises to the active locale', () => {
    expect(
      serviceToGraph({ name: { en: 'A', fr: 'B' } }, { locale: 'fr', defaultLocale: 'en' }).name,
    ).toBe('B');
  });
});
