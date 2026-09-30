import { describe, expect, it } from 'vite-plus/test';
import { consentCategories, resolveAnalytics, type ResolvedTag } from './analytics.ts';

const tag = (result: ReturnType<typeof resolveAnalytics>, key: ResolvedTag['key']) =>
  result.tags.find((t) => t.key === key);

describe('resolveAnalytics', () => {
  it('emits nothing when nothing is configured', () => {
    const result = resolveAnalytics(undefined);
    expect(result.tags).toEqual([]);
    expect(result.needsRuntime).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('accepts the shorthand string and the object form identically', () => {
    const short = resolveAnalytics({ googleAnalytics: 'G-ABC123' }, { consent: true });
    const long = resolveAnalytics({ googleAnalytics: { id: 'G-ABC123' } }, { consent: true });
    expect(short.tags).toEqual(long.tags);
  });
});

/**
 * The category a provider needs is *derived* from whether it sets cookies. This is
 * the file's central claim, and the reason a consumer can't mark Google Analytics
 * `necessary` to dodge a banner.
 */
describe('consent category', () => {
  it('gates Google Analytics behind `analytics`', () => {
    const ga = tag(
      resolveAnalytics({ googleAnalytics: 'G-ABC123' }, { consent: true }),
      'googleAnalytics',
    );
    expect(ga?.category).toBe('analytics');
    expect(ga?.setsCookies).toBe(true);
  });

  it('gates Clarity behind `analytics`', () => {
    const clarity = tag(resolveAnalytics({ clarity: 'abcd1234' }, { consent: true }), 'clarity');
    expect(clarity?.category).toBe('analytics');
    expect(clarity?.setsCookies).toBe(true);
  });

  it('lets a Google Analytics property that feeds Ads be gated as `marketing`', () => {
    const ga = tag(
      resolveAnalytics(
        { googleAnalytics: { id: 'G-ABC123', category: 'marketing' } },
        { consent: true },
      ),
      'googleAnalytics',
    );
    expect(ga?.category).toBe('marketing');
  });

  it('treats Plausible as `necessary` — it is cookieless, so there is nothing to ask', () => {
    const p = tag(resolveAnalytics({ plausible: 'example.com' }), 'plausible');
    expect(p?.category).toBe('necessary');
    expect(p?.setsCookies).toBe(false);
    expect(p?.cookies).toEqual([]);
  });

  it('treats Matomo as `necessary` by default and `analytics` once cookies are on', () => {
    const off = tag(
      resolveAnalytics({ matomo: { url: 'https://m.example.com', siteId: '1' } }),
      'matomo',
    );
    expect(off?.category).toBe('necessary');
    expect(off?.setsCookies).toBe(false);

    const on = tag(
      resolveAnalytics(
        { matomo: { url: 'https://m.example.com', siteId: '1', cookies: true } },
        { consent: true },
      ),
      'matomo',
    );
    expect(on?.category).toBe('analytics');
    expect(on?.setsCookies).toBe(true);
    expect(on?.cookies).toContain('_pk_id*');
  });
});

describe('provider bootstraps', () => {
  it('pushes disableCookies before trackPageView, or the first request sets them anyway', () => {
    const matomo = tag(
      resolveAnalytics({ matomo: { url: 'https://m.example.com', siteId: '7' } }),
      'matomo',
    );
    const inline = matomo?.inline ?? '';
    expect(inline).toContain('disableCookies');
    expect(inline.indexOf('disableCookies')).toBeLessThan(inline.indexOf('trackPageView'));
  });

  it('omits disableCookies entirely when cookies are opted into', () => {
    const matomo = tag(
      resolveAnalytics(
        { matomo: { url: 'https://m.example.com', siteId: '7', cookies: true } },
        { consent: true },
      ),
      'matomo',
    );
    expect(matomo?.inline).not.toContain('disableCookies');
  });

  it('normalises a Matomo URL with a trailing slash or a path to exactly one slash', () => {
    for (const url of [
      'https://m.example.com',
      'https://m.example.com/',
      'https://m.example.com/mtm//',
    ]) {
      const matomo = tag(resolveAnalytics({ matomo: { url, siteId: '1' } }), 'matomo');
      expect(matomo?.inline).not.toContain('//matomo.php');
      expect(matomo?.inline).toContain("+'matomo.php'");
    }
  });

  it('tells Clarity consent was given, since Microsoft enforces the signal separately', () => {
    const clarity = tag(resolveAnalytics({ clarity: 'abc' }, { consent: true }), 'clarity');
    expect(clarity?.inline).toContain("analytics_Storage:'granted'");
    expect(clarity?.inline).toContain("ad_Storage:'denied'");
  });

  it("grants Clarity's ad_Storage only when the tag itself was gated as marketing", () => {
    const clarity = tag(
      resolveAnalytics({ clarity: { id: 'abc', category: 'marketing' } }, { consent: true }),
      'clarity',
    );
    expect(clarity?.inline).toContain("ad_Storage:'granted'");
  });

  it('forwards extra gtag config parameters', () => {
    const ga = tag(
      resolveAnalytics(
        { googleAnalytics: { id: 'G-ABC', config: { send_page_view: false } } },
        { consent: true },
      ),
      'googleAnalytics',
    );
    expect(ga?.inline).toContain('"send_page_view":false');
  });
});

/**
 * IDs are interpolated into an inline <script>. They come from a config file
 * rather than a visitor, so this is a low-likelihood path — but its consequence
 * is arbitrary script execution, so it is checked rather than trusted.
 */
describe('input validation', () => {
  it.each([
    ['googleAnalytics', { googleAnalytics: 'G-A</script><script>alert(1)</script>' }],
    ['clarity', { clarity: 'a"+alert(1)+"' }],
    ['plausible', { plausible: "x';alert(1);'" }],
    ['matomo', { matomo: { url: 'https://m.example.com', siteId: "1';alert(1);'" } }],
  ])('drops a %s id that could break out of the inline script', (_name, opts) => {
    const result = resolveAnalytics(opts);
    expect(result.tags).toEqual([]);
    expect(result.warnings.join(' ')).toContain('Skipped');
  });

  it('drops a Matomo instance whose URL will not parse', () => {
    const result = resolveAnalytics({ matomo: { url: 'not a url', siteId: '1' } });
    expect(result.tags).toEqual([]);
    expect(result.warnings.join(' ')).toContain('not a valid URL');
  });

  it('escapes `<` in forwarded gtag config so it cannot close the script element', () => {
    const ga = tag(
      resolveAnalytics(
        { googleAnalytics: { id: 'G-ABC', config: { page_title: '</script><script>' } } },
        { consent: true },
      ),
      'googleAnalytics',
    );
    expect(ga?.inline).not.toContain('</script>');
    expect(ga?.inline).toContain('\\u003c');
  });
});

describe('loading strategy', () => {
  it('defaults every tag to idle — off the critical path', () => {
    const result = resolveAnalytics({ plausible: 'example.com' });
    expect(result.tags[0]?.strategy).toBe('idle');
  });

  it('applies the configured strategy to every tag', () => {
    const result = resolveAnalytics(
      { plausible: 'example.com', googleAnalytics: 'G-ABC', strategy: 'interaction' },
      { consent: true },
    );
    expect(result.tags.map((t) => t.strategy)).toEqual(['interaction', 'interaction']);
  });

  it('needs no runtime at all for a cookieless provider on `async`', () => {
    // The one configuration that ships zero consent JavaScript: nothing to gate,
    // nothing to schedule.
    const result = resolveAnalytics({ plausible: 'example.com', strategy: 'async' });
    expect(result.tags[0]?.gated).toBe(false);
    expect(result.needsRuntime).toBe(false);
  });

  it('still needs the runtime for a cookieless provider on idle — someone has to schedule it', () => {
    const result = resolveAnalytics({ plausible: 'example.com', strategy: 'idle' });
    expect(result.tags[0]?.gated).toBe(true);
    expect(result.needsRuntime).toBe(true);
  });
});

describe('warnings', () => {
  it('flags a cookie-setting provider running without a consent gate', () => {
    const result = resolveAnalytics({ googleAnalytics: 'G-ABC' }, { consent: false });
    const warning = result.warnings.join(' ');
    expect(warning).toContain('Google Analytics');
    expect(warning).toContain('_ga');
    expect(warning).toContain('consent: true');
  });

  it('says nothing when every configured provider is cookieless', () => {
    const result = resolveAnalytics(
      { plausible: 'example.com', matomo: { url: 'https://m.example.com', siteId: '1' } },
      { consent: false },
    );
    expect(result.warnings).toEqual([]);
  });

  it('names every offending provider, not just the first', () => {
    const result = resolveAnalytics(
      { googleAnalytics: 'G-ABC', clarity: 'xyz' },
      { consent: false },
    );
    const warning = result.warnings.join(' ');
    expect(warning).toContain('Google Analytics');
    expect(warning).toContain('Microsoft Clarity');
  });
});

describe('consentCategories', () => {
  it('offers only the categories something is actually waiting on', () => {
    const { tags } = resolveAnalytics(
      { googleAnalytics: 'G-ABC', plausible: 'example.com' },
      { consent: true },
    );
    expect(consentCategories(tags)).toEqual(['analytics']);
  });

  it('is empty when every provider is cookieless', () => {
    const { tags } = resolveAnalytics({ plausible: 'example.com' });
    expect(consentCategories(tags)).toEqual([]);
  });

  it('returns categories in a stable order regardless of provider order', () => {
    const { tags } = resolveAnalytics(
      { clarity: { id: 'x', category: 'marketing' }, googleAnalytics: 'G-ABC' },
      { consent: true },
    );
    expect(consentCategories(tags)).toEqual(['analytics', 'marketing']);
  });
});

/**
 * The A/B-testing reporting hook: each provider's bootstrap reads its
 * experiment cookies client-side and reports the assignment via that
 * provider's own mechanism. No experiments configured must be a total no-op
 * — the `resolveAnalytics.test.ts` suite above already pins the
 * no-experiments byte-for-byte output for all three providers, so these
 * only cover what changes once `ctx.experiments` is non-empty.
 */
describe('experiment reporting hook', () => {
  const experiments = { 'contact-form-v2': { cookieName: '_ab_contact-form-v2' } };

  it('is a no-op for all three providers when no experiments are configured', () => {
    const withCtx = resolveAnalytics(
      {
        googleAnalytics: 'G-ABC',
        matomo: { url: 'https://x.matomo.cloud', siteId: '1' },
        plausible: 'example.com',
      },
      { consent: true },
    );
    const withoutCtx = resolveAnalytics(
      {
        googleAnalytics: 'G-ABC',
        matomo: { url: 'https://x.matomo.cloud', siteId: '1' },
        plausible: 'example.com',
      },
      { consent: true, experiments: {} },
    );
    expect(withCtx.tags).toEqual(withoutCtx.tags);
  });

  it('Plausible: adds a plausible.init(customProperties) call reading the cookie', () => {
    const p = tag(resolveAnalytics({ plausible: 'example.com' }, { experiments }), 'plausible');
    expect(p?.inline).toContain('plausible.init({customProperties:function()');
    expect(p?.inline).toContain('_ab_contact-form-v2');
    expect(p?.inline).toContain('"contact-form-v2"');
  });

  it('Plausible: unchanged src/attrs, no manual-pageview attribute added', () => {
    const p = tag(resolveAnalytics({ plausible: 'example.com' }, { experiments }), 'plausible');
    expect(p?.src).toBe('https://plausible.io/js/script.js');
    expect(p?.attrs).toEqual({ 'data-domain': 'example.com' });
  });

  it('Matomo: pushes setCustomDimension before trackPageView, only for experiments with a recorded index', () => {
    const m = tag(
      resolveAnalytics(
        { matomo: { url: 'https://x.matomo.cloud', siteId: '1' } },
        { experiments, matomoAbVariantDimensions: { 'contact-form-v2': 3 } },
      ),
      'matomo',
    );
    const dimensionIndex = m?.inline.indexOf('setCustomDimension') ?? -1;
    const pageviewIndex = m?.inline.indexOf('trackPageView') ?? -1;
    expect(dimensionIndex).toBeGreaterThan(-1);
    expect(dimensionIndex).toBeLessThan(pageviewIndex);
    expect(m?.inline).toContain("'setCustomDimension',3");
  });

  it('Matomo: an experiment with no recorded dimension index pushes nothing', () => {
    const m = tag(
      resolveAnalytics(
        { matomo: { url: 'https://x.matomo.cloud', siteId: '1' } },
        { experiments, matomoAbVariantDimensions: {} },
      ),
      'matomo',
    );
    expect(m?.inline).not.toContain('setCustomDimension');
  });

  it('GA4: merges the variant into the runtime gtag config call, not a static one', () => {
    const ga = tag(
      resolveAnalytics({ googleAnalytics: 'G-ABC123' }, { experiments }),
      'googleAnalytics',
    );
    expect(ga?.inline).toContain('Object.assign(');
    expect(ga?.inline).toContain('_ab_contact-form-v2');
  });

  it('reports two concurrent experiments as distinct keys, not one overwriting another', () => {
    const twoExperiments = {
      'contact-form-v2': { cookieName: '_ab_contact-form-v2' },
      'pricing-layout': { cookieName: '_ab_pricing-layout' },
    };
    const p = tag(
      resolveAnalytics({ plausible: 'example.com' }, { experiments: twoExperiments }),
      'plausible',
    );
    expect(p?.inline).toContain('contact-form-v2');
    expect(p?.inline).toContain('pricing-layout');
  });
});
