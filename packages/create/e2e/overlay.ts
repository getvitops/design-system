/**
 * The end-to-end overlay: what `scripts/e2e-audit.mjs` lays over a scaffolded EmDash site (a
 * temp copy, never the template) so the build prerenders every block.
 *
 * Two pages, covering the two ways EmDash composes blocks:
 *   `/blocks`            the `pages` collection's rich-text field, with EVERY plugin Portable
 *                        Text block inline (the slash-menu path), in `BLOCKS` order.
 *   `/landings/showcase` an entry in the template's `landings` collection, whose `blocks` field
 *                        holds `vitops_section` BLOCK TYPES (the page-composition path), each with
 *                        plugin blocks in its `body` — rendered by `<Blocks>` + `blockTypeComponents`
 *                        through the template's own `src/pages/landings/[slug].astro`.
 *
 * Pure: takes the template's seed, returns the merged seed plus the extra files, so it can be
 * asserted without a scaffold. Blocks without a fixture are reported, not guessed at — the
 * drift guard in `fixtures.test.ts` is what fails on them.
 */
import { join } from 'node:path';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { BLOCKS } from '../../emdash/src/blocks.ts';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { SECTION_SLUG, vitopsBlockTypes } from '../../emdash/src/block-types.ts';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { EXEMPT, FIXTURES } from './fixtures.ts';

export const E2E_DIR = import.meta.dirname;
const PLACEHOLDERS = join(E2E_DIR, '..', 'assets', 'placeholder');

/** The collection holding the `blocks`-field page, and its single entry. */
export const LANDINGS = 'landings';
export const LANDING_SLUG = 'showcase';

/** Pages the audit should visit beyond the defaults. */
/**
 * A sample `.vitops/reviews.json` (the cache `vitops reviews` writes), so the `vitops_reviews`
 * block renders real cards in the e2e site rather than the empty state. Fictional authors.
 */
export const REVIEWS_CACHE = {
  version: 1,
  locations: {
    ottawa: {
      locationId: 'e2e-location',
      accountId: 'e2e-account',
      fetchedAt: '2026-11-01T00:00:00.000Z',
      averageRating: 4.7,
      totalReviewCount: 3,
      reviews: [
        ['r1', 5, 'Alex Example', 'Quick, tidy and on budget. We would hire them again.'],
        [
          'r2',
          5,
          'Sam Sample',
          'Clear quote, no surprises, and the work was finished a day early.',
        ],
        [
          'r3',
          4,
          'Jordan Placeholder',
          'Good communication throughout. Cleanup could have been faster.',
        ],
      ].map(([id, rating, author, text], i) => ({
        id,
        location: 'ottawa',
        rating,
        author,
        text,
        publishedAt: `2026-10-0${i + 1}T12:00:00.000Z`,
        updatedAt: `2026-10-0${i + 1}T12:00:00.000Z`,
        url: `https://example.com/reviews/${id}`,
      })),
    },
  },
};

export const E2E_PATHS = ['/blocks', `/${LANDINGS}/${LANDING_SLUG}`];

type Json = Record<string, unknown>;

const span = (key: string, text: string) => ({ _type: 'span', _key: `${key}-s`, text, marks: [] });
const textBlock = (key: string, style: string, text: string) => ({
  _type: 'block',
  _key: key,
  style,
  markDefs: [],
  children: [span(key, text)],
});
const pluginBlock = (type: string, key: string) => ({ _type: type, _key: key, ...FIXTURES[type] });

/** Block types that have a fixture, in `BLOCKS` order; the rest are returned as `missing`. */
export function coverage(): { covered: string[]; missing: string[] } {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const { type } of BLOCKS) {
    if (FIXTURES[type]) covered.push(type);
    else if (!(type in EXEMPT)) missing.push(type);
  }
  return { covered, missing };
}

