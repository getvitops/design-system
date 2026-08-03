import { describe, expect, it } from 'vitest';
import { type GetvitopsSeoOptions, resolveSeo, type SeoProps } from './seo.ts';

const SITE = new URL('https://example.com');

const run = (
  defaults: GetvitopsSeoOptions = {},
  props: SeoProps = {},
  // `site?: URL | undefined`, not `site?: URL` — under exactOptionalPropertyTypes
  // those differ, and the no-site cases pass `{ site: undefined }` explicitly.
  ctx: { site?: URL | undefined; pathname?: string; search?: string } = {},
) => resolveSeo(defaults, props, { site: SITE, pathname: '/blog/post/', ...ctx });

/** The og:/twitter: tag lists are flat, so look tags up by key. */
const og = (r: ReturnType<typeof run>, property: string) =>
  r.openGraph.filter((t) => t.property === property).map((t) => t.content);
const tw = (r: ReturnType<typeof run>, name: string) =>
  r.twitter.find((t) => t.name === name)?.content;

describe('title', () => {
  it('applies the template to a page title', () => {
    expect(run({ titleTemplate: '%s · Acme' }, { title: 'Pricing' }).title).toBe('Pricing · Acme');
  });

  it('uses the page title verbatim when there is no template', () => {
    expect(run({}, { title: 'Pricing' }).title).toBe('Pricing');
  });

  it('does NOT apply the template to defaultTitle', () => {
    // Otherwise every untitled page reads "Acme · Acme".
    expect(run({ titleTemplate: '%s · Acme', defaultTitle: 'Acme' }, {}).title).toBe('Acme');
  });

  it('does NOT apply the template when the page title is already the site name', () => {
    // The homepage case, found by dogfooding: a page titled "Vitops" on a site
    // named "Vitops" was emitting "Vitops · Vitops".
    expect(run({ titleTemplate: '%s · Acme', siteName: 'Acme' }, { title: 'Acme' }).title).toBe(
      'Acme',
    );
    // A per-page siteName override participates in the same comparison.
    expect(
      run({ titleTemplate: '%s · Acme', siteName: 'Acme' }, { title: 'Beta', siteName: 'Beta' })
        .title,
    ).toBe('Beta');
  });

  it('falls back to siteName when there is no title or defaultTitle', () => {
    expect(run({ siteName: 'Acme' }, {}).title).toBe('Acme');
  });

  it('is null when nothing supplies one', () => {
    expect(run({}, {}).title).toBeNull();
  });

  it('replaces every %s in the template', () => {
    expect(run({ titleTemplate: '%s — %s' }, { title: 'X' }).title).toBe('X — X');
  });

  it('gives og:title and twitter:title the title WITHOUT the template', () => {
    // A social card already shows og:site_name and the domain, so "Pricing · Acme"
    // would sit directly above "Acme". <title> keeps the suffix because a browser
    // tab or search result has nothing else to disambiguate it.
    const r = run({ titleTemplate: '%s · Acme', siteName: 'Acme' }, { title: 'Pricing' });
    expect(r.title).toBe('Pricing · Acme');
    expect(r.socialTitle).toBe('Pricing');
    expect(og(r, 'og:title')).toEqual(['Pricing']);
    expect(tw(r, 'twitter:title')).toBe('Pricing');
  });

  it('keeps og:title and twitter:title in step with each other', () => {
    // The bug this component replaces: the social titles and <title> were computed
    // in separate places. They may differ by the template now — but by exactly
    // that, and never independently.
    for (const props of [{ title: 'Pricing' }, { title: 'X', ogTitle: 'Y' }, {}]) {
      const r = run({ titleTemplate: '%s · Acme', siteName: 'Acme' }, props);
      expect(og(r, 'og:title')).toEqual([r.socialTitle]);
      expect(tw(r, 'twitter:title')).toBe(r.socialTitle ?? undefined);
    }
  });

  it('lets ogTitle override the social headline without touching <title>', () => {
    const r = run(
      { titleTemplate: '%s · Acme' },
      { title: 'Pricing', ogTitle: 'Plans that scale' },
    );
    expect(r.title).toBe('Pricing · Acme');
    expect(og(r, 'og:title')).toEqual(['Plans that scale']);
  });

  it('falls back to the same value for both when the page has no title', () => {
    const r = run({ titleTemplate: '%s · Acme', defaultTitle: 'Acme' }, {});
    expect(r.title).toBe('Acme');
    expect(r.socialTitle).toBe('Acme');
  });

  it('leaves the two identical when no template is configured', () => {
    const r = run({}, { title: 'Pricing' });
    expect(r.title).toBe('Pricing');
    expect(r.socialTitle).toBe('Pricing');
  });
});

