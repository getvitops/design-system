import { describe, expect, it } from 'vite-plus/test';
import { serviceGraph } from './service.ts';

describe('serviceGraph', () => {
  it('is a bare Service when only a name is given', () => {
    expect(serviceGraph({ name: 'Roof repair' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Roof repair',
    });
  });

  it('renders a string provider as a nested Organization, and a provider object with its url', () => {
    expect(serviceGraph({ name: 'x', provider: 'Acme' }).provider).toEqual({
      '@type': 'Organization',
      name: 'Acme',
    });
    expect(
      serviceGraph({ name: 'x', provider: { name: 'Acme', url: 'https://acme.ca' } }).provider,
    ).toEqual({ '@type': 'Organization', name: 'Acme', url: 'https://acme.ca' });
  });

  it('omits an empty provider, area and offers rather than emitting empty values', () => {
    const g = serviceGraph({ name: 'x', provider: '', areaServed: [], offers: [] });
    expect(g).not.toHaveProperty('provider');
    expect(g).not.toHaveProperty('areaServed');
    expect(g).not.toHaveProperty('offers');
  });

  it('types each offer, keeps a price of 0, and drops what is not given', () => {
    const g = serviceGraph({
      name: 'x',
      offers: [{ name: 'Inspection', price: 0, priceCurrency: 'CAD' }, { price: '120.00' }],
    });
    expect(g.offers).toEqual([
      { '@type': 'Offer', name: 'Inspection', price: 0, priceCurrency: 'CAD' },
      { '@type': 'Offer', price: '120.00' },
    ]);
  });

  it('carries description, url, area served and offer dates', () => {
    const g = serviceGraph({
      name: 'x',
      description: 'd',
      url: 'https://a.ca/x',
      areaServed: ['Ottawa', 'Gatineau'],
      offers: [{ url: 'https://a.ca/buy', validFrom: '2026-01-01', priceValidUntil: '2026-12-31' }],
    });
    expect(g).toMatchObject({
      description: 'd',
      url: 'https://a.ca/x',
      areaServed: ['Ottawa', 'Gatineau'],
    });
    expect((g.offers as Record<string, unknown>[])[0]).toEqual({
      '@type': 'Offer',
      url: 'https://a.ca/buy',
      validFrom: '2026-01-01',
      priceValidUntil: '2026-12-31',
    });
  });
});
