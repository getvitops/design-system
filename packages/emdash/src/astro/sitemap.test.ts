import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { rewriteHomeEntry } from './sitemap-rewrite.ts';

const xml = (...locs: string[]) =>
  `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;

describe('rewriteHomeEntry', () => {
  it('lists the home entry as the site root', () => {
    const out = rewriteHomeEntry(xml('https://acme.example/home', 'https://acme.example/about'));
    expect(out).toContain('<loc>https://acme.example/</loc>');
    expect(out).toContain('<loc>https://acme.example/about</loc>');
    expect(out).not.toContain('/home');
  });

  it('handles a locale prefix and a trailing slash, and rewrites hreflang alternates', () => {
    const out = rewriteHomeEntry(
      '<loc>https://acme.example/fr/home/</loc><xhtml:link rel="alternate" hreflang="fr" href="https://acme.example/fr/home" />',
    );
    expect(out).toContain('<loc>https://acme.example/fr/</loc>');
    expect(out).toContain('href="https://acme.example/fr/"');
  });

  it('leaves look-alikes alone', () => {
    const urls = [
      'https://acme.example/homepage',
      'https://acme.example/about/home',
      'https://acme.example/blog/home',
      'https://acme.example/',
    ];
    expect(rewriteHomeEntry(xml(...urls))).toBe(xml(...urls));
  });

  it('honours a different home slug', () => {
    expect(rewriteHomeEntry(xml('https://acme.example/start'), 'start')).toContain(
      '<loc>https://acme.example/</loc>',
    );
  });
});

/**
 * The route wraps an `internal/` export of EmDash. It is the only seam we have (EmDash has no
 * per-entry URL override), so pin its existence: an EmDash release that moves it should fail
 * here, in CI, instead of in a client's sitemap.
 */
describe('EmDash seam', () => {
  it('still ships the per-collection sitemap route under internal/routes/*', () => {
    // `emdash` does not export its package.json, so find it from the main entry.
    let dir = dirname(createRequire(import.meta.url).resolve('emdash'));
    while (!existsSync(join(dir, 'package.json'))) dir = dirname(dir);
    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.exports['./internal/routes/*']).toBeDefined();
    expect(
      existsSync(join(dirname(pkgPath), 'dist/astro/routes/sitemap-_collection_.xml.mjs')),
    ).toBe(true);
  });
});