describe('canonical', () => {
  it('joins pathname onto site', () => {
    expect(run().canonical).toBe('https://example.com/blog/post/');
  });

  it('keeps the base prefix already present in pathname without doubling it', () => {
    // Astro.url.pathname includes `base`; being absolute it replaces site's path.
    expect(
      run({}, {}, { site: new URL('https://example.com'), pathname: '/docs/page/' }).canonical,
    ).toBe('https://example.com/docs/page/');
  });

  it('includes the search string only when asked', () => {
    expect(run({}, {}, { search: '?page=2' }).canonical).toBe(
      'https://example.com/blog/post/?page=2',
    );
  });

  it('honours an absolute canonical override', () => {
    expect(run({}, { canonical: 'https://other.test/x' }).canonical).toBe('https://other.test/x');
  });

  it('resolves a relative canonical override against site', () => {
    expect(run({}, { canonical: '/canonical/' }).canonical).toBe('https://example.com/canonical/');
  });

  it('is null without a site, rather than guessed from the request', () => {
    // A canonical derived from the dev/preview origin is worse than none — it can
    // de-index. astro-seo falls back to Astro.url here; we deliberately do not.
    const r = run({}, {}, { site: undefined });
    expect(r.canonical).toBeNull();
    expect(og(r, 'og:url')).toEqual([]);
  });
});

describe('robots', () => {
  it('is null when nothing asks for one', () => {
    // `index, follow` is the crawler default; restating it is noise.
    expect(run().robots).toBeNull();
  });

  it('falls back to the site default', () => {
    expect(run({ robots: 'index,follow,max-image-preview:large' }).robots).toBe(
      'index,follow,max-image-preview:large',
    );
  });

  it('composes the flags, spelling out both axes', () => {
    expect(run({}, { noindex: true }).robots).toBe('noindex, follow');
    expect(run({}, { nofollow: true }).robots).toBe('index, nofollow');
    expect(run({}, { noindex: true, nofollow: true }).robots).toBe('noindex, nofollow');
  });

  it('appends noarchive, nocache and extras', () => {
    expect(
      run({}, { noindex: true, noarchive: true, nocache: true, robotsExtras: 'max-snippet:-1' })
        .robots,
    ).toBe('noindex, follow, noarchive, nocache, max-snippet:-1');
  });

  it('lets a full override win over both the flags and the default', () => {
    expect(run({ robots: 'index,follow' }, { noindex: true, robots: 'none' }).robots).toBe('none');
  });

  it('lets the flags win over the site default', () => {
    expect(run({ robots: 'index,follow' }, { noindex: true }).robots).toBe('noindex, follow');
  });
});

describe('images', () => {
  it('makes a relative page image absolute against site', () => {
    expect(og(run({}, { image: '/og.png' }), 'og:image')).toEqual(['https://example.com/og.png']);
  });

  it('passes an absolute page image through', () => {
    expect(og(run({}, { image: 'https://cdn.test/a.png' }), 'og:image')).toEqual([
      'https://cdn.test/a.png',
    ]);
  });

  it('falls back to the site default image', () => {
    const r = run({ openGraph: { image: { url: '/default.png', alt: 'Acme' } } });
    expect(og(r, 'og:image')).toEqual(['https://example.com/default.png']);
    expect(og(r, 'og:image:alt')).toEqual(['Acme']);
  });

  it('does not lend the default image’s alt text to a page’s own image', () => {
    const r = run(
      { openGraph: { image: { url: '/default.png', alt: 'Default alt', width: 1200 } } },
      { image: '/page.png' },
    );
    expect(og(r, 'og:image')).toEqual(['https://example.com/page.png']);
    expect(og(r, 'og:image:alt')).toEqual([]);
    expect(og(r, 'og:image:width')).toEqual([]);
  });

  it('drops a relative image when there is no site to resolve it against', () => {
    // A relative og:image resolves against whatever origin served the page.
    expect(og(run({}, { image: '/og.png' }, { site: undefined }), 'og:image')).toEqual([]);
  });

  it('keeps an absolute image even without a site', () => {
    expect(
      og(run({}, { image: 'https://cdn.test/a.png' }, { site: undefined }), 'og:image'),
    ).toEqual(['https://cdn.test/a.png']);
  });

  it('emits dimensions and type only alongside an image', () => {
    expect(og(run({}, { imageWidth: 1200, imageHeight: 630 }), 'og:image:width')).toEqual([]);
    const r = run(
      {},
      { image: '/a.png', imageWidth: 1200, imageHeight: 630, imageType: 'image/png' },
    );
    expect(og(r, 'og:image:width')).toEqual(['1200']);
    expect(og(r, 'og:image:height')).toEqual(['630']);
    expect(og(r, 'og:image:type')).toEqual(['image/png']);
  });
});

