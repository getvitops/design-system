/**
 * These assertions exist because the failure mode is silent and the artifact is
 * a published legal document. A policy that names the wrong analytics provider,
 * claims to collect data a form never asks for, or ships a literal `${countries}`
 * still *reads* like a privacy policy — and is worse than having none, because
 * it is a public statement about data handling that is not true.
 *
 * So the invariants pinned here are mostly about **truthfulness under change**:
 * that the document describes the config it was given, and that a construct the
 * renderer cannot express fails loudly rather than degrading.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { defaultConfig } from '../index.ts';
import { DOC_SLUGS } from './templates/index.ts';
import { resolveConfig, validateConfig, type Config, type OrganizationConfig } from '../config.ts';
import { derivePolicyVars } from './derive.ts';
import { enabledDocs, generateLegal, renderMarkdown } from './index.ts';
import { detectProcessorKeys } from './providers.ts';
import { parseMarkdown, toHtmlFragment, toPortableText } from './render.ts';

/**
 * A minimal config that enables all three documents.
 *
 * The patch is a **`site`-section** patch, because that is the section almost
 * every assertion here varies (which analytics provider, which forms, which
 * legal documents). `org` patches the other section; both replace their key
 * wholesale, matching how the tests read.
 */
function fixture(
  patch: Partial<Config['site']> = {},
  org: Partial<OrganizationConfig> = {},
): Config {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: {
      name: 'Acme',
      legalName: 'Acme Widgets Inc.',
      email: 'privacy@acme.example',
      address: {
        streetAddress: '1 King St W',
        addressLocality: 'Toronto',
        addressRegion: 'ON',
        postalCode: 'M5H 1A1',
        addressCountry: 'Canada',
      },
      ...org,
    },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      legal: {
        privacyPolicy: { enabled: true, lastUpdated: '2026-08-01' },
        termsOfService: { enabled: true },
        cookieConsent: { enabled: true, type: 'opt-in', categories: ['Essential', 'Analytics'] },
      },
      ...patch,
    },
  } as Config;
}

/** The `site` section of the default fixture — for patches that extend it. */
const baseSite = () => fixture().site;

const privacyOf = (cfg: Config) => renderMarkdown(cfg, 'privacy');

