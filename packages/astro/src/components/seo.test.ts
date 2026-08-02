import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Source-text invariants for `<Seo />`, in the style of `head.test.ts`.
 *
 * The resolution logic is unit-tested in `../seo.test.ts`; these guard the
 * structural decisions that a unit test can't see, most of them regressions
 * against specific bugs in the `SEO.astro` this replaces (deleted in c949cae).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const seo = readFileSync(join(HERE, './Seo.astro'), 'utf8');

describe('<Seo />', () => {
  it('emits the tags it owns', () => {
    expect(seo).toContain('<title');
    expect(seo).toContain('name="description"');
    expect(seo).toContain('rel="canonical"');
    expect(seo).toContain('name="robots"');
    expect(seo).toContain('rel="alternate"');
  });

  it('never emits <meta name="title">', () => {
    // The old component emitted this non-standard tag *instead of* a real
    // <title>. No crawler reads it. Its presence would mean the title bug is back.
    expect(seo).not.toMatch(/name=["']title["']/);
  });

  it('renders og: tags with `property`, not `name`', () => {
    // Open Graph is RDFa: og:* must be `property`. Emitting it as `name` is a
    // silent failure — the markup looks right and no scraper reads it.
    expect(seo).toMatch(/<meta\s+property=/);
    expect(seo).toContain('t.property');
  });

  it('renders every tag from the resolver, hard-coding none', () => {
    // If a tag is spelled here rather than coming out of resolveSeo(), it is
    // untested by seo.test.ts — which is the whole point of the split.
    expect(seo).toContain('resolveSeo');
    expect(seo).not.toMatch(/content=["']og:/);
  });

  it('emits no JSON-LD and imports nothing from ../schemas', () => {
    // <Seo /> takes page data; the schema components take entity data. Merging
    // them is how the old component grew to 276 lines and a site-config import.
    expect(seo).not.toContain('application/ld+json');
    // Imports specifically — the header comment names ../schemas/ to explain the
    // split, so a bare substring check would trip on the documentation.
    expect(seo).not.toMatch(/^\s*import\s.*schemas/m);
  });

  it('takes site defaults from the virtual module, not a consumer global', () => {
    // `#site-config` — a bare specifier resolved nowhere — is what made the old
    // site-model layer unbuildable. Config arrives as an argument now.
    expect(seo).toContain("from 'virtual:getvitops/head'");
    expect(seo).not.toContain('#site-config');
  });

  it('does not prepend `base` to the canonical path', () => {
    // Astro.url.pathname already includes base; prepending it doubles the prefix.
    expect(seo).toContain('Astro.url.pathname');
    expect(seo).not.toMatch(/base\s*\+|\+\s*Astro\.url\.pathname/);
  });
});
