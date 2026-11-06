/**
 * Real rendered HTML for `<SiteNav />` / `<SiteFooter />` via the container API (see
 * `container.test.ts` for why). The pure decisions are in `sitenav.test.ts`; this proves
 * the markup contract the CSS depends on survives a real render.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
// @ts-ignore -- this package's tsconfig has no `*.astro` module declaration (container.test.ts has the same gap)
import SiteFooter from './SiteFooter.astro';
// @ts-ignore -- as above
import SiteNav from './SiteNav.astro';

const primary = {
  items: [
    {
      label: 'Services',
      url: '/services',
      children: [{ label: 'Web', url: '/services/web', titleAttr: 'Fast sites' }],
    },
    { label: 'Contact', url: '/contact' },
  ],
};

const render = async (props: Record<string, unknown>) =>
  (await AstroContainer.create()).renderToString(SiteNav, { props });

describe('<SiteNav />', () => {
  it('renders the drawer + branch contract sitenav.css styles', async () => {
    const html = await render({ primary, current: '/contact' });
    expect(html).toContain('<nav class="sitenav sitenav--bp-md sitenav--drawer-end"');
    expect(html).toContain('aria-label="Primary"');
    expect(html).toMatch(/<button[^>]*class="sitenav__toggle"[^>]*popovertarget="sitenav-default"/);
    expect(html).toMatch(/<div id="sitenav-default" popover/);
    expect(html).toContain('sitenav__item--branch');
    // The link is a sibling of <details>, never inside <summary>.
    expect(html).toMatch(/<\/a><details class="sitenav__disclosure">/);
    expect(html).toContain('aria-label="Show Services submenu"');
    expect(html).toContain('<ul class="sitenav__submenu" role="list">');
  });

  it('marks only the current page and shows the titleAttr as a description, not a tooltip', async () => {
    const html = await render({ primary, current: '/contact/' });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/contact"[^>]*aria-current="page"/);
    expect(html).toContain('<span class="sitenav__desc">Fast sites</span>');
    expect(html).not.toContain('title="Fast sites"');
  });

  it('never pre-opens a disclosure (an [open] one pins its dropdown at width)', async () => {
    const html = await render({ primary, current: '/services/web' });
    expect(html).not.toMatch(/<details[^>]* open/);
  });

  it('a primary-mobile menu swaps the small-screen nav with no other change', async () => {
    const mobile = { items: [{ label: 'Call', url: 'tel:+16135550100' }] };
    const html = await render({ primary, mobile });
    expect(html).toContain('sitenav-tier--mobile sitenav-tier--below-md');
    expect(html).toContain('sitenav-tier--default sitenav-tier--from-md');
    expect(html).toContain('id="sitenav-mobile"');
    // Depth 1: the mobile nav carries no branch markup even though the data could.
    const mobileHtml = html.slice(
      html.indexOf('sitenav-tier--mobile'),
      html.indexOf('sitenav-tier--default'),
    );
    expect(mobileHtml).not.toContain('sitenav__disclosure');
  });

  it('a primary-mega menu adds a mega tier from xl', async () => {
    const html = await render({ primary, mega: primary });
    expect(html).toContain('sitenav--mega');
    expect(html).toContain('sitenav-tier--from-xl');
    expect(html).toContain('sitenav-tier--below-xl');
  });

  it('renders nothing when no menu exists', async () => {
    expect((await render({})).trim()).toBe('');
  });
});

describe('<SiteFooter />', () => {
  const sitemap = { items: [{ label: 'Home', url: '/' }] };
  const legal = { items: [{ label: 'Privacy Policy', url: '/privacy' }] };
  const renderFooter = async (props: Record<string, unknown>) =>
    (await AstroContainer.create()).renderToString(SiteFooter, { props });

  it('renders both menus as named nav landmarks plus the copyright', async () => {
    const html = await renderFooter({
      sitemap,
      legal,
      name: 'Acme',
      year: 2030,
      current: '/privacy',
    });
    expect(html).toContain('<footer class="sitefooter"');
    expect(html).toContain('aria-label="Site map"');
    expect(html).toContain('aria-label="Legal"');
    expect(html).toMatch(/href="\/privacy"[^>]*aria-current="page"/);
    expect(html).toContain('&copy; 2030 Acme');
  });

  it('is just the copyright line for a site with no footer menus', async () => {
    const html = await renderFooter({ name: 'Acme', year: 2030 });
    expect(html).not.toContain('<nav');
    expect(html).toContain('sitefooter__copy');
  });
});