describe('generated legal documents', () => {
  test('resolve every variable — no placeholder reaches the page', () => {
    // The pandoc prototype left unresolved keys as literal `${key}`. TypeScript
    // makes that impossible now; this guards the templates themselves.
    for (const [name, content] of Object.entries(generateLegal(fixture()))) {
      expect(content, name).not.toMatch(/\$\{/);
      expect(content, name).not.toMatch(/undefined|\[object Object\]/);
    }
  });

  test('emit only the documents the config enables', () => {
    expect(Object.keys(generateLegal(fixture()))).toEqual([
      'privacy-policy.md',
      'terms-of-service.md',
      'cookie-notice.md',
    ]);

    const privacyOnly = fixture({ legal: { privacyPolicy: { enabled: true } } });
    expect(enabledDocs(privacyOnly)).toEqual(['privacy']);
    expect(Object.keys(generateLegal(privacyOnly))).toEqual(['privacy-policy.md']);
  });

  test('every document opens with a review notice', () => {
    for (const [name, content] of Object.entries(generateLegal(fixture())))
      expect(content, name).toContain('not legal advice');
  });

  test('describe the config they were given, not a remembered one', () => {
    const before = privacyOf(fixture());
    const after = privacyOf(
      fixture({}, { legalName: 'Different Holdings Ltd.', email: 'p@d.example' }),
    );
    expect(before).toContain('Acme Widgets Inc.');
    expect(after).toContain('Different Holdings Ltd.');
    expect(after).not.toContain('Acme Widgets Inc.');
  });
});

describe('processor derivation', () => {
  test('names the analytics provider the config actually sets', () => {
    const ga = fixture({ analytics: { googleAnalyticsId: 'G-123' } });
    const plausible = fixture({ analytics: { plausibleDomain: 'acme.example' } });

    expect(detectProcessorKeys(ga)).toEqual(['googleAnalytics']);
    expect(detectProcessorKeys(plausible)).toEqual(['plausible']);

    expect(privacyOf(ga)).toContain('Google Analytics');
    expect(privacyOf(ga)).not.toContain('Plausible');
    expect(privacyOf(plausible)).toContain('Plausible Analytics');
    expect(privacyOf(plausible)).not.toContain('Google Analytics');
  });

  test('pick the Matomo entry that matches how Matomo is configured', () => {
    // The two entries differ only in their cookie list, which is the whole point:
    // whether Matomo sets cookies is a configuration choice, and the notice says
    // something materially different in each case.
    const cookieless = fixture({
      analytics: { matomo: { url: 'https://m.acme.example', siteId: '1' } },
    });
    const cookied = fixture({
      analytics: { matomo: { url: 'https://m.acme.example', siteId: '1', cookies: true } },
    });
    expect(detectProcessorKeys(cookieless)).toEqual(['matomoCookieless']);
    expect(detectProcessorKeys(cookied)).toEqual(['matomo']);
  });

  test('assert a cross-border transfer for Matomo Cloud but not a self-hosted instance', () => {
    // Self-hosted Matomo very often runs on the consumer's own infrastructure in
    // their own country. Naming a transfer that is not happening is the same
    // class of defect as omitting one that is.
    const cloud = privacyOf(
      fixture({ analytics: { matomo: { url: 'https://acme.matomo.cloud', siteId: '1' } } }),
    );
    expect(cloud).toContain('the European Union');

    const own = privacyOf(
      fixture({ analytics: { matomo: { url: 'https://stats.acme.example', siteId: '1' } } }),
    );
    expect(own).not.toContain('the European Union');
  });

  test('do not name Cloudflare twice when Turnstile already implies it', () => {
    const site = fixture({
      security: { turnstile: { siteKey: '0x4' } },
      deployment: { platform: 'cloudflare-workers' },
    });
    expect(detectProcessorKeys(site)).toEqual(['turnstile', 'cloudflare']);
  });

  test('carry consumer-declared processors the config cannot infer', () => {
    const site = fixture({
      legal: {
        privacyPolicy: {
          enabled: true,
          processors: [
            { name: 'Stripe', purpose: 'payment processing', country: 'the United States' },
          ],
        },
      },
    });
    const md = privacyOf(site);
    expect(md).toContain('Stripe, for payment processing');
    expect(md).toContain('including the United States');
  });

  test('say so plainly when there are no third parties at all', () => {
    const md = privacyOf(fixture());
    expect(md).toContain(
      'We do not transfer personal information to third party service providers',
    );
    // Claiming a cross-border transfer that does not happen is its own defect.
    expect(md).not.toContain('outside of Canada');
  });
});

describe('collected-information derivation', () => {
  test('reads the PII inventory off the configured forms', () => {
    const site = fixture({
      templates: {
        contact: {
          type: 'form',
          fields: [
            { name: 'email', type: 'email' },
            { name: 'phone', type: 'tel' },
            { name: 'message', type: 'textarea' },
            { name: 'resume', type: 'file' },
          ],
        },
      },
    });
    const md = privacyOf(site);
    expect(md).toContain('your e-mail address');
    expect(md).toContain('your telephone number');
    expect(md).toContain('the content of the messages you send us');
    expect(md).toContain('any files or documents you upload');
  });

  test('do not describe hidden fields as collected from the visitor', () => {
    const vars = derivePolicyVars(
      fixture({
        templates: {
          contact: {
            type: 'form',
            fields: [
              { name: 'email', type: 'email' },
              { name: 'campaign_id', type: 'hidden' },
            ],
          },
        },
      }),
    );
    expect(vars.piiCollected).toContain('your e-mail address');
    expect(vars.piiCollected.join(' ')).not.toMatch(/campaign/i);
  });

  test('fall back to generic categories when no form is configured', () => {
    expect(derivePolicyVars(fixture()).piiCollected).toContain('your full name');
  });
});

describe('cookie notice', () => {
  test('states cookielessness positively rather than leaving a blank section', () => {
    const md = renderMarkdown(
      fixture({ analytics: { plausibleDomain: 'acme.example' } }),
      'cookies',
    );
    expect(md).toContain('do not set cookies');
    expect(md).toContain('Plausible Analytics');
  });

  test('lists real cookie names, in code spans so markdown cannot eat them', () => {
    const md = renderMarkdown(fixture({ analytics: { googleAnalyticsId: 'G-1' } }), 'cookies');
    expect(md).toContain('`_ga`');
    expect(md).toContain('`_gid`');
    expect(md).not.toMatch(/—\s*_ga/);
  });

  test('offers cookie choices only — an e-mail unsubscribe is not one', () => {
    const site = fixture({ analytics: { googleAnalyticsId: 'G-1' } });
    expect(renderMarkdown(site, 'cookies')).not.toContain('unsubscribe');
    // …but the privacy policy, which covers e-mail too, still does.
    expect(renderMarkdown(site, 'privacy')).toContain('unsubscribe');
  });

  test('names Microsoft Clarity and its cookies', () => {
    // The failure this guards is a site running Clarity whose own cookie notice
    // never mentions it — a compliance defect, not an omission of detail.
    const md = renderMarkdown(fixture({ analytics: { clarityId: 'abc123' } }), 'cookies');
    expect(md).toContain('Microsoft Clarity');
    expect(md).toContain('`_clck`');
  });

  test('states positively that a cookieless Matomo sets none', () => {
    const md = renderMarkdown(
      fixture({ analytics: { matomo: { url: 'https://m.acme.example', siteId: '1' } } }),
      'cookies',
    );
    expect(md).toContain('do not set cookies');
    expect(md).toContain('Matomo');
    expect(md).not.toContain('_pk_id');
  });

  test('lists Matomo cookies once the consumer opts into them', () => {
    const md = renderMarkdown(
      fixture({
        analytics: { matomo: { url: 'https://m.acme.example', siteId: '1', cookies: true } },
      }),
      'cookies',
    );
    expect(md).toContain('`_pk_id`');
  });
});

describe('session replay', () => {
  /**
   * Clarity records how a visitor moved through a page, which is a materially
   * different disclosure from "which pages you viewed". Folding it into the
   * generic analytics wording would under-describe what is actually collected.
   */
  test('is disclosed in the privacy policy when Clarity is configured', () => {
    const md = privacyOf(fixture({ analytics: { clarityId: 'abc123' } }));
    expect(md).toMatch(/recording of how you interacted/);
  });

  test('is not claimed for a site that only runs page-view analytics', () => {
    const md = privacyOf(fixture({ analytics: { plausibleDomain: 'acme.example' } }));
    expect(md).not.toMatch(/recording of how you interacted/);
  });
});

describe('terms of service', () => {
  test('spells the province out — "the laws of ON" is not a clause', () => {
    const md = renderMarkdown(fixture(), 'terms');
    expect(md).toContain('the laws of Ontario and the federal laws of Canada applicable therein');
    expect(md).not.toMatch(/laws of ON\b/);
  });

  test('names only the country when there is no province to name', () => {
    const site = fixture(
      {},
      {
        legalName: 'Acme Widgets Inc.',
        email: 'privacy@acme.example',
        address: {
          streetAddress: '1 Rue',
          addressLocality: 'Paris',
          addressCountry: 'France',
        },
      },
    );
    expect(renderMarkdown(site, 'terms')).toContain('governed by the laws of France.');
  });

  test('lets a consumer state the clause outright', () => {
    const site = fixture({
      legal: {
        ...baseSite().legal,
        termsOfService: { enabled: true, governingLaw: 'the Province of British Columbia' },
      },
    });
    expect(renderMarkdown(site, 'terms')).toContain(
      'governed by the laws of the Province of British Columbia.',
    );
  });
});

describe('validation', () => {
  test('rejects a jurisdiction with no templates behind it', () => {
    const result = validateConfig(fixture({ legal: { jurisdiction: 'eu' } } as never));
    expect(result.ok).toBe(false);
  });

  test('rejects an enabled policy with nobody to contact', () => {
    const result = validateConfig({ ...fixture(), organization: { name: 'Acme' } });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.message).join(' ')).toContain('contact for privacy requests');
  });

  test('rejects an enabled policy with no canonical domain', () => {
    const full = fixture();
    const result = validateConfig({ ...full, site: { ...full.site, domains: undefined } });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.message).join(' ')).toContain('site.domains.canonical');
  });

  test('accepts the fixture', () => {
    expect(validateConfig(fixture()).ok).toBe(true);
  });
});

