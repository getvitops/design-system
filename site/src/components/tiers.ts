/**
 * Shared bits for the four per-tier pages under `src/pages/components/`.
 *
 * The data is the generator's `TIERS` manifest, consumed through the package the way
 * a consumer would — the same rule `SchemaTree.astro` follows. Nothing here restates
 * the manifest; it only decides how one tier's slice is presented.
 *
 * Membership comes from `tierPatterns()` rather than a local filter, so the site and
 * the agent-facing `concepts/components.md` cannot disagree about which patterns a
 * tier provides.
 */
import { renderInlineMarkdown, tierPatterns, type Tier } from '@getvitops/generator';

/** One row of a tier table. Lives here, not in `TierEntries.astro`: importing a type
 *  out of an `.astro` frontmatter block works only some of the time. */
export interface TierRow {
  /** Pattern name — the anchor id, and the row's first column. */
  id: string;
  /** Heading cell HTML. */
  headingHtml: string;
  /**
   * Column term → cell HTML. Every row must use the SAME terms in the SAME order:
   * the table header is built from the first entry's terms, so a row that omits one
   * shifts its cells under the wrong headings.
   */
  cells: Record<string, string>;
}

/** Where each tier is projected, and what to call it in prose. */
export const TIER_PAGES: Record<Tier, { path: string; label: string; short: string }> = {
  css: { path: 'components/css', label: 'CSS framework classes', short: 'CSS' },
  wc: { path: 'components/elements', label: 'Web components', short: 'Web component' },
  astro: { path: 'components/astro', label: 'Astro components', short: 'Astro' },
  bricks: { path: 'components/bricks', label: 'Bricks elements', short: 'Bricks' },
};

/**
 * The ARCHITECTURAL tier each surface belongs to. There are three, not four.
 *
 * `Tier` is a projection axis with four keys because there are four pages to
 * render; that is not the same thing as four levels. **Astro and Bricks are both
 * tier 3** — platform wrappers that generate HTML using the classes and elements of
 * tiers 1 and 2. They are siblings chosen by platform, never ranked against each
 * other, and no project uses both.
 *
 * This exists because the number used to be the array index, which read Astro as
 * tier 3 and Bricks as tier 4 — implying Bricks outranked Astro and that there was a
 * fourth level to climb to.
 */
export const TIER_LEVEL: Record<Tier, number> = { css: 1, wc: 2, astro: 3, bricks: 3 };

export const TIER_ORDER: readonly Tier[] = ['css', 'wc', 'astro', 'bricks'];

/** Site-absolute href, base-aware and free of double slashes. */
export const href = (path: string, base: string) => `${base}${path}`.replace(/\/{2,}/g, '/');

/**
 * The manifest's prose is markdown — `use` and `adds` name tags and classes in
 * backticks, and `use` uses `**strong**`. `renderInlineMarkdown()` escapes HTML
 * first and renders that closed subset, so it is also what makes the strings safe to
 * pass as HTML. Never interpolate a manifest string into markup any other way.
 */
export const md = (s: string) => renderInlineMarkdown(s);

/** Code-formatted cell, escaped. */
export const code = (s: string) => md(`\`${s}\``);

/** An em dash, for a cell with nothing in it — an empty cell reads as an oversight. */
export const NONE = '<span aria-hidden="true">—</span><span class="sr-only">none</span>';

/**
 * "Also provided by" links for a pattern, excluding the page you're on.
 *
 * Page-level links with no fragment: in `<wc-entries>`' table mode the row heading is
 * hidden, so a fragment would resolve to a node with no layout box and leave the
 * reader at the top of the page having apparently done nothing.
 */
export function alsoIn(pattern: string, self: Tier, base: string): string {
  const others = TIER_ORDER.filter(
    (t) => t !== self && tierPatterns(t).some((p) => p.name === pattern),
  );
  if (!others.length) return `<span class="font-footnote">this tier only</span>`;
  return others
    .map((t) => `<a class="link" href="${href(TIER_PAGES[t].path, base)}">${TIER_PAGES[t].short}</a>`)
    .join(', ');
}
