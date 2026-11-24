/**
 * `<SiteFooter>`'s contact column and logo, and `<Masthead>`'s logo, rendered for real (Astro's
 * container API) from `organization` in the site config. The resolution rules are asserted purely
 * in `footer.test.ts`; this proves the markup and the opt-outs. Runs only under
 * `vitest run -c vitest.container.config.ts`, like the other `*.container-test.ts` files.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';
// @ts-ignore: `.astro` modules have no declaration under the plain tsconfig.
import Masthead from './Masthead.astro';
// @ts-ignore: as above.
import SiteFooter from './SiteFooter.astro';

// `SiteFooter` renders `BackToTop` -> `Icon`, which reads the integration's virtual module.
vi.mock('virtual:getvitops/icons', () => ({
  default: { ui: 'ph', brand: 'ph', overrides: {}, engine: 'none' },
}));

const organization = {
  name: 'Acme Landscaping',
  logo: { src: '/logo.svg', alt: 'Acme Landscaping', width: 160, height: 48 },
  email: 'hello@acme.ca',
  phone: '(613) 555-0100',
  address: {
    streetAddress: '1 Main St',
    addressLocality: 'Ottawa',
    addressRegion: 'ON',
    postalCode: 'K1A 0B1',
  },
  links: { instagram: 'https://instagram.com/acme', facebook: 'javascript:alert(1)' },
  locations: {
    ottawa: {
      hours: [{ dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'], opens: '08:00', closes: '17:00' }],
    },
  },
};
const config = { organization };

const footer = async (props: Record<string, unknown> = {}) =>
  (await AstroContainer.create()).renderToString(SiteFooter, {
    props: { name: 'Acme', config, ...props },
  });
const masthead = async (props: Record<string, unknown> = {}, slots?: Record<string, string>) =>
  (await AstroContainer.create()).renderToString(Masthead, {
    props: { config, ...props },
    ...(slots ? { slots } : {}),
  });

describe('<SiteFooter /> from organization', () => {
  it('renders the logo in the brand column, linked home, with its alt', async () => {
    const html = await footer();
    expect(html).toMatch(
      /<a class="sitefooter__logo" href="\/">\s*<img src="\/logo\.svg" alt="Acme Landscaping"/,
    );
  });

  it('renders the address, a tel: link, a mailto: link, hours and profile links', async () => {
    const html = await footer();
    expect(html).toContain('<address class="sitefooter__address">');
    expect(html).toContain('1 Main St');
    expect(html).toContain('Ottawa, ON K1A 0B1');
    expect(html).toContain('href="tel:+16135550100"');
    expect(html).toContain('href="mailto:hello@acme.ca"');
    expect(html).toContain('<dt>Mon–Wed</dt>');
    expect(html).toContain('<dd>8 am–5 pm</dd>');
    expect(html).toContain('href="https://instagram.com/acme"');
  });

  it('never renders an unsafe profile link', async () => {
    const html = await footer();
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Facebook');
  });

  it('names its landmarks: the social nav has a label, the contact heading names the list', async () => {
    const html = await footer({ socialLabel: 'Follow us', contactLabel: 'Get in touch' });
    expect(html).toContain('<nav aria-label="Follow us">');
    expect(html).toContain('Get in touch');
  });

  it('turns the contact column and the logo off independently', async () => {
    const noContact = await footer({ contact: false });
    expect(noContact).not.toContain('sitefooter__group--contact');
    expect(noContact).toContain('sitefooter__logo');
    const noLogo = await footer({ logo: false });
    expect(noLogo).not.toContain('sitefooter__logo');
    expect(noLogo).toContain('sitefooter__group--contact');
  });

  it('lets a brand slot replace the logo', async () => {
    const html = await (
      await AstroContainer.create()
    ).renderToString(SiteFooter, {
      props: { name: 'Acme', config },
      slots: { brand: '<p>Our own blurb</p>' },
    });
    expect(html).toContain('Our own blurb');
    expect(html).not.toContain('sitefooter__logo');
  });

  it('is the footer it always was when the config states nothing', async () => {
    const html = await footer({ config: { organization: { name: 'Acme' } } });
    expect(html).not.toContain('sitefooter__group--contact');
    expect(html).not.toContain('sitefooter__logo');
    expect(html).toContain('sitefooter__copy');
  });
});

describe('<Masthead /> logo', () => {
  it('shows organization.logo as a linked brand when there is no brand slot', async () => {
    const html = await masthead();
    expect(html).toMatch(
      /<a class="masthead__brand" href="\/">\s*<img class="masthead__logo" src="\/logo\.svg" alt="Acme Landscaping"/,
    );
  });

  it('names a logo-only link even when the config gives a bare path and no name', async () => {
    const html = await masthead({ config: { organization: { logo: '/l.svg' } } });
    expect(html).toContain('alt="Home"');
  });

  it('lets the brand slot win, and logo={false} remove it', async () => {
    const own = await masthead({}, { brand: '<a href="/">Acme</a>' });
    expect(own).not.toContain('masthead__logo');
    const none = await masthead({ logo: false });
    expect(none).not.toContain('masthead__brand');
  });

  it('links the logo where brandHref says', async () => {
    const html = await masthead({ brandHref: '/en/' });
    expect(html).toContain('class="masthead__brand" href="/en/"');
  });
});