describe('twitter', () => {
  it('upgrades the card to summary_large_image when an image resolves', () => {
    expect(tw(run({}, { image: '/a.png' }), 'twitter:card')).toBe('summary_large_image');
  });

  it('falls back to summary with no image', () => {
    expect(tw(run(), 'twitter:card')).toBe('summary');
  });

  it('honours the configured card only when there is no image', () => {
    expect(tw(run({ twitter: { card: 'player' } }), 'twitter:card')).toBe('player');
    expect(tw(run({ twitter: { card: 'player' } }, { image: '/a.png' }), 'twitter:card')).toBe(
      'summary_large_image',
    );
  });

  it('prefers a page creator over the site default', () => {
    expect(
      tw(run({ twitter: { creator: '@acme' } }, { twitterCreator: '@ada' }), 'twitter:creator'),
    ).toBe('@ada');
  });
});

describe('open graph misc', () => {
  it('normalises og:locale to the underscore form', () => {
    expect(og(run({ openGraph: { locale: 'en-CA' } }), 'og:locale')).toEqual(['en_CA']);
    expect(og(run({ openGraph: { locale: 'en_CA' } }), 'og:locale')).toEqual(['en_CA']);
  });

  it('emits one og:locale:alternate per configured locale', () => {
    expect(
      og(run({ openGraph: { localeAlternates: ['fr-CA', 'es-MX'] } }), 'og:locale:alternate'),
    ).toEqual(['fr_CA', 'es_MX']);
  });

  it('defaults og:type to website and lets a page override it', () => {
    expect(og(run(), 'og:type')).toEqual(['website']);
    expect(og(run({}, { type: 'profile' }), 'og:type')).toEqual(['profile']);
  });

  it('emits article tags only when the type is article', () => {
    const article = { publishedTime: '2026-01-01', authors: ['Ada', 'Grace'], tags: ['a', 'b'] };
    expect(og(run({}, { article }), 'article:published_time')).toEqual([]);
    const r = run({}, { type: 'article', article });
    expect(og(r, 'article:published_time')).toEqual(['2026-01-01']);
    expect(og(r, 'article:author')).toEqual(['Ada', 'Grace']);
    expect(og(r, 'article:tag')).toEqual(['a', 'b']);
  });

  it('omits tags whose value is absent rather than emitting empty content', () => {
    const r = run();
    expect(og(r, 'og:description')).toEqual([]);
    expect(og(r, 'og:site_name')).toEqual([]);
  });
});

describe('verification + alternates', () => {
  it('emits the verification tokens under their expected meta names', () => {
    expect(
      run({ googleSiteVerification: 'g-tok', bingSiteVerification: 'b-tok' }).verification,
    ).toEqual([
      { name: 'google-site-verification', content: 'g-tok' },
      { name: 'msvalidate.01', content: 'b-tok' },
    ]);
  });

  it('passes alternates through untouched and never infers them', () => {
    const alternates = [
      { hreflang: 'en', href: 'https://example.com/en/post/' },
      { hreflang: 'x-default', href: 'https://example.com/post/' },
    ];
    expect(run({ openGraph: { localeAlternates: ['fr'] } }, { alternates }).alternates).toEqual(
      alternates,
    );
    // Locale config must not become hreflang links — the deleted component did
    // exactly that and pointed every page's alternates at the homepage.
    expect(run({ openGraph: { localeAlternates: ['fr'] } }, {}).alternates).toEqual([]);
  });
});
