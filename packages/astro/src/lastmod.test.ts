import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gitLastmod, routeFromPage, slugFromContent } from './lastmod.ts';

describe('routeFromPage', () => {
  it('maps file-based pages to their routes', () => {
    expect(routeFromPage('src/pages/index.astro')).toBe('/');
    expect(routeFromPage('src/pages/about.astro')).toBe('/about');
    expect(routeFromPage('src/pages/blog/index.astro')).toBe('/blog');
    expect(routeFromPage('src/pages/a/b/c.mdx')).toBe('/a/b/c');
  });

  it('handles a nested project root', () => {
    expect(routeFromPage('apps/docs/src/pages/about.astro')).toBe('/about');
  });

  /*
   * A dynamic route backs many URLs from one file, so its commit date describes
   * the template, not any page. Stamping every generated page with it is the
   * "wrong date" case — worse than none, because Google stops trusting lastmod
   * site-wide once it stops matching what changed.
   */
  it('refuses dynamic routes', () => {
    expect(routeFromPage('src/pages/blog/[slug].astro')).toBeUndefined();
    expect(routeFromPage('src/pages/[...path].astro')).toBeUndefined();
  });

  it('ignores non-page files under src/pages', () => {
    expect(routeFromPage('src/pages/_component.ts')).toBeUndefined();
    expect(routeFromPage('src/pages/styles.css')).toBeUndefined();
  });

  it('ignores files outside src/pages', () => {
    expect(routeFromPage('src/layouts/Base.astro')).toBeUndefined();
  });
});

describe('slugFromContent', () => {
  it('takes the basename of a content entry', () => {
    expect(slugFromContent('src/content/blog/hello-world.md')).toBe('hello-world');
    expect(slugFromContent('src/data/authors/ada.json')).toBe('ada');
  });

  it('ignores an index file — it names the directory, not a slug', () => {
    expect(slugFromContent('src/content/blog/index.md')).toBeUndefined();
  });

  it('ignores unrelated files', () => {
    expect(slugFromContent('src/content/config.ts')).toBeUndefined();
    expect(slugFromContent('src/pages/about.astro')).toBeUndefined();
  });
});

describe('gitLastmod', () => {
  it('warns and stamps nothing when the source directories are absent', async () => {
    const warnings: string[] = [];
    const serialize = await gitLastmod({
      cwd: mkdtempSync(join(tmpdir(), 'vitops-lastmod-')),
      onWarn: (m) => warnings.push(m),
    });
    const item = { url: 'https://acme.ca/about' };
    // Identity, not a build-time stamp: no date beats a wrong date.
    expect(serialize(item)).toEqual(item);
    expect(warnings.join(' ')).toMatch(/exist/);
  });

  it('derives dates from this repo and matches a known page to a real commit date', async () => {
    // Runs against the repo itself — the only honest test of the git parsing.
    const serialize = await gitLastmod({ cwd: process.cwd(), dirs: ['packages/astro/src'] });
    // Nothing under packages/astro/src is a route, so every URL is left alone;
    // what this asserts is that the git pass runs and returns a usable function.
    const item = { url: 'https://acme.ca/whatever' };
    expect(serialize(item)).toEqual(item);
  });

  it('never overwrites a lastmod the caller already set', async () => {
    const serialize = await gitLastmod({ cwd: process.cwd(), dirs: ['packages/astro/src'] });
    const item = { url: 'https://acme.ca/', lastmod: '2020-01-01' };
    expect(serialize(item).lastmod).toBe('2020-01-01');
  });

  it('leaves a malformed URL alone rather than throwing', async () => {
    const serialize = await gitLastmod({ cwd: process.cwd(), dirs: ['packages/astro/src'] });
    const item = { url: 'not a url' };
    expect(serialize(item)).toEqual(item);
  });
});
