/**
 * Render `<ContactForm />` for real (Astro's container API). The pure field decisions are tested in
 * `@getvitops/utils/contact-form`; this proves the component turns them into the markup the
 * conversion route understands. Runs only under `vitest run -c vitest.container.config.ts` (from
 * packages/astro), like the other `*.container-test.ts` files.
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';
// @ts-ignore: `.astro` modules have no declaration under the plain tsconfig.
import ContactForm from './ContactForm.astro';

const head = vi.hoisted(() => ({ turnstileSiteKey: null as string | null }));
vi.mock('virtual:getvitops/head', () => ({ default: head }));

async function render(props: Record<string, unknown> = {}, path = '/contact/') {
  const container = await AstroContainer.create();
  return container.renderToString(ContactForm as never, {
    props,
    request: new Request(`https://acme.ca${path}`),
  });
}

describe('<ContactForm />', () => {
  it('is a no-JS form posting to the conversion route, with the return path as _next', async () => {
    head.turnstileSiteKey = null;
    const html = await render();
    expect(html).toContain('<form method="post" action="/api/track"');
    expect(html).toContain('<input type="hidden" name="_next" value="/contact/"');
  });

  it('defaults to name, email, phone and message, and submits the phone as `tel`', async () => {
    const html = await render();
    for (const name of ['name', 'email', 'tel', 'message'])
      expect(html).toMatch(new RegExp(`name="${name}"`));
    expect(html).not.toContain('name="phone"');
    expect(html).toContain('<textarea');
    expect(html).toMatch(/type="email"[^>]*name="email"|name="email"[^>]*type="email"/);
  });

  it('takes the fields it is given, and still keeps clear of the route-reserved names', async () => {
    const html = await render({
      fields: [
        { label: 'Your name', required: true },
        { label: 'Phone', name: 'phone', type: 'tel' },
      ],
    });
    expect(html).toContain('name="your_name"');
    expect(html).toContain('name="tel"');
    expect(html).not.toContain('name="phone"');
    expect(html).not.toContain('name="email"');
  });

  it('carries a honeypot the route recognises, hidden from assistive tech and the tab order', async () => {
    const html = await render();
    expect(html).toMatch(/<input[^>]*name="website"[^>]*tabindex="-1"/);
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders both messages, for the no-JS round trip to reveal one by fragment', async () => {
    const html = await render();
    expect(html).toContain('id="form-sent"');
    expect(html).toContain('id="form-error"');
    expect(html).toContain('Thanks. Your message has been sent.');
  });

  it('emits no Turnstile widget, and no third-party reference, without a site key', async () => {
    head.turnstileSiteKey = null;
    const html = await render();
    expect(html).not.toContain('wc-turnstile');
    expect(html).not.toContain('challenges.cloudflare.com');
  });

  it('emits the widget when the site has a key, and lets a prop override or disable it', async () => {
    head.turnstileSiteKey = '0xSITE';
    expect(await render()).toContain('<wc-turnstile sitekey="0xSITE"');
    expect(await render({ turnstileSiteKey: '0xOTHER' })).toContain('sitekey="0xOTHER"');
    expect(await render({ turnstileSiteKey: null })).not.toContain('wc-turnstile');
  });

  it('only posts to a same-site path, so the action cannot be pointed off-site', async () => {
    const html = await render({ action: 'https://evil.example/collect' });
    expect(html).toContain('action="/api/track"');
    expect(html).not.toContain('evil.example');
  });

  it('puts extra attributes on the outer element', async () => {
    const html = await render({ id: 'enquiry', class: 'wide' });
    expect(html).toMatch(/<div[^>]*id="enquiry"[^>]*class="[^"]*form-block[^"]*wide/);
  });
});
