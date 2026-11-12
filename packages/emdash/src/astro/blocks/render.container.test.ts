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
import Form from './Form.astro';
import head from './head.stub.ts';
import { SAMPLE_FORM_BLOCK } from './form.sample.ts';
import Hero from './Hero.astro';
import Logos from './Logos.astro';
import Pricing from './Pricing.astro';
import Stats from './Stats.astro';
import Steps from './Steps.astro';
import Tabs from './Tabs.astro';
import Tree from './Tree.astro';

// `.astro` imports are typed as plain prop functions here (see `astro-modules.d.ts`), which the
// container's `AstroComponentFactory` parameter does not accept; the cast is the whole bridge.
type Component = Parameters<AstroContainer['renderToString']>[0];
async function render(component: unknown, node: object) {
  const container = await AstroContainer.create();
  return container.renderToString(component as Component, { props: { node } });
}

describe('vitops_cards', () => {
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
    expect(html).toContain('<h4 class="card__title font-heading">Cut costs</h4>');
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
    expect(html).toContain('class="card subgrid-card tone tone--tint"');
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

describe('vitops_hero', () => {
  it('accents starred words and honours the heading level', async () => {
    const html = await render(Hero, { heading: 'Two services. *One team.*', level: '3' });
    expect(html).toContain(
      '<h3 class="font-display">Two services. <em class="accent">One team.</em></h3>',
    );
  });

  it('renders the optional cards slot', async () => {
    const html = await render(Hero, { heading: 'Hi', cards: [{ title: 'A', body: 'b' }] });
    // the hero defaults to h1, so its option cards sit one level down
    expect(html).toContain('<h2 class="font-heading">A</h2>');
    const under2 = await render(Hero, { heading: 'Hi', level: '2', cards: [{ title: 'A' }] });
    expect(under2).toContain('<h3 class="font-heading">A</h3>');
  });
});

describe('vitops_logos', () => {
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

  it('shows the name as text when an entry has no image, linked or not', async () => {
    const html = await render(Logos, {
      logos: [
        { alt: 'Acme Partners', href: '/acme' },
        { alt: 'Beta Group' },
        { image: '/c.svg', alt: 'Gamma' },
        { image: '', alt: '' },
      ],
    });
    expect(html).toContain('<span class="logos__name font-heading">Acme Partners</span>');
    expect(html).toContain('<span class="logos__name font-heading">Beta Group</span>');
    expect(html).toContain('<a href="/acme"><span');
    expect(html).toContain('alt="Gamma"');
    expect(html.match(/logos__item/g)).toHaveLength(3);
  });

  it('renders nothing with no logos', async () => {
    expect((await render(Logos, { logos: [] })).trim()).toBe('');
  });
});

describe('vitops_steps', () => {
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

describe('vitops_stats', () => {
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

describe('vitops_callout', () => {
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

describe('vitops_entries', () => {
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

describe('vitops_tabs', () => {
  const tabs = [
    { label: 'Overview', body: 'About us.' },
    { label: 'Pricing', body: 'Plans.' },
  ];

  it('emits <wc-tabs> over one headed section per tab, readable with no JS', async () => {
    const html = await render(Tabs, { level: '4', tabs });
    expect(html).toContain('<wc-tabs');
    expect(html).toContain('class="tabs"');
    expect(html).toContain('<section><h4>Overview</h4><p>About us.</p></section>');
    expect(html).toContain('<h4>Pricing</h4>');
  });

  it('passes orientation and the hash toggle through to the element', async () => {
    const html = await render(Tabs, { tabs, orientation: 'vertical', hash: true });
    expect(html).toContain('orientation="vertical"');
    expect(html).toMatch(/<wc-tabs[^>]*\shash/);
  });

  it('drops a tab with no label, and renders nothing when none is left', async () => {
    const html = await render(Tabs, { tabs: [{ label: '', body: 'x' }] });
    expect(html).not.toContain('wc-tabs');
  });

  it('puts the editor’s anchor on the element itself', async () => {
    const html = await render(Tabs, { tabs, anchor: 'compare' });
    expect(html).toMatch(/<wc-tabs[^>]*id="compare"/);
  });
});

describe('vitops_tree', () => {
  const outline = '- src\n  - index.ts | entry\n- package.json';

  it('emits <wc-tree> over real nested lists built from the outline', async () => {
    const html = await render(Tree, { _key: 'k1', outline });
    expect(html).toContain('<wc-tree');
    expect(html).toContain('index.ts');
    expect(html).toContain('entry');
    expect(html).toContain('package.json');
    expect(html).toMatch(/<details/);
  });

  it('gives each node an id prefixed with the block key, so two trees never collide', async () => {
    const a = await render(Tree, { _key: 'k1', outline });
    const b = await render(Tree, { _key: 'k2', outline });
    expect(a).toContain('id="tree-k1-src"');
    expect(b).toContain('id="tree-k2-src"');
  });

  it('renders markup typed into the outline as text, never as HTML', async () => {
    const html = await render(Tree, { outline: '<img src=x onerror=alert(1)> | <b>x</b>' });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;img');
  });

  it('renders nothing for an empty outline', async () => {
    expect(await render(Tree, { outline: '  \n ' })).not.toContain('wc-tree');
  });

  it('puts the editor’s anchor on the element itself', async () => {
    const html = await render(Tree, { outline, anchor: 'files' });
    expect(html).toMatch(/<wc-tree[^>]*id="files"/);
  });
});

describe('vitops_logos frame', () => {
  it('wraps the row with a kicker, note and link only when one is set', async () => {
    const bare = await render(Logos, { logos: [{ alt: 'Acme' }] });
    expect(bare).not.toContain('logos-block');
    const html = await render(Logos, {
      kicker: 'Trusted by',
      note: 'and 40 more',
      linkLabel: 'All partners',
      linkHref: '/partners',
      logos: [{ alt: 'Acme' }],
    });
    expect(html).toContain('<div class="logos-block">');
    expect(html).toContain('<p class="logos__kicker font-eyebrow">Trusted by</p>');
    expect(html).toContain('<p class="logos__note font-caption">and 40 more</p>');
    expect(html).toContain('<a class="link" href="/partners">All partners</a>');
    expect(html).toContain('aria-label="Partners"');
  });
});

describe('vitops_pricing', () => {
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

  it('carries a yearly line and a note per plan', async () => {
    const html = await render(Pricing, {
      plans: [
        {
          name: 'Pro',
          price: '$39',
          period: '/month',
          yearly: '$34 paid yearly',
          note: 'Best for teams',
        },
      ],
    });
    expect(html).toContain(
      '<small class="pricing-card__yearly font-caption">$34 paid yearly</small>',
    );
    expect(html).toContain('<p class="pricing-card__note font-caption">Best for teams</p>');
  });
});

describe('vitops_embed', () => {
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

// The data the two new blocks read: the reviews cache (a virtual module the `vitops()`
// integration serves; a container cannot register integrations) and EmDash's `getMenu`.
const fixtures = vi.hoisted(() => ({
  cache: { version: 1, locations: {} } as { version: 1; locations: Record<string, unknown> },
  menus: {} as Record<string, unknown>,
}));
vi.mock('virtual:getvitops/reviews', () => ({
  get default() {
    return fixtures.cache;
  },
}));
vi.mock('virtual:getvitops/icons', () => ({
  default: { ui: 'ph', brand: 'ph', overrides: {}, engine: 'none' },
}));
vi.mock('emdash', () => ({ getMenu: async (name: string) => fixtures.menus[name] ?? null }));

const review = (id: string, rating: number, extra: object = {}) => ({
  id,
  location: 'ottawa',
  rating,
  author: `Author ${id}`,
  text: `Text ${id}`,
  publishedAt: `2026-0${rating}-01T00:00:00Z`,
  updatedAt: '2026-01-01T00:00:00Z',
  ...extra,
});

describe('vitops_reviews', () => {
  it('renders nothing when the cache is empty (a fresh scaffold has no reviews.json)', async () => {
    fixtures.cache = { version: 1, locations: {} };
    const { default: Reviews } = await import('./Reviews.astro');
    // The dev-only note is allowed (vitest runs with DEV on); no card or wrapper is.
    const html = await render(Reviews, { _type: 'vitops_reviews' });
    expect(html).not.toContain('<article');
    expect(html).not.toMatch(/class="reviews[" ]/);
  });

  it('selects with selectReviews: minRating, sort, limit and featured-first', async () => {
    fixtures.cache = {
      version: 1,
      locations: {
        ottawa: {
          reviews: [review('a', 5), review('b', 4), review('c', 2), review('d', 5, { text: 'D' })],
        },
        toronto: { reviews: [review('z', 5)] },
      },
    };
    const { default: Reviews } = await import('./Reviews.astro');
    const html = await render(Reviews, {
      location: 'ottawa',
      minRating: '4',
      sort: 'rating',
      limit: 2,
      featured: 'b',
    });
    // Featured first, then best rated; the 2-star and the other location are out.
    const authors = [...html.matchAll(/Author (\w)</g)].map((m) => m[1]);
    expect(authors).toEqual(['b', 'a']);
    expect(html).not.toContain('Author z');
  });

  it('defaults avatars off, links the source with nofollow, and lays out as a subgrid', async () => {
    fixtures.cache = {
      version: 1,
      locations: {
        ottawa: {
          reviews: [
            review('a', 5, {
              authorPhoto: 'https://lh3.googleusercontent.com/x',
              url: 'https://g.co/r/1',
            }),
          ],
        },
      },
    };
    const { default: Reviews } = await import('./Reviews.astro');
    const html = await render(Reviews, { columns: '2' });
    expect(html).not.toContain('googleusercontent');
    expect(html).toContain('class="subgrid"');
    expect(html).toContain('--subgrid-cols: 2');
    expect(html).toMatch(
      /<a class="review__source link" href="https:\/\/g\.co\/r\/1" rel="nofollow/,
    );
    // JSON-LD is opt-in elsewhere and never emitted by the block.
    expect(html).not.toContain('application/ld+json');
    const withPhoto = await render(Reviews, { avatars: true });
    expect(withPhoto).toContain('googleusercontent');
  });

  it('carousel and marquee layouts use the existing components', async () => {
    fixtures.cache = { version: 1, locations: { ottawa: { reviews: [review('a', 5)] } } };
    const { default: Reviews } = await import('./Reviews.astro');
    const carousel = await render(Reviews, { layout: 'carousel', label: 'Praise' });
    expect(carousel).toContain('<wc-carousel');
    expect(carousel).toContain('aria-label="Praise"');
    expect(carousel).toContain('class="carousel__slide"');
    const marquee = await render(Reviews, { layout: 'marquee' });
    expect(marquee).toContain('<wc-marquee');
  });

  it('puts tone on the surrounding band, not on the cards', async () => {
    fixtures.cache = { version: 1, locations: { ottawa: { reviews: [review('a', 5)] } } };
    const { default: Reviews } = await import('./Reviews.astro');
    const html = await render(Reviews, { tone: 'brand-primary' });
    expect(html).toContain('class="reviews tone tone--tint"');
    expect(html).toContain('<article class="review"');
  });
});

describe('vitops_nav', () => {
  const menu = {
    label: 'Footer site map',
    items: [
      {
        label: 'Services',
        url: '/services',
        children: [{ label: 'Web', url: '/services/web' }],
      },
      { label: 'Contact', url: '/contact' },
      { label: 'Bad', url: 'javascript:alert(1)' },
    ],
  };

  it('renders a named <nav> with the list, current page and no javascript: link', async () => {
    fixtures.menus = { 'footer-sitemap': menu };
    const { default: Nav } = await import('./Nav.astro');
    const html = await render(Nav, { menu: 'footer-sitemap', depth: '2' });
    expect(html).toContain('<nav aria-label="Footer site map">');
    expect(html).toContain('class="navlist"');
    expect(html).toContain('class="navlist__sub"');
    expect(html).toContain('href="/services/web"');
    expect(html).not.toContain('javascript:');
  });

  it('depth 1 drops the sub-links; columns/inline add their modifier', async () => {
    fixtures.menus = { 'footer-sitemap': menu };
    const { default: Nav } = await import('./Nav.astro');
    const flat = await render(Nav, { menu: 'footer-sitemap', variant: 'columns' });
    expect(flat).toContain('navlist navlist--columns');
    expect(flat).not.toContain('/services/web');
  });

  it('never names itself like the header or footer landmark', async () => {
    fixtures.menus = { primary: { label: 'Primary', items: [{ label: 'A', url: '/a' }] } };
    const { default: Nav } = await import('./Nav.astro');
    const html = await render(Nav, { menu: 'primary' });
    expect(html).toContain('aria-label="Primary (this page)"');
  });

  it('heading is a real heading at the chosen level, outside the nav', async () => {
    fixtures.menus = { 'footer-sitemap': menu };
    const { default: Nav } = await import('./Nav.astro');
    const html = await render(Nav, { menu: 'footer-sitemap', heading: 'Explore', level: '3' });
    expect(html).toContain('<h3 class="font-heading">Explore</h3>');
    expect(html).toContain('<nav aria-label="Explore">');
  });

  it('the sitenav variant renders <SiteNav> with that label', async () => {
    fixtures.menus = { 'footer-sitemap': menu };
    const { default: Nav } = await import('./Nav.astro');
    const html = await render(Nav, { menu: 'footer-sitemap', variant: 'sitenav', _key: 'k1' });
    expect(html).toContain('sitenav__list');
    expect(html).toContain('aria-label="Footer site map"');
    expect(html).toContain('navblock-k1');
  });

  it('a missing menu, an empty one or a non-slug name renders nothing', async () => {
    fixtures.menus = { empty: { label: 'E', items: [] } };
    const { default: Nav } = await import('./Nav.astro');
    for (const name of ['nope', 'empty', '../etc'])
      expect((await render(Nav, { menu: name })).trim(), name).toBe('');
  });
});

// EmDash's <PortableText> reads the site's merged plugin component map from a virtual module its
// own integration provides — which a container cannot register. Provide the real adapter for the
// block the test nests, so it resolves as in production. (Not the whole `blockComponents` map:
// that imports Section.astro, which imports `emdash/ui`, which awaits this very factory.)
vi.mock('virtual:emdash/block-components', async () => ({
  pluginBlockComponents: { vitops_logos: (await import('./Logos.astro')).default },
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
            // The point of the block: another vitops_* block resolves INSIDE the body.
            { _type: 'vitops_logos', _key: 'c', logos: [{ image: '/x.svg', alt: 'Acme' }] },
          ],
        },
      },
    });
    expect(html).toContain('section region tone tone--tint section--split');
    expect(html).toContain('<h3 class="section__title font-title">Two services</h3>');
    expect(html).toContain('Why us');
    expect(html).toContain('Body copy');
    expect(html).toContain('class="logos"');
    expect(html).toContain('alt="Acme"');
  }, 60_000);

  it('is a page opener: accent heading, two actions and a rhythm stack', async () => {
    const { default: Section } = await import('./Section.astro');
    const container = await AstroContainer.create();
    const html = await container.renderToString(Section as unknown as Component, {
      props: {
        value: {
          heading: 'Two services. *One team.*',
          level: '1',
          sub: 'Lead',
          cta_label: 'Book a call',
          cta_href: '/contact',
          secondary_label: 'See pricing',
          secondary_href: '/pricing',
          stack: 'rhythm',
        },
      },
    });
    expect(html).toContain(
      '<h1 class="section__title font-title">Two services. <em class="accent">One team.</em></h1>',
    );
    expect(html).toContain('<a class="cta" href="/contact">Book a call</a>');
    expect(html).toContain('<a class="link" href="/pricing">See pricing</a>');
    expect(html).toContain('class="section__inner rhythm"');
  }, 60_000);
});

describe('vitops_form', () => {
  async function renderForm(node: object, path = '/contact') {
    const container = await AstroContainer.create();
    return container.renderToString(Form as unknown as Component, {
      props: { node },
      request: new Request(`http://localhost${path}`),
    });
  }

  it('renders a no-JS form: real labels, a post to the endpoint, and its own page as _next', async () => {
    head.turnstileSiteKey = null;
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).toContain('<form method="post" action="/api/track"');
    expect(html).toContain('name="_next" value="/contact"');
    expect(html).toMatch(/<label class="form-group__label" for="form-1-name">\s*Your name/);
    expect(html).toContain('id="form-1-name"');
    expect(html).toContain('autocomplete="name"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autocomplete="email"');
    expect(html).toContain('<textarea');
    expect(html).toContain('<option value="Design">Design</option>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Send message');
  });

  it('renders "tick any number" as a fieldset of checkboxes sharing one name', async () => {
    const html = await renderForm({
      ...SAMPLE_FORM_BLOCK,
      fields: [
        { label: 'Interests', name: 'interests', type: 'checkboxes', options: 'IT\nMarketing' },
      ],
    });
    expect(html).toContain('<fieldset');
    expect(html).toContain('<legend class="form-group__label">Interests</legend>');
    expect(html.match(/name="interests"/g)).toHaveLength(2);
    expect(html).toContain('value="Marketing"');
  });

  it('never submits a phone field as `phone`: the route drops that name', async () => {
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).toContain('name="tel"');
    expect(html).not.toContain('name="phone"');
    expect(html).toContain('autocomplete="tel"');
  });

  it('marks required fields and ties help text to its control', async () => {
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).toMatch(/id="form-2-email"[^>]*required/);
    expect(html).toContain('aria-describedby="form-2-email-help"');
    expect(html).toContain('id="form-2-email-help"');
    expect(html).toContain('(optional)');
  });

  it('ships a honeypot the route recognises, hidden from assistive tech and the tab order', async () => {
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).toMatch(/aria-hidden="true"[\s\S]*name="website"[^>]*tabindex="-1"/);
  });

  it('carries both result notices, revealed by the URL fragment, with the editor message', async () => {
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).toMatch(/id="form-sent"[^>]*role="status"/);
    expect(html).toMatch(/id="form-error"[^>]*role="alert"/);
    expect(html).toContain('form-notice--target');
    expect(html).toContain('Thanks, we will be in touch.');
  });

  it('has no Turnstile and no third-party reference without a site key', async () => {
    head.turnstileSiteKey = null;
    const html = await renderForm(SAMPLE_FORM_BLOCK);
    expect(html).not.toContain('wc-turnstile');
    expect(html).not.toContain('cloudflare.com');
  });

  it('renders <wc-turnstile> with its no-JS explanation when a site key exists, and no script', async () => {
    head.turnstileSiteKey = '0x4AAAAAAAexample1234';
    try {
      const html = await renderForm(SAMPLE_FORM_BLOCK);
      expect(html).toContain('<wc-turnstile sitekey="0x4AAAAAAAexample1234">');
      expect(html).toContain('data-turnstile-fallback');
      expect(html).toContain('needs JavaScript');
      // The widget script is loaded by the element on interaction, never emitted here.
      expect(html).not.toContain('<script');
      expect(html).not.toContain('challenges.cloudflare.com');
    } finally {
      head.turnstileSiteKey = null;
    }
  });

  it('refuses an off-site action and renders nothing for a form with no fields', async () => {
    const html = await renderForm({ ...SAMPLE_FORM_BLOCK, action: 'https://evil.example/steal' });
    expect(html).toContain('action="/api/track"');
    expect(html).not.toContain('evil.example');
    expect(await renderForm({ _type: 'vitops_form', fields: [] })).not.toContain('<form');
  });

  it('escapes editor text', async () => {
    const html = await renderForm({ ...SAMPLE_FORM_BLOCK, heading: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)');
  });
});

describe('escape hatches (anchor, className, style)', () => {
  const hatches = { anchor: 'x', className: 'mt-4', style: '--a: 1px; background: url(evil)' };
  const samples: [string, unknown, object][] = [
    ['callout', Callout, { heading: 'H', body: 'b' }],
    ['stats', Stats, { stats: [{ value: '1', label: 'a' }] }],
    ['steps', Steps, { steps: [{ title: 'a', text: 'b' }] }],
    ['logos', Logos, { logos: [{ image: '/a.png', alt: 'A' }] }],
    ['pricing', Pricing, { plans: [{ name: 'P', price: '$1' }] }],
    ['hero', Hero, { heading: 'H', body: 'b' }],
    ['cards (default)', Cards, { cards: [{ title: 'T' }] }],
    ['cards (panel)', Cards, { variant: 'panel', cards: [{ title: 'T' }] }],
  ];

  it.each(samples)(
    '%s: lands on its own element, with no wrapper node',
    async (name, component, fields) => {
      const html = (await render(component, { ...fields, ...hatches })).trim();
      // One id, one added class, the custom property kept and the fetching declaration dropped.
      expect(html.match(/id="x"/g)).toHaveLength(1);
      expect(html).toContain('mt-4');
      expect(html).toContain('block-anchor');
      expect(html).toContain('--a: 1px');
      expect(html).not.toContain('url(');
      expect(html).not.toContain('block-shell');
      // The element carrying it is the first one rendered, except `cards`, whose default variant is
      // a <wc-cards> host around the grid the attributes go on.
      if (!name.startsWith('cards')) expect(html).toMatch(/^<[a-z-]+[^>]*\sid="x"/);
    },
  );

  it.each(samples)(
    '%s: renders the same markup with none set',
    async (_name, component, fields) => {
      const html = await render(component, fields);
      expect(html).not.toContain('block-anchor');
      expect(html).not.toContain(' id="x"');
    },
  );
});

describe('per-item colour and hero card extras', () => {
  const rows = [
    { title: 'Pine', body: 'a', tone: 'success' },
    { title: 'Amber', body: 'b', color: 'amber' },
    { title: 'Plain', body: 'c' },
  ];

  it('a row sets its own --tone-* properties; a row with none inherits', async () => {
    const html = await render(Cards, { variant: 'panel', tone: 'info', cards: rows });
    const items = html.match(/<li[^>]*class="card[^"]*"[^>]*>/g)!;
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('--color-bg-success-muted');
    expect(items[1]).toContain('--color-amber-100');
    expect(items[2]).toContain('--color-bg-info-muted'); // the block's own
  });

  it('applies to stats and steps rows', async () => {
    const stats = await render(Stats, {
      stats: [{ value: '1', tone: 'danger' }, { value: '2' }],
    });
    expect(stats).toContain('stats__item" style="--tone-bg');
    const steps = await render(Steps, {
      steps: [{ title: 'A', color: 'amber' }, { title: 'B' }],
    });
    expect(steps).toContain('steps__item" style="--tone-bg');
  });

  it('hero cards take an eyebrow, a button and a tone', async () => {
    const html = await render(Hero, {
      heading: 'H',
      level: '1',
      cards: [{ title: 'Door', eyebrow: 'For IT', ctaLabel: 'Go', ctaHref: '/go', color: 'amber' }],
    });
    expect(html).toContain('class="font-eyebrow">For IT');
    expect(html).toContain('<a class="cta" href="/go">');
    expect(html).toContain('card subgrid-card tone');
    expect(html).not.toContain('stretched-link');
  });
});

describe('per-card theme', () => {
  it('tints one card without touching its siblings', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Cards as unknown as Component, {
      props: {
        value: {
          variant: 'panel',
          cards: [{ title: 'Without us', theme: 'danger' }, { title: 'With us' }],
        },
      },
    });
    const [first, second] = html.split('<li ').slice(1);
    expect(first).toContain('tone tone--tint');
    expect(first).toContain('--tone-bg');
    expect(second).not.toContain('--tone-bg');
  }, 60_000);
});