describe('the markdown subset', () => {
  test('holds for every shipped template', () => {
    // If a template grows a table or an ordered list, this fails here rather
    // than emitting a broken fragment into a consumer's site.
    const site = fixture({
      analytics: { googleAnalyticsId: 'G-1' },
      templates: { contact: { type: 'form', fields: [{ name: 'email', type: 'email' }] } },
    });
    for (const doc of ['privacy', 'terms', 'cookies'] as const)
      expect(() => parseMarkdown(renderMarkdown(site, doc)), doc).not.toThrow();
  });

  test('rejects constructs it cannot express', () => {
    expect(() => parseMarkdown('| a | b |')).toThrow(/tables/);
    expect(() => parseMarkdown('1. first')).toThrow(/ordered lists/);
    expect(() => parseMarkdown('#### too deep')).toThrow(/headings deeper/);
    expect(() => parseMarkdown('```js\n```')).toThrow(/code fences/);
    expect(() => parseMarkdown('* star bullet')).toThrow(/bullets other than/);
    expect(() => parseMarkdown('see [here](https://x.example)')).toThrow(/links or images/);
  });

  test('parses what it does support', () => {
    const blocks = parseMarkdown('# T\n\n> note\n\n- one\n- two\n\nA **bold** word and `code`.');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'quote', 'list', 'paragraph']);
    expect(blocks[2]).toMatchObject({
      kind: 'list',
      items: [[{ text: 'one' }], [{ text: 'two' }]],
    });
  });
});

