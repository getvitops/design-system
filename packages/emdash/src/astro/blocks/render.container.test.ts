/**
 * Real-render tests for the block adapters, through Astro's container API: HTML in, HTML out.
 *
 * `blocks.test.ts` reads each `.astro` file as text, which proves a field name is mentioned
 * but never that the component renders — a prop destructured wrong or a heading level that
 * never reaches the tag passes it. These assert the markup an editor's saved block produces.
 *
 * Props arrive as `{ node }` here, the shape `astro-portabletext` passes (see `value.ts`).
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vite-plus/test';
import Callout from './Callout.astro';
import Cards from './Cards.astro';
import Embed from './Embed.astro';
import Entries from './Entries.astro';
import Hero from './Hero.astro';
import Logos from './Logos.astro';
import Pricing from './Pricing.astro';
import Stats from './Stats.astro';
import Steps from './Steps.astro';

// `.astro` imports are typed as plain prop functions here (see `astro-modules.d.ts`), which the
// container's `AstroComponentFactory` parameter does not accept; the cast is the whole bridge.
type Component = Parameters<AstroContainer['renderToString']>[0];
async function render(component: unknown, node: object) {
  const container = await AstroContainer.create();
  return container.renderToString(component as Component, { props: { node } });
}

describe('vitops.cards', () => {
  const cards = [
    {
      title: 'Cut costs',
      body: 'you pay [less](/pricing) for what you use',
      href: '/a',
      linkLabel: 'More',
    },
  ];

  it('renders the title as a heading at the chosen level (U19), not a paragraph', async () => {
    const html = await render(Cards, { cards, level: '4' });
    expect(html).toContain('<h4 class="font-heading">Cut costs</h4>');
    expect(html).not.toContain('<p class="font-heading"');
  });

  it('keeps an inline link in the body and stays a <wc-cards> grid', async () => {
    const html = await render(Cards, { cards });
    expect(html).toContain('<a class="link" href="/pricing">less</a>');
    expect(html).toContain('<wc-cards');
    expect(html).toContain('class="link stretched-link"');
  });

  it('panel variant: tinted by tone through custom properties, with checklist and button', async () => {
    const html = await render(Cards, {
      variant: 'panel',
      tone: 'brand-primary',
      cards: [{ title: 'Pillar', checklist: 'one\ntwo', ctaLabel: 'Go', ctaHref: '/go' }],
    });
    expect(html).toContain('class="card subgrid-card tone"');
    expect(html).toContain('--tone-bg: var(--color-bg-brand-primary-muted');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('class="cta" href="/go"');
    // A panel holds its own button, so it is not a click-forwarding <wc-cards>.
    expect(html).not.toContain('<wc-cards');
  });

  it('drops an unsafe link instead of rendering it', async () => {
    const html = await render(Cards, { cards: [{ title: 'x', body: '[bad](javascript:alert)' }] });
    expect(html).not.toContain('javascript:');
  });
});

describe('vitops.hero', () => {
  it('accents starred words and honours the heading level', async () => {
    const html = await render(Hero, { heading: 'Two services. *One team.*', level: '3' });
    expect(html).toContain(
      '<h3 class="font-display">Two services. <em class="accent">One team.</em></h3>',
    );
  });

  it('renders the optional cards slot', async () => {
    const html = await render(Hero, { heading: 'Hi', cards: [{ title: 'A', body: 'b' }] });
    expect(html).toContain('<h3 class="font-heading">A</h3>');
  });
});

describe('vitops.logos', () => {
  it('is a labelled list of images with alt text', async () => {
    const html = await render(Logos, {
      label: 'Key partners',
      grayscale: true,
      logos: [
        { image: '/a.svg', alt: 'Acme', href: '/acme' },
        { image: '/b.svg', alt: 'Beta' },
      ],
    });
    expect(html).toContain('aria-label="Key partners"');
    expect(html).toContain('logos--grayscale');
    expect(html).toContain('alt="Acme"');
    expect(html).toContain('<a href="/acme">');
  });

  it('renders nothing with no logos', async () => {
    expect((await render(Logos, { logos: [] })).trim()).toBe('');
  });
});

describe('vitops.steps', () => {
  it('is an ordered list with real headings and a tone', async () => {
    const html = await render(Steps, {
      steps: [{ title: 'Call', text: 'We talk' }, { title: 'Build' }],
      level: '4',
      tone: 'success',
      layout: 'row',
    });
    expect(html).toContain('<ol');
    expect(html).toContain('steps--row');
    expect(html).toContain('<h4 class="steps__title font-heading">Call</h4>');
    expect(html).toContain('--tone-solid: var(--color-bg-success-solid');
  });
});

describe('vitops.stats', () => {
  const stats = [
    { value: '82%', label: 'Faster', group: 'Ops', delta: '+3 this week', state: 'up' },
  ];

  it('renders each figure through <wc-counter>', async () => {
    const html = await render(Stats, { stats });
    expect(html).toContain('<wc-counter');
    expect(html).toContain('82%');
    expect(html).not.toContain('stats__delta');
  });

  it('tiles variant adds group, delta and state; animate off drops the element', async () => {
    const html = await render(Stats, { stats, variant: 'tiles', animate: false });
    expect(html).toContain('stats--tiles');
    expect(html).toContain('data-state="up"');
    expect(html).toContain('Ops');
    expect(html).toContain('+3 this week');
    expect(html).not.toContain('<wc-counter');
  });

  it('ignores an invented state', async () => {
    const html = await render(Stats, { stats: [{ value: '1', state: 'x" onload="y' }] });
    expect(html).not.toContain('onload');
  });
});

describe('vitops.callout', () => {
  it('is a heading, text and actions in a tinted or solid band — not a banner', async () => {
    const html = await render(Callout, {
      heading: 'Ready?',
      body: 'Funding is [available](/funding).',
      primaryLabel: 'Apply',
      primaryHref: '/apply',
      solid: true,
      tone: 'brand-primary',
    });
    expect(html).toContain('class="callout tone tone--solid"');
    expect(html).toContain('<h2 class="callout__title font-title">Ready?</h2>');
    expect(html).toContain('<a class="link" href="/funding">available</a>');
    expect(html).toContain('class="cta" href="/apply"');
    expect(html).not.toContain('banner');
  });
});

describe('vitops.entries', () => {
  it('emits <wc-entries> with a semantic heading + dl per entry', async () => {
    const html = await render(Entries, {
      level: '4',
      breakpoint: '40rem',
      entries: [{ heading: 'Mon', pairs: 'Open | 9\nClose | 5' }],
    });
    expect(html).toContain('<wc-entries');
    expect(html).toContain('breakpoint="40rem"');
    expect(html).toContain('<h4>Mon</h4>');
    expect(html).toContain('<dt>Open</dt>');
    expect(html).toContain('<dd>9</dd>');
  });

  it('rejects a breakpoint that is not a CSS length', async () => {
    const html = await render(Entries, {
      breakpoint: '1" onload="x',
      entries: [{ heading: 'a', pairs: 'k | v' }],
    });
    expect(html).not.toContain('onload');
  });
});

describe('vitops.pricing', () => {
  it('aligns plans through the pricing-card subgrid rows', async () => {
    const html = await render(Pricing, {
      plans: [
        {
          name: 'Basic',
          price: '$9',
          period: 'per month',
          features: 'a\nb',
          ctaLabel: 'Buy',
          ctaHref: '/buy',
        },
        {
          name: 'Pro',
          price: '$29',
          features: 'a\nb\nc',
          featured: true,
          ctaLabel: 'Buy',
          ctaHref: '/buy',
        },
      ],
    });
    expect(html).toContain('class="pricing-grid"');
    expect(html).toContain('--pricing-columns: 2; --pricing-card-rows: 4');
    expect(html).toContain('pricing-card pricing-card--featured');
    expect(html).toContain('<h3 class="font-title">Pro</h3>');
    expect(html).toContain('pricing-card__feature');
  });
});

describe('vitops.embed', () => {
  it('ships the iframe with NO src and the address on data-consent-src', async () => {
    const html = await render(Embed, {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=abc123',
      title: 'Our story',
      category: 'marketing',
    });
    expect(html).toContain('data-consent="marketing"');
    expect(html).toContain('data-consent-src="https://www.youtube-nocookie.com/embed/abc123"');
    expect(html).toContain('title="Our story"');
    // The load-bearing rule: never a live src before consent.
    expect(html).not.toMatch(/<iframe[^>]*\ssrc=/);
    // And a usable fallback with no JS.
    expect(html).toContain('href="https://www.youtube.com/watch?v=abc123"');
  });

  it('renders nothing without a title or with an address the provider refuses', async () => {
    const ok = { provider: 'youtube', url: 'https://youtu.be/abc123' };
    expect((await render(Embed, ok)).trim()).toBe('');
    expect(
      (
        await render(Embed, { provider: 'youtube', url: 'https://evil.example/x', title: 't' })
      ).trim(),
    ).toBe('');
    expect(
      (await render(Embed, { provider: 'custom', url: 'javascript:alert(1)', title: 't' })).trim(),
    ).toBe('');
  });

  it('falls back to marketing for an unknown category, so nothing ungated can be asked for', async () => {
    const html = await render(Embed, {
      provider: 'vimeo',
      url: 'https://vimeo.com/12',
      title: 't',
      category: 'whatever',
    });
    expect(html).toContain('data-consent="marketing"');
  });
});

// EmDash's <PortableText> reads the site's merged plugin component map from a virtual module its
// own integration provides — which a container cannot register. Provide the real adapter for the
// block the test nests, so it resolves as in production. (Not the whole `blockComponents` map:
// that imports Section.astro, which imports `emdash/ui`, which awaits this very factory.)
vi.mock('virtual:emdash/block-components', async () => ({
  pluginBlockComponents: { 'vitops.logos': (await import('./Logos.astro')).default },
}));

vi.mock('virtual:emdash/config', () => ({ default: {} }));

describe('vitops_section', () => {
  it('renders the head, tone and a Portable Text body', async () => {
    const { default: Section } = await import('./Section.astro');
    const container = await AstroContainer.create();
    const html = await container.renderToString(Section as unknown as Component, {
      props: {
        value: {
          kicker: 'Why us',
          heading: 'Two services',
          level: '3',
          sub: 'Lead-in',
          layout: 'split',
          tone: 'surface',
          body: [
            {
              _type: 'block',
              _key: 'a',
              style: 'normal',
              children: [{ _type: 'span', _key: 'b', text: 'Body copy' }],
            },
            // The point of the block: another vitops.* block resolves INSIDE the body.
            { _type: 'vitops.logos', _key: 'c', logos: [{ image: '/x.svg', alt: 'Acme' }] },
          ],
        },
      },
    });
    expect(html).toContain('section region tone section--split');
    expect(html).toContain('<h3 class="section__title font-title">Two services</h3>');
    expect(html).toContain('Why us');
    expect(html).toContain('Body copy');
    expect(html).toContain('class="logos"');
    expect(html).toContain('alt="Acme"');
  }, 60_000);
});
