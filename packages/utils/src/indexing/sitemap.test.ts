import { describe, expect, it } from 'vitest';
import { collectEntries, parseSitemap } from './sitemap.ts';

const urlset = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

describe('parseSitemap', () => {
  it('reads loc and lastmod from a urlset', () => {
    const xml = urlset(`
      <url><loc>https://acme.ca/</loc><lastmod>2026-08-01T10:00:00Z</lastmod></url>
      <url><loc>https://acme.ca/about</loc></url>`);
    expect(parseSitemap(xml)).toEqual({
      entries: [
        { loc: 'https://acme.ca/', lastmod: '2026-08-01T10:00:00Z' },
        { loc: 'https://acme.ca/about' },
      ],
      sitemaps: [],
    });
  });

  it('reads a sitemap index as child sitemaps, not URLs', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://acme.ca/sitemap-0.xml</loc></sitemap>
  <sitemap><loc>https://acme.ca/sitemap-1.xml</loc></sitemap>
</sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({
      entries: [],
      sitemaps: ['https://acme.ca/sitemap-0.xml', 'https://acme.ca/sitemap-1.xml'],
    });
  });

  it('keys on the root element, not the filename', () => {
    // @astrojs/sitemap emits an index only past `entryLimit`, so a file *named*
    // sitemap-index.xml is often a flat urlset. Reading the name would report zero
    // URLs for every small site.
    const flat = parseSitemap(urlset('<url><loc>https://acme.ca/</loc></url>'));
    expect(flat.entries).toHaveLength(1);
    expect(flat.sitemaps).toEqual([]);
  });

  it('decodes XML entities in URLs', () => {
    // A query-string URL is written with `&amp;`; submitting the raw form submits
    // a URL the site does not serve.
    const xml = urlset('<url><loc>https://acme.ca/s?a=1&amp;b=2</loc></url>');
    expect(parseSitemap(xml).entries[0]!.loc).toBe('https://acme.ca/s?a=1&b=2');
  });

  it('decodes numeric character references', () => {
    const xml = urlset('<url><loc>https://acme.ca/caf&#233;</loc></url>');
    expect(parseSitemap(xml).entries[0]!.loc).toBe('https://acme.ca/café');
  });

  it('does not double-decode', () => {
    // `&amp;lt;` must survive as the literal `&lt;`, not collapse to `<`.
    const xml = urlset('<url><loc>https://acme.ca/a?x=&amp;lt;</loc></url>');
    expect(parseSitemap(xml).entries[0]!.loc).toBe('https://acme.ca/a?x=&lt;');
  });

  it('tolerates namespace prefixes and attributes on elements', () => {
    const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url ><loc >https://acme.ca/</loc></url></urlset>`;
    expect(parseSitemap(xml).entries).toEqual([{ loc: 'https://acme.ca/' }]);
  });

  it('drops an entry with no loc rather than emitting an undefined URL', () => {
    const xml = urlset(
      '<url><lastmod>2026-01-01</lastmod></url><url><loc>https://a.ca/</loc></url>',
    );
    expect(parseSitemap(xml).entries).toEqual([{ loc: 'https://a.ca/' }]);
  });

  it('returns nothing for an empty or junk document', () => {
    expect(parseSitemap('').entries).toEqual([]);
    expect(parseSitemap('not xml at all').entries).toEqual([]);
  });
});

describe('collectEntries', () => {
  it('follows a sitemap index one level down', async () => {
    const docs: Record<string, string> = {
      'https://acme.ca/sitemap-index.xml': `<sitemapindex>
        <sitemap><loc>https://acme.ca/sitemap-0.xml</loc></sitemap>
        <sitemap><loc>https://acme.ca/sitemap-1.xml</loc></sitemap>
      </sitemapindex>`,
      'https://acme.ca/sitemap-0.xml': urlset('<url><loc>https://acme.ca/a</loc></url>'),
      'https://acme.ca/sitemap-1.xml': urlset(
        '<url><loc>https://acme.ca/b</loc><lastmod>2026-08-02</lastmod></url>',
      ),
    };
    const { entries, sources } = await collectEntries(
      'https://acme.ca/sitemap-index.xml',
      async (s) => docs[s]!,
    );
    expect(entries).toEqual([
      { loc: 'https://acme.ca/a' },
      { loc: 'https://acme.ca/b', lastmod: '2026-08-02' },
    ]);
    expect(sources).toEqual(['https://acme.ca/sitemap-0.xml', 'https://acme.ca/sitemap-1.xml']);
  });

  it('returns a flat sitemap directly', async () => {
    const { entries, sources } = await collectEntries('https://acme.ca/sitemap.xml', async () =>
      urlset('<url><loc>https://acme.ca/</loc></url>'),
    );
    expect(entries).toHaveLength(1);
    expect(sources).toEqual(['https://acme.ca/sitemap.xml']);
  });
});