describe('the Bricks shortcode allowlist', () => {
  // The PHP names the files it will read, and the generator names the files it
  // writes. Nothing links them at runtime, so a renamed document would leave the
  // shortcode rendering an empty string on a live page — silently.
  test('matches the filenames the generator emits', () => {
    const php = readFileSync(new URL('../../../../bricks/load.php', import.meta.url), 'utf8');
    const block = /'vitops_legal'[\s\S]*?\$allowed\s*=\s*array\(([\s\S]*?)\);/.exec(php);
    expect(block, 'the [vitops_legal] allowlist should exist in bricks/load.php').toBeTruthy();

    const allowed = Object.fromEntries(
      [...block![1]!.matchAll(/'([a-z]+)'\s*=>\s*'([a-z-]+)'/g)].map((m) => [m[1], m[2]]),
    );
    expect(allowed).toEqual(DOC_SLUGS);
  });
});

describe('output formats', () => {
  test('HTML escapes text and nests lists properly', () => {
    const html = toHtmlFragment(parseMarkdown('## H\n\n- a & b\n\n**x**'));
    expect(html).toBe('<h2>H</h2><ul><li>a &amp; b</li></ul><p><strong>x</strong></p>');
  });

  test('Portable Text matches the shape EmDash seeds', () => {
    const blocks = toPortableText(parseMarkdown('# Title\n\n> warn\n\n## H\n\n- item'), 'privacy');

    // The h1 is the page title field in EmDash, not a content block.
    expect(JSON.stringify(blocks)).not.toContain('Title');

    expect(blocks[0]).toEqual({
      _type: 'vitops.banner',
      _key: 'privacy-1',
      message: 'warn',
      tone: 'warning',
      dismissible: false,
    });
    expect(blocks[1]).toMatchObject({ _type: 'block', style: 'h2', markDefs: [] });
    expect(blocks[2]).toMatchObject({ _type: 'block', style: 'normal', listItem: 'bullet' });
  });

  test('are keyed by filename and stay stable across identical builds', () => {
    const site = fixture();
    expect(Object.keys(generateLegal(site, { output: 'html' }))).toEqual([
      'privacy-policy.html',
      'terms-of-service.html',
      'cookie-notice.html',
    ]);
    // No clock, no randomness — a rebuild of an unchanged config is byte-identical.
    expect(generateLegal(site)).toEqual(generateLegal(site));
    expect(generateLegal(site, { output: 'portable-text' })).toEqual(
      generateLegal(site, { output: 'portable-text' }),
    );
  });
});

