/**
 * Sitemap parsing — enough of it, and no more.
 *
 * Hand-rolled rather than pulled from an XML library. A sitemap is a closed,
 * trivially-shaped document (`<urlset>` of `<url>`, or `<sitemapindex>` of
 * `<sitemap>`, each carrying `<loc>` and optionally `<lastmod>`), and this package
 * installs into every consumer project — a parser dependency for two element names
 * is not a trade worth making. The same reasoning the legal renderer applies to its
 * markdown subset: exactly as capable as the documents it has to read.
 */
import type { SitemapEntry } from './types.ts';

/** What a sitemap document turned out to be. */
export interface ParsedSitemap {
  /** `<url>` entries, when this was a `<urlset>`. */
  entries: SitemapEntry[];
  /** Child sitemap URLs, when this was a `<sitemapindex>`. */
  sitemaps: string[];
}

/**
 * The five predefined XML entities, plus numeric character references.
 *
 * Not cosmetic: a sitemap URL carrying a query string is written `?a=1&amp;b=2`,
 * and submitting the un-decoded form means submitting a URL the site does not
 * serve — which IndexNow accepts and then silently fails to crawl.
 */
function decodeXml(s: string): string {
  return (
    s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // `&amp;` last: decoding it first would let `&amp;lt;` collapse to `<`.
      .replace(/&amp;/g, '&')
  );
}

const tag = (block: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? decodeXml(m[1]!.trim()) : undefined;
};

function blocks(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]!);
  return out;
}

/**
 * Parse a sitemap or sitemap index.
 *
 * Which one it is comes from the root element, not from the filename — an
 * `sitemap-index.xml` that is actually a flat `<urlset>` is common enough
 * (@astrojs/sitemap emits an index only past `entryLimit`) that keying on the name
 * would misread the single-file case as "no URLs".
 */
export function parseSitemap(xml: string): ParsedSitemap {
  if (/<sitemapindex[\s>]/i.test(xml))
    return {
      entries: [],
      sitemaps: blocks(xml, 'sitemap')
        .map((b) => tag(b, 'loc'))
        .filter((l): l is string => !!l),
    };

  const entries: SitemapEntry[] = [];
  for (const b of blocks(xml, 'url')) {
    const loc = tag(b, 'loc');
    if (!loc) continue; // `<loc>` is required; an entry without one is unusable
    const lastmod = tag(b, 'lastmod');
    entries.push(lastmod ? { loc, lastmod } : { loc });
  }
  return { entries, sitemaps: [] };
}

/** Reads a sitemap from a URL or a local path. */
export type SitemapReader = (source: string) => Promise<string>;

/**
 * Resolve a sitemap to its full entry list, following an index one level down.
 *
 * One level is the whole spec — the sitemaps protocol forbids an index pointing at
 * another index — so recursing further would only chase a malformed document.
 * Child fetches run sequentially: a large site's index can list dozens of files,
 * and hammering the consumer's own origin to save a second is a poor trade.
 */
export async function collectEntries(
  source: string,
  read: SitemapReader,
): Promise<{ entries: SitemapEntry[]; sources: string[] }> {
  const root = parseSitemap(await read(source));
  if (root.sitemaps.length === 0) return { entries: root.entries, sources: [source] };

  const entries: SitemapEntry[] = [];
  const sources: string[] = [];
  for (const child of root.sitemaps) {
    const parsed = parseSitemap(await read(child));
    entries.push(...parsed.entries);
    sources.push(child);
  }
  return { entries, sources };
}