/** The `/blocks` page body: an intro, then a heading and the block, for every covered type. */
export function blocksPageContent(): unknown[] {
  const out: unknown[] = [
    textBlock('intro', 'normal', 'Every Vitops Portable Text block, once, with valid values.'),
  ];
  for (const type of coverage().covered) {
    const slug = type.replace('vitops_', '');
    out.push(textBlock(`h-${slug}`, 'h2', slug), pluginBlock(type, `b-${slug}`));
  }
  return out;
}

/** The `vitops_section` entries of the landing page, each wrapping plugin blocks in its body. */
export function sectionBlocks(): Json[] {
  const body = (key: string, types: string[], lead: string) => [
    textBlock(`${key}-lead`, 'normal', lead),
    ...types.filter((t) => FIXTURES[t]).map((t) => pluginBlock(t, `${key}-${t.slice(7)}`)),
  ];
  const section = (key: string, fields: Json) => ({
    _type: SECTION_SLUG,
    _version: 1,
    _key: key,
    level: '2',
    ...fields,
  });
  return [
    section('s1', {
      kicker: 'Services',
      heading: 'What we do',
      sub: 'A section holds any plugin block in its body.',
      layout: 'stack',
      width: 'measure',
      body: body('s1', ['vitops_cards', 'vitops_actionLink'], 'Three services, one crew.'),
    }),
    section('s2', {
      kicker: 'Process',
      heading: 'How it works',
      layout: 'split',
      width: 'breakout',
      body: body('s2', ['vitops_steps', 'vitops_stats'], 'From first visit to finished job.'),
    }),
    section('s3', {
      heading: 'Questions',
      layout: 'center',
      width: 'spotlight',
      tone: 'info',
      body: body('s3', ['vitops_accordion', 'vitops_callout'], 'The short answers.'),
    }),
  ];
}

export interface Overlay {
  /** The template's seed with the e2e collections, block types and entries merged in. */
  seed: Json;
  /** Files to write into the scaffold: path relative to its root -> text content. */
  files: Record<string, string>;
  /** Files to copy into the scaffold: `[absolute source, path relative to its root]`. */
  copies: [string, string][];
}

export function buildOverlay(base: Json): Overlay {
  const seed = structuredClone(base) as Json;
  const collections = (seed.collections as Json[]) ?? [];
  const content = (seed.content as Record<string, Json[]>) ?? {};

  // The template ships the `vitops_section` block type, the `landings` collection and its route
  // (`src/pages/landings/[slug].astro`); the overlay adds only what is test-specific. Each is added
  // only when missing, so the overlay still works over a seed that predates them.
  const have = new Set(((seed.blockTypes as Json[]) ?? []).map((t) => t.slug));
  seed.blockTypes = [
    ...((seed.blockTypes as Json[]) ?? []),
    ...vitopsBlockTypes().filter((t: { slug: string }) => !have.has(t.slug)),
  ];
  if (!collections.some((c) => c.slug === LANDINGS)) {
    seed.collections = [
      ...collections,
      {
        slug: LANDINGS,
        label: 'Landings',
        labelSingular: 'Landing',
        supports: ['drafts', 'revisions'],
        fields: [
          { slug: 'title', label: 'Title', type: 'string', required: true },
          {
            slug: 'layout',
            label: 'Layout',
            type: 'blocks',
            validation: { allowedTypes: [SECTION_SLUG], maxItems: 20 },
          },
        ],
      },
    ];
  }
  seed.content = {
    ...content,
    pages: [
      ...(content.pages ?? []),
      {
        id: 'blocks',
        slug: 'blocks',
        status: 'published',
        data: { title: 'Blocks', content: blocksPageContent() },
      },
    ],
    [LANDINGS]: [
      {
        id: LANDING_SLUG,
        slug: LANDING_SLUG,
        status: 'published',
        data: { title: 'Showcase', layout: sectionBlocks() },
      },
    ],
  };

  return {
    seed,
    files: {
      '.vitops/reviews.json': `${JSON.stringify(REVIEWS_CACHE, null, 2)}\n`,
    },
    copies: ['400x400', '400x600', '600x400'].map((size) => [
      join(PLACEHOLDERS, `wireframe-${size}.png`),
      `public/e2e/wireframe-${size}.png`,
    ]),
  };
}
