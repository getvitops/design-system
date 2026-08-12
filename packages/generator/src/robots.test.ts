/**
 * `renderRobotsTxt` reads the exact fact `plan()` (`@getvitops/utils/indexing`)
 * already gates search-engine notification on — a `noindex` environment must
 * come out the same way in both places, or one half of the toolchain tells a
 * crawler "come on in" while the other refuses to tell search engines a deploy
 * happened.
 */
import { describe, expect, test } from 'vitest';
import { defaultConfig } from './index.ts';
import type { Config } from './config.ts';
import { renderRobotsTxt } from './robots.ts';

function fixture(patch: Partial<Config['site']> = {}): Config {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      ...patch,
    },
  } as Config;
}

describe('renderRobotsTxt', () => {
  test('allows everything and links the default sitemap when nothing blocks it', () => {
    const txt = renderRobotsTxt(fixture());
    expect(txt).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://acme.example/sitemap-index.xml\n',
    );
  });

  test('disallows everything for an environment whose robots directive contains noindex', () => {
    const txt = renderRobotsTxt(
      fixture({
        environments: {
          production: { url: 'https://acme.example' },
          staging: { url: 'https://staging.acme.example', robots: 'noindex,nofollow' },
        },
      }),
      { env: 'staging' },
    );
    expect(txt).toBe('User-agent: *\nDisallow: /\n');
  });

  test('never emits a Sitemap line for a blocked environment', () => {
    const txt = renderRobotsTxt(
      fixture({ environments: { production: { url: 'https://acme.example', robots: 'noindex' } } }),
    );
    expect(txt).not.toContain('Sitemap:');
  });

  test('falls back to site.seo.robots when the environment states none', () => {
    const txt = renderRobotsTxt(fixture({ seo: { robots: 'noindex,nofollow' } }));
    expect(txt).toBe('User-agent: *\nDisallow: /\n');
  });

  test('an environment robots directive overrides the site-wide default', () => {
    const txt = renderRobotsTxt(
      fixture({
        seo: { robots: 'noindex,nofollow' },
        environments: { production: { url: 'https://acme.example', robots: 'index,follow' } },
      }),
    );
    expect(txt).toContain('Allow: /');
  });

  test('respects an explicit sitemapUrl over the derived default', () => {
    const txt = renderRobotsTxt(
      fixture({ seo: { indexing: { sitemapUrl: 'https://acme.example/custom-sitemap.xml' } } }),
    );
    expect(txt).toContain('Sitemap: https://acme.example/custom-sitemap.xml');
  });

  test('uses the named environment, not just production', () => {
    const txt = renderRobotsTxt(
      fixture({
        environments: {
          production: { url: 'https://acme.example' },
          dev: { url: 'https://dev.acme.example', robots: 'noindex,nofollow' },
        },
      }),
      { env: 'dev' },
    );
    expect(txt).toContain('Disallow: /');
  });

  test('defaults to the production environment when none is given', () => {
    const txt = renderRobotsTxt(
      fixture({
        environments: {
          production: { url: 'https://acme.example', robots: 'noindex' },
          dev: { url: 'https://dev.acme.example' },
        },
      }),
    );
    expect(txt).toContain('Disallow: /');
  });

  test('an unresolvable environment with no canonical emits no Sitemap line, not a broken one', () => {
    // `env` names an environment absent from `site.environments`, and `domains`
    // is absent too — there is genuinely no origin to build a sitemap URL from.
    const txt = renderRobotsTxt(fixture({ domains: undefined }), { env: 'nonexistent' });
    expect(txt).toBe('User-agent: *\nAllow: /\n');
  });
});