/**
 * `designSystem` is an object — `{ themes, defaultTheme, defaultColorScheme }` —
 * rather than the bare theme map it used to be. It had to become one: every key
 * of the old map was a theme name, so there was nowhere to put a system-wide
 * field without it colliding with a theme of that name.
 *
 * Both older spellings still resolve, keyed off what cannot be a theme name in
 * the other reading (`colors` → a bare DesignSystem; `themes` → already
 * canonical; neither → the legacy map).
 */
describe('designSystem normalisation', () => {
  const base = (site: Record<string, unknown> = {}) => {
    const { designSystem: _drop, ...rest } = fixture();
    return { ...rest, site: { ...rest.site, ...site } } as Record<string, unknown>;
  };
  const themesOf = (designSystem: unknown) =>
    Object.keys(resolveConfig({ ...base(), designSystem }).designSystem.themes);

  test('accepts the canonical shape', () => {
    expect(themesOf({ themes: { default: defaultConfig() } })).toEqual(['default']);
  });

  test('accepts a legacy bare theme map', () => {
    expect(themesOf({ default: defaultConfig(), elegant: { extends: 'default' } })).toEqual([
      'default',
      'elegant',
    ]);
  });

  test('accepts a bare DesignSystem written inline', () => {
    expect(themesOf(defaultConfig())).toEqual(['default']);
  });

  test('rejects a themes map with no default and no defaultTheme', () => {
    expect(() => themesOf({ themes: { elegant: defaultConfig() } })).toThrow(
      /themes must include a "default"/,
    );
  });

  test('rejects a defaultTheme that names no entry', () => {
    expect(() => themesOf({ themes: { default: defaultConfig() }, defaultTheme: 'nope' })).toThrow(
      /defaultTheme "nope" is not in designSystem\.themes/,
    );
  });

  /**
   * Normalisation runs BEFORE the A/B merge. With the merge first, an override's
   * key path depended on which shorthand the base config happened to use — so the
   * same patch landed in a different place in two otherwise-equivalent configs.
   */
  test('applies an A/B override against the canonical shape, whatever the base used', () => {
    const withVariant = (designSystem: unknown) =>
      resolveConfig(
        {
          ...base({
            environments: { production: { url: 'https://acme.example', variant: 'b' } },
            abTesting: {
              enabled: true,
              variants: {
                b: {
                  environment: 'production',
                  overrides: { designSystem: { themes: { elegant: { extends: 'default' } } } },
                },
              },
            },
          }),
          designSystem,
        },
        'production',
      ).designSystem.themes;

    // Base written canonically, and base written as a legacy bare map, must land
    // the same override in the same place.
    for (const ds of [{ themes: { default: defaultConfig() } }, { default: defaultConfig() }])
      expect(Object.keys(withVariant(ds)).sort()).toEqual(['default', 'elegant']);
  });

  test('normalises a shorthand inside the override too', () => {
    const themes = resolveConfig(
      {
        ...base({
          environments: { production: { url: 'https://acme.example', variant: 'b' } },
          abTesting: {
            enabled: true,
            variants: {
              b: {
                environment: 'production',
                // Legacy spelling in the patch — must not nest under `themes.themes`.
                overrides: { designSystem: { elegant: { extends: 'default' } } },
              },
            },
          },
        }),
        designSystem: { themes: { default: defaultConfig() } },
      },
      'production',
    ).designSystem.themes;
    expect(Object.keys(themes).sort()).toEqual(['default', 'elegant']);
  });
});
