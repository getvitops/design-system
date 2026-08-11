import { describe, expect, it } from 'vitest';
import { localBusinessGraph } from './localBusiness.ts';

describe('localBusinessGraph', () => {
  it('defaults @type to LocalBusiness and includes only what was passed', () => {
    const graph = localBusinessGraph({ name: 'JBL Signs — Ottawa' });
    expect(graph).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'JBL Signs — Ottawa',
    });
  });

  it('honours an explicit subtype', () => {
    const graph = localBusinessGraph({ name: 'Acme Cafe', type: 'CafeOrCoffeeShop' });
    expect(graph['@type']).toBe('CafeOrCoffeeShop');
  });

  it('renders address, geo and recurring hours with schema.org @type wrappers', () => {
    const graph = localBusinessGraph({
      name: 'JBL Signs — Ottawa',
      address: {
        streetAddress: '1570 Liverpool Court, Building 1, Unit 7',
        addressLocality: 'Ottawa',
        addressRegion: 'ON',
        postalCode: 'K1B 4L2',
        addressCountry: 'CA',
      },
      geo: { latitude: 45.35, longitude: -75.75 },
      openingHoursSpecification: [
        {
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '17:00',
        },
      ],
    });

    expect(graph.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '1570 Liverpool Court, Building 1, Unit 7',
      addressLocality: 'Ottawa',
      addressRegion: 'ON',
      postalCode: 'K1B 4L2',
      addressCountry: 'CA',
    });
    expect(graph.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 45.35, longitude: -75.75 });
    expect(graph.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '17:00',
      },
    ]);
  });

  it('merges recurring and special hours into one openingHoursSpecification array', () => {
    const graph = localBusinessGraph({
      name: 'Acme',
      openingHoursSpecification: [{ dayOfWeek: ['Monday'], opens: '09:00', closes: '17:00' }],
      specialOpeningHoursSpecification: [{ validFrom: '2026-12-25', validThrough: '2026-12-25' }],
    });

    expect(graph.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday'],
        opens: '09:00',
        closes: '17:00',
      },
      { '@type': 'OpeningHoursSpecification', validFrom: '2026-12-25', validThrough: '2026-12-25' },
    ]);
  });

  /**
   * A full-day closure carries a date but no opens/closes — distinguishing
   * "closed all day" from "open, hours unspecified" matters for a listing
   * sync, so the omission must survive rather than getting defaulted.
   */
  it('represents a full-day closure by omitting opens/closes, not defaulting them', () => {
    const graph = localBusinessGraph({
      name: 'Acme',
      specialOpeningHoursSpecification: [{ validFrom: '2026-12-25' }],
    });

    const spec = (graph.openingHoursSpecification as Record<string, unknown>[])[0];
    expect(spec).not.toHaveProperty('opens');
    expect(spec).not.toHaveProperty('closes');
  });

  it('omits openingHoursSpecification entirely when no hours were given', () => {
    const graph = localBusinessGraph({ name: 'Acme' });
    expect(graph).not.toHaveProperty('openingHoursSpecification');
  });

  it('normalises a single image string to an array, matching organizationGraph/articleGraph', () => {
    const graph = localBusinessGraph({ name: 'Acme', image: 'https://acme.example/photo.jpg' });
    expect(graph.image).toEqual(['https://acme.example/photo.jpg']);
  });

  it('defaults aggregateRating and review bestRating/worstRating to a 1-5 scale', () => {
    const graph = localBusinessGraph({
      name: 'Acme',
      aggregateRating: { ratingValue: 4.8, reviewCount: 12 },
      review: [{ author: 'A. Client', datePublished: '2026-01-01', reviewBody: 'Great work.' }],
    });

    expect(graph.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
    expect(graph.review).toEqual([
      {
        '@type': 'Review',
        author: { '@type': 'Person', name: 'A. Client' },
        datePublished: '2026-01-01',
        reviewBody: 'Great work.',
      },
    ]);
  });
});
