/**
 * Real rendered HTML for the components added with tabs/breadcrumbs/combobox/format/range and the
 * location/service pages, via the container API (see `container.test.ts` for why). The pure decisions
 * are in `breadcrumbs.test.ts`, `location.test.ts` and `schemas/graph-adapters.test.ts`; this proves the
 * markup contracts the CSS and the web components depend on survive a real render.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-ignore -- this package's tsconfig has no `*.astro` module declaration (container.test.ts has the same gap)
import Breadcrumbs from './Breadcrumbs.astro';
// @ts-ignore -- as above
import Combobox from './Combobox.astro';
// @ts-ignore -- as above
import Field from './Field.astro';
// @ts-ignore -- as above
import Format from './Format.astro';
// @ts-ignore -- as above
import LocationPage from './LocationPage.astro';
// @ts-ignore -- as above
import Range from './Range.astro';
// @ts-ignore -- as above
import ServicePage from './ServicePage.astro';
// @ts-ignore -- as above
import Tabs from './Tabs.astro';

const PAGE = 'https://example.com/services/roofing';
const render = async (
  component: unknown,
  props: Record<string, unknown>,
  slots?: Record<string, string>,
) =>
  (await AstroContainer.create()).renderToString(component as never, {
    props,
    request: new Request(PAGE),
    ...(slots && { slots }),
  });

describe('<Breadcrumbs />', () => {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services' },
    { label: 'Roofing' },
  ];

  it('renders a labelled list whose last item is the current page and not a link', async () => {
    const html = await render(Breadcrumbs, { items });
    expect(html).toContain('<nav class="breadcrumbs" aria-label="Breadcrumb">');
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<span aria-current="page">Roofing</span>');
    expect(html).not.toMatch(/<a[^>]*>Roofing<\/a>/);
  });

  it('emits BreadcrumbList JSON-LD from the same items, with absolute urls', async () => {
    const html = await render(Breadcrumbs, { items });
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"BreadcrumbList"');
    expect(html).toContain('https://example.com/services');
    expect(html).toContain('https://example.com/services/roofing');
  });

  it('omits the JSON-LD with schema={false}, and renders nothing for an empty trail', async () => {
    expect(await render(Breadcrumbs, { items, schema: false })).not.toContain('ld+json');
    expect((await render(Breadcrumbs, { items: [] })).trim()).toBe('');
  });

  it('names the landmark', async () => {
    expect(await render(Breadcrumbs, { items, label: 'Fil d’Ariane' })).toContain(
      'aria-label="Fil d’Ariane"',
    );
  });
});

describe('<Tabs />', () => {
  const items = [
    { label: 'Overview', id: 'overview', body: ['About us.'] },
    { label: 'Pricing', body: ['Plans.'] },
  ];

  it('emits <wc-tabs> over headed sections that read with no JS', async () => {
    const html = await render(Tabs, { items });
    expect(html).toMatch(/<wc-tabs[^>]*class="tabs"/);
    expect(html).toContain('<section id="overview"><h3>Overview</h3><p>About us.</p></section>');
    expect(html).toContain('<h3>Pricing</h3>');
  });

  it('passes orientation, selected and hash to the element, and the heading level to the headings', async () => {
    const html = await render(Tabs, {
      items,
      orientation: 'vertical',
      selected: 1,
      hash: true,
      level: 4,
    });
    expect(html).toContain('orientation="vertical"');
    expect(html).toContain('selected="1"');
    expect(html).toMatch(/<wc-tabs[^>]*\shash/);
    expect(html).toContain('<h4>Overview</h4>');
  });

  it('puts author-written sections in the slot after the data ones', async () => {
    const html = await render(
      Tabs,
      { items },
      { default: '<section id="faq"><h3>FAQ</h3></section>' },
    );
    expect(html.indexOf('Pricing')).toBeLessThan(html.indexOf('id="faq"'));
  });
});

describe('<Combobox />', () => {
  it('renders an input bound to a datalist, with a label-able id', async () => {
    const html = await render(Combobox, {
      name: 'city',
      inputId: 'pt-city',
      options: ['Ottawa', { value: 'MTL', label: 'Montréal' }],
    });
    expect(html).toMatch(/<wc-combobox[^>]*class="combobox"/);
    expect(html).toMatch(/<input[^>]*id="pt-city"[^>]*list="pt-city-options"/);
    expect(html).toContain('<datalist id="pt-city-options">');
    expect(html).toContain('<option value="Ottawa"></option>');
    expect(html).toContain('<option value="MTL" label="Montréal"></option>');
  });

  it('defaults the id to the name, and carries value, placeholder, required and empty text', async () => {
    const html = await render(Combobox, {
      name: 'city',
      options: ['Ottawa'],
      value: 'Ottawa',
      placeholder: 'Pick one',
      required: true,
      emptyText: 'Nothing',
    });
    expect(html).toMatch(/<input[^>]*id="city"/);
    expect(html).toContain('empty-text="Nothing"');
    expect(html).toContain('placeholder="Pick one"');
    expect(html).toMatch(/<input[^>]*\srequired/);
    expect(html).toContain('value="Ottawa"');
  });
});

describe('<Format />', () => {
  it('wraps a real <time> with the fallback text inside, for a date', async () => {
    const html = await render(
      Format,
      { type: 'relative', value: '2026-11-03T14:05:00Z' },
      { default: 'November 3, 2026' },
    );
    expect(html).toMatch(/<wc-format[^>]*type="relative"/);
    expect(html).toContain('<time datetime="2026-11-03T14:05:00Z">November 3, 2026</time>');
  });

  it('wraps a <data value> for a number, and passes currency and locale', async () => {
    const html = await render(
      Format,
      { type: 'currency', currency: 'CAD', locale: 'en-CA', value: 1234.5 },
      { default: '$1,234.50 CAD' },
    );
    expect(html).toContain('<data value="1234.5">$1,234.50 CAD</data>');
    expect(html).toContain('currency="CAD"');
    expect(html).toContain('locale="en-CA"');
  });

  it('shows the raw machine value when given no fallback text', async () => {
    expect(await render(Format, { type: 'number', value: 42 })).toContain(
      '<data value="42">42</data>',
    );
  });
});

describe('<Range />', () => {
  it('renders a single labelled native slider with an output', async () => {
    const html = await render(Range, {
      name: 'volume',
      label: 'Volume',
      min: 0,
      max: 10,
      value: 4,
      output: true,
    });
    expect(html).toMatch(/<wc-range[^>]*class="range"/);
    expect(html).toMatch(/<input[^>]*type="range"[^>]*name="volume"/);
    expect(html).toContain('aria-label="Volume"');
    expect(html).toContain('<output>4</output>');
    expect(html.match(/type="range"/g)).toHaveLength(1);
  });

  it('renders two named, labelled sliders for a pair, both submitted', async () => {
    const html = await render(Range, {
      names: ['min', 'max'],
      labels: ['Minimum price', 'Maximum price'],
      min: 0,
      max: 1000,
      values: [200, 800],
      output: true,
    });
    expect(html.match(/type="range"/g)).toHaveLength(2);
    expect(html).toContain('name="min"');
    expect(html).toContain('name="max"');
    expect(html).toContain('aria-label="Minimum price"');
    expect(html).toContain('value="200"');
    expect(html).toContain('<output>200 – 800</output>');
  });
});

describe('<LocationPage />', () => {
  const location = {
    name: { en: 'Ottawa shop', fr: 'Boutique Ottawa' },
    description: 'Roofing since 1998',
    phone: '+1 (613) 555-0100',
    email: 'ottawa@example.com',
    address: {
      streetAddress: '1 Main St',
      addressLocality: 'Ottawa',
      addressRegion: 'ON',
      postalCode: 'K1A 0B1',
      addressCountry: 'CA',
    },
    hours: [
      {
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
    hoursSpecial: [{ validFrom: '2026-12-25' }],
    photos: ['/a.jpg', { src: '/b.jpg', alt: 'Storefront' }],
  };

  it('renders the name, address, hours and photos, and the LocalBusiness JSON-LD', async () => {
    const html = await render(LocationPage, { location, defaultLocale: 'en' });
    expect(html).toContain('<h1>Ottawa shop</h1>');
    expect(html).toContain('<address class="location__address">');
    expect(html).toContain('1 Main St');
    expect(html).toContain('Ottawa ON K1A 0B1');
    expect(html).toContain('href="tel:+16135550100"');
    expect(html).toContain('href="mailto:ottawa@example.com"');
    expect(html).toContain('<th scope="row">Monday – Friday</th>');
    expect(html).toContain('9:00 AM – 5:00 PM');
    expect(html).toContain('<th scope="row">Dec 25, 2026</th>');
    expect(html).toContain('<td>Closed</td>');
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain('"url":"https://example.com/services/roofing"');
    expect(html).toContain('https://example.com/a.jpg');
  });

  it('describes a photo that has alt text and marks a bare path decorative', async () => {
    const html = await render(LocationPage, { location, defaultLocale: 'en' });
    expect(html).toContain('alt="Storefront"');
    // Astro writes an empty `alt=""` as a bare `alt`, which HTML reads as the same empty string.
    expect(html).toMatch(/<img src="\/a\.jpg" alt loading="lazy">/);
  });

  it('localises the name and takes visible words from labels', async () => {
    const html = await render(LocationPage, {
      location,
      locale: 'fr',
      defaultLocale: 'en',
      labels: { hours: 'Heures d’ouverture', closed: 'Fermé' },
    });
    expect(html).toContain('<h1>Boutique Ottawa</h1>');
    expect(html).toContain('Heures d’ouverture');
    expect(html).toContain('<td>Fermé</td>');
  });

  it('uses the level for the name and the next one for its sections, and can omit the JSON-LD', async () => {
    const html = await render(LocationPage, {
      location,
      defaultLocale: 'en',
      level: 2,
      schema: false,
    });
    expect(html).toContain('<h2>Ottawa shop</h2>');
    expect(html).toContain('<h3>Opening hours</h3>');
    expect(html).not.toContain('ld+json');
  });

  it('renders only what the entry has', async () => {
    const html = await render(LocationPage, { location: { name: 'Bare' }, defaultLocale: 'en' });
    expect(html).toContain('<h1>Bare</h1>');
    for (const absent of ['<address', '<table', 'location__photos'])
      expect(html).not.toContain(absent);
  });
});

describe('<ServicePage />', () => {
  const service = {
    name: { en: 'Roof repair', fr: 'Réparation de toit' },
    description: 'Leaks fixed',
    offers: [
      { name: 'Inspection', price: 0, priceCurrency: 'CAD' },
      { name: 'Repair', price: '450', priceCurrency: 'CAD', url: 'https://example.com/book' },
    ],
  };

  it('renders the name, description and priced offers, and the Service JSON-LD naming the provider', async () => {
    const html = await render(ServicePage, {
      service,
      defaultLocale: 'en',
      providerName: 'Acme',
      areaServed: ['Ottawa'],
    });
    expect(html).toContain('<h1>Roof repair</h1>');
    expect(html).toContain('Leaks fixed');
    expect(html).toContain('Inspection');
    expect(html).toContain('$0.00');
    expect(html).toContain('<a href="https://example.com/book">Repair</a>');
    expect(html).toContain('$450.00');
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain('"provider":{"@type":"Organization","name":"Acme"}');
    expect(html).toContain('"areaServed":["Ottawa"]');
  });

  it('localises the name, and renders no pricing section for a service with no offers', async () => {
    const html = await render(ServicePage, {
      service: { name: service.name },
      locale: 'fr',
      defaultLocale: 'en',
    });
    expect(html).toContain('<h1>Réparation de toit</h1>');
    expect(html).not.toContain('service__offers');
  });
});

describe('<Field />', () => {
  const control = '<input name="email" type="email" required />';

  it('emits its own <wc-field> with a label that NESTS the control, so no id/for is needed', async () => {
    const html = await render(Field, { label: 'Email' }, { default: control });
    expect(html).toMatch(/<wc-field[^>]*class="[^"]*\bfield\b/);
    expect(html).toMatch(
      /<label class="field__control">[\s\S]*Email[\s\S]*<input[^>]*name="email"[\s\S]*<\/label>/,
    );
    expect(html).not.toMatch(/<label[^>]*\sfor=/);
    // The control is inside the label, not beside it.
    expect(html.indexOf('<input')).toBeGreaterThan(html.indexOf('<label'));
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('</label>'));
  });

  it('always renders an empty polite live region for the error, so a later message is announced', async () => {
    const html = await render(Field, { label: 'Email' }, { default: control });
    expect(html).toMatch(/<span class="field__error" aria-live="polite">\s*<\/span>/);
    expect(html).not.toContain('data-invalid');
  });

  it('renders help text, an optional marker and a server error when given', async () => {
    const html = await render(
      Field,
      {
        label: 'Phone',
        help: 'Include the area code.',
        optional: true,
        error: 'Not a phone number.',
      },
      { default: '<input name="phone" />' },
    );
    expect(html).toContain('class="field__help"');
    expect(html).toContain('Include the area code.');
    expect(html).toContain('field__optional');
    expect(html).toContain('(optional)');
    expect(html).toMatch(/class="field__error"[^>]*>\s*Not a phone number\./);
    expect(html).toContain('data-invalid');
  });

  it('omits the help element and the optional marker when not asked for', async () => {
    const html = await render(Field, { label: 'Name' }, { default: '<input name="n" />' });
    expect(html).not.toContain('field__help');
    expect(html).not.toContain('field__optional');
  });

  it('escapes the label', async () => {
    const html = await render(
      Field,
      { label: '<img src=x onerror=alert(1)>' },
      { default: control },
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
