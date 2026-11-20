import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
  PAGES_SITEMAP_FILE,
  PAGES_SITEMAP_MARKER,
  pagesRoutes,
  renderPagesSitemap,
  writePagesSitemap,
} from './pages-sitemap.ts';

describe('pagesRoutes', () => {
  it('keeps static pages and drops dynamic routes, endpoints, status pages and _private files', () => {
    expect(
      pagesRoutes([
        'src/pages/index.astro',
        'src/pages/pricing.astro',
        'src/pages/funding/index.astro',
        'src/pages/[...slug].astro',
        'src/pages/landings/[slug].astro',
        'src/pages/api/track.ts',
        'src/pages/404.astro',
        'src/pages/_draft.astro',
        'src/pages/_x/inner.astro',
      ]),
    ).toEqual(['/', '/funding', '/pricing']);
  });

  it('drops a route named in exclude, whatever its trailing slash', () => {
    expect(pagesRoutes(['src/pages/index.astro', 'src/pages/pricing.astro'], ['/'])).toEqual([
      '/pricing',
    ]);
    expect(pagesRoutes(['src/pages/pricing.astro'], ['/pricing/'])).toEqual([]);
  });

  it('finds nothing in a scaffolded EmDash template once the CMS-rendering index is excluded', () => {
    expect(
      pagesRoutes(
        [
          'src/pages/404.astro',
          'src/pages/api/track.ts',
          'src/pages/index.astro',
          'src/pages/landings/[slug].astro',
          'src/pages/[...slug].astro',
        ],
        ['/'],
      ),
    ).toEqual([]);
  });
});

describe('renderPagesSitemap', () => {
  it('omits a missing lastmod rather than inventing one, and escapes the URL', () => {
    const xml = renderPagesSitemap([
      { url: 'https://a.test/x?a=1&b=2', lastmod: '2026-01-02T00:00:00Z' },
      { url: 'https://a.test/y' },
    ]);
    expect(xml).toContain(PAGES_SITEMAP_MARKER);
    expect(xml).toContain('<loc>https://a.test/x?a=1&amp;b=2</loc>');
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
  });
});

describe('writePagesSitemap', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const project = (pages: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'pages-sitemap-'));
    dirs.push(root);
    mkdirSync(join(root, 'public'));
    for (const page of pages) {
      const file = join(root, 'src/pages', page);
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, '---\n---\n');
    }
    const logs: string[] = [];
    const run = () =>
      writePagesSitemap({
        root,
        publicDir: join(root, 'public'),
        site: 'https://acme.ca',
        exclude: ['/'],
        log: (m) => logs.push(m),
        warn: () => undefined,
      });
    return { root, target: join(root, 'public', PAGES_SITEMAP_FILE), run, logs };
  };

  it('writes nothing, and says why, when every route is CMS-backed', async () => {
    const p = project(['index.astro', '[...slug].astro', '404.astro']);
    expect(await p.run()).toBe('none');
    expect(existsSync(p.target)).toBe(false);
    expect(p.logs.join('\n')).toMatch(/covers the site/);
  });

  it('writes one for a route outside the CMS', async () => {
    const p = project(['index.astro', 'pricing.astro']);
    expect(await p.run()).toBe('written');
    const xml = readFileSync(p.target, 'utf8');
    expect(xml).toContain('<loc>https://acme.ca/pricing</loc>');
    expect(xml).not.toContain('<loc>https://acme.ca/</loc>');
  });

  it('removes a stale file it wrote once the last route is gone', async () => {
    const p = project(['index.astro']);
    writeFileSync(p.target, renderPagesSitemap([{ url: 'https://acme.ca/old' }]));
    expect(await p.run()).toBe('none');
    expect(existsSync(p.target)).toBe(false);
  });

  it('never touches a file it did not write', async () => {
    const p = project(['pricing.astro']);
    writeFileSync(p.target, '<urlset><!-- hand written --></urlset>');
    expect(await p.run()).toBe('kept');
    expect(readFileSync(p.target, 'utf8')).toContain('hand written');

    const q = project(['index.astro']);
    writeFileSync(q.target, '<urlset><!-- hand written --></urlset>');
    await q.run();
    expect(existsSync(q.target)).toBe(true);
  });
});
