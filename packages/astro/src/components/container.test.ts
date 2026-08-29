/**
 * `experimental_AstroContainer`-based render tests — the tier-3 SSR contract
 * asserted against REAL rendered HTML, not source text. Every other test in
 * this directory (`seo.test.ts`, `analytics.test.ts`, `head.test.ts`) reads
 * the `.astro` file with `readFileSync` and regexes it, which catches a
 * structural regression in the SOURCE but never proves the component
 * actually renders — a prop destructured wrong, a slot that silently drops
 * content, an `Astro.props` shape mismatch would all pass a source-text
 * check and fail every real page.
 *
 * Deliberately a representative set, not exhaustive: this establishes the
 * pattern (and proves it works against a plain `vitest` config with no
 * Astro/Vite integration registered — the container API works standalone)
 * rather than covering all ~20 components in one pass.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';
import Cards from './Cards.astro';
import Details from './Details.astro';
import NodeRenderer from './NodeRenderer.astro';
import Popover from './Popover.astro';
import Subgrid from './Subgrid.astro';

// `Icon.astro` (used by `Details`/`Popover`) reads this virtual module,
// provided at runtime by the `vitops()` integration's own Vite plugin. The
// container API explicitly cannot register integrations (`astroConfig` is
// typed `Omit<AstroUserConfig, 'integrations' | 'adapter'>`), so there is no
// real one to register here — this is the minimal shape Icon.astro reads,
// `engine: 'none'` on purpose so it takes the "not configured, render an
// empty box and warn" path rather than needing a real @iconify-json set.
vi.mock('virtual:getvitops/icons', () => ({
  default: { ui: 'ph', brand: 'ph', overrides: {}, engine: 'none' },
}));

describe('<Subgrid />', () => {
  it('renders a <ul> with the subgrid class and passes the slot through verbatim', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Subgrid, {
      slots: { default: '<li id="a" data-x="1" class="card">One</li>' },
    });
    expect(html).toContain('class="subgrid"');
    expect(html).toContain('role="list"');
    // Verbatim: id/data-*/class on the slotted item all survive untouched —
    // the whole point of the "no parsing" rewrite this file's docblock
    // describes.
    expect(html).toContain('<li id="a" data-x="1" class="card">One</li>');
  });

  it('renders as="div" with no list role', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Subgrid, {
      props: { as: 'div' },
      slots: { default: '<div>item</div>' },
    });
    expect(html).toContain('<div class="subgrid"');
    expect(html).not.toContain('role="list"');
  });

  it('an explicit role wins over the automatic list role', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Subgrid, {
      props: { role: 'group' },
      slots: { default: '<li>x</li>' },
    });
    expect(html).toContain('role="group"');
    expect(html).not.toContain('role="list"');
  });
});

describe('<Cards />', () => {
  it('wraps a <Subgrid> in <wc-cards>, passing the item selector through', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Cards, {
      props: { item: '.tile' },
      slots: { default: '<li class="tile">One</li>' },
    });
    expect(html).toContain('<wc-cards item=".tile">');
    expect(html).toContain('class="subgrid"');
    expect(html).toContain('<li class="tile">One</li>');
  });
});

describe('<NodeRenderer />', () => {
  it('renders a ContentNode tree to real HTML, localizing text nodes', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NodeRenderer, {
      props: {
        nodes: [
          {
            tag: 'p',
            attrs: {},
            children: [{ tag: '#text', attrs: {}, text: { en: 'Hello', fr: 'Bonjour' } }],
          },
        ],
        locale: 'fr',
        defaultLocale: 'en',
      },
    });
    expect(html).toContain('<p>Bonjour</p>');
  });

  it('wraps in the given attrs element when provided', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(NodeRenderer, {
      props: {
        nodes: [{ tag: 'span', attrs: {}, text: { en: 'x' } }],
        attrs: { class: 'wrapper', id: 'main' },
      },
    });
    expect(html).toContain('class="wrapper"');
    expect(html).toContain('id="main"');
    expect(html).toContain('<span>x</span>');
  });
});

describe('<Details />', () => {
  it('renders a native <details>/<summary> disclosure with the given label', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Details, {
      props: { label: 'More info', items: [{ label: 'Link one', href: '/one' }] },
      slots: { content: '<ul><li><a href="/one">Link one</a></li></ul>' },
    });
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('More info');
    expect(html).toContain('href="/one"');
  });
});

describe('<Popover />', () => {
  it('renders a [popover] target with a default trigger button', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Popover, {
      props: { id: 'demo-popover', trigger: { label: 'Open' } },
    });
    expect(html).toContain('popovertarget="demo-popover"');
    expect(html).toContain('id="demo-popover"');
    expect(html).toContain('Open');
  });

  it('renders as a <dialog> when as="dialog"', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Popover, {
      props: { id: 'demo-dialog', as: 'dialog', trigger: { label: 'Open' } },
    });
    expect(html).toMatch(/<dialog[^>]*id="demo-dialog"/);
  });
});
