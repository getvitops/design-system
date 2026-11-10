/**
 * Block TYPES (EmDash's schema-level `blocks` field) the plugin ships, as opposed to the
 * Portable Text blocks in `blocks.ts`.
 *
 * **Why `vitops_section` is not in `BLOCKS`.** A plugin Portable Text block is declared
 * with Block Kit fields — scalars, selects, repeaters of scalars — and Block Kit has no
 * rich-text element, so such a block cannot hold other blocks. A section's whole point is a
 * body of other blocks, and the one EmDash feature with a `portableText` field type is the
 * database-backed **block type** a `blocks` field is built from (see EmDash's blocks guide).
 * Those are created through the seed file or the schema API — a plugin cannot register one —
 * so this module exports the definition for the site to put in `seed/seed.json`'s
 * `blockTypes`, and `blockTypeComponents` (in `@getvitops/emdash/astro`) renders it.
 *
 * Inside the section's `body`, every `vitops_*` Portable Text block resolves normally: the
 * body is rendered by EmDash's `<PortableText>`, which merges this plugin's component map.
 *
 * Block types cannot be renamed or hard-deleted once shipped, so the slug follows the
 * framework's pattern name (`section`) with this package's prefix, and the field slugs are
 * the ones the renderer reads. Add fields in a compatible version; never repurpose one.
 */
import type { ApplySeedBlockTypeInput, BlockFieldDefinition } from 'emdash';

/** Block-type slugs may not contain a dot, so `vitops_section` is stored as `vitops_section`. */
export const SECTION_SLUG = 'vitops_section';

const select = (
  slug: string,
  label: string,
  options: string[],
  defaultValue: string,
): BlockFieldDefinition => ({
  slug,
  label,
  type: 'select',
  defaultValue,
  validation: { options },
});

/**
 * The `theme` select's values: `none`, a role, or `<role>:solid`. Block-type selects are
 * static, so this lists the roles every site defines; any other site role still works through
 * the `tone` field. `<role>:solid` is the filled backdrop with the contrast-computed text.
 */
export const THEME_ROLES = [
  'neutral',
  'surface',
  'brand-primary',
  'brand-secondary',
  'info',
  'success',
  'warning',
  'danger',
];
export const THEMES = ['none', ...THEME_ROLES, ...THEME_ROLES.map((r) => `${r}:solid`)];

export const SECTION_FIELDS: BlockFieldDefinition[] = [
  { slug: 'kicker', label: 'Kicker (small line above the heading)', type: 'string' },
  { slug: 'heading', label: 'Heading', type: 'string' },
  select(
    'level',
    'Heading level (p: styled like a heading, not in the outline)',
    ['1', '2', '3', '4', '5', '6', 'p'],
    '2',
  ),
  { slug: 'sub', label: 'Lead-in text under the heading', type: 'text' },
  { slug: 'body', label: 'Content (any blocks)', type: 'portableText' },
  select('layout', 'Layout', ['stack', 'center', 'split'], 'stack'),
  select('width', 'Width', ['measure', 'breakout', 'spotlight', 'fullbleed'], 'measure'),
  {
    slug: 'tone',
    label: 'Backdrop tone (a colour role from the site, e.g. surface or brand-primary)',
    type: 'string',
  },
  {
    slug: 'color',
    label: 'Palette colour instead of a tone (e.g. amber or amber-300)',
    type: 'string',
  },
  { slug: 'solid', label: 'Fill with the solid colour', type: 'boolean', defaultValue: false },
  select(
    'theme',
    'Theme (backdrop and readable text in one pick; overrides the tone fields)',
    THEMES,
    'none',
  ),
  { slug: 'anchor', label: 'Anchor id (so a link can point here with #id)', type: 'string' },
  { slug: 'class_name', label: 'Extra CSS classes', type: 'string' },
  { slug: 'style', label: 'CSS custom properties, e.g. --p-card: 2rem', type: 'string' },
];

/** `vitops_section`: kicker, heading, lead-in, tone/backdrop, optional heading-left layout, and a body of blocks. */
export const SECTION_BLOCK_TYPE: ApplySeedBlockTypeInput = {
  slug: SECTION_SLUG,
  label: 'Section',
  description: 'A titled page section whose body can hold any other blocks.',
  category: 'Sections',
  icon: 'layout',
  currentVersion: 1,
  versions: [{ version: 1, fields: SECTION_FIELDS }],
};

/**
 * Every block type this plugin ships, in the shape `seed.json`'s `blockTypes` takes. Spread
 * it into the seed (and allow the slugs on the collection's `blocks` field), e.g.
 * `blockTypes: [...vitopsBlockTypes()]`.
 */
export function vitopsBlockTypes(): ApplySeedBlockTypeInput[] {
  return [SECTION_BLOCK_TYPE];
}
