/**
 * Portable Text block-type declarations for the EmDash editor.
 *
 * Fields are EmDash Block Kit elements. Scalars (text_input / number_input / select /
 * toggle / combobox) cover single-valued patterns; `repeater` (rows of scalar
 * sub-fields) covers the repeating ones — cards, gallery, accordion, marquee, carousel
 * slides — and `media_picker` picks one asset from the media library. Both are
 * supported by the Portable Text block editor but not by Block Kit admin pages, which
 * is why the type below names them explicitly rather than accepting any `Element`.
 *
 * Patterns that need other blocks INSIDE them (a section with columns, a card holding a
 * button) cannot be a Portable Text block — a repeater holds scalars only. Those belong in
 * an EmDash `blocks` field; see the README.
 *
 * Every `action_id` here must have a matching prop consumed by the block's
 * .astro component in `src/astro/blocks/` (enforced by blocks.test.ts).
 */

import type { PortableTextBlockConfig } from 'emdash';
import { SEMANTIC_ICON_OPTIONS } from './icon-options.ts';

/** The subset of EmDash Block Kit field elements these blocks use. */
export type BlockKitFieldDef = Extract<
  NonNullable<PortableTextBlockConfig['fields']>[number],
  {
    type:
      | 'text_input'
      | 'number_input'
      | 'select'
      | 'toggle'
      | 'combobox'
      | 'repeater'
      | 'media_picker';
  }
>;

export type PortableTextBlockDef = Omit<PortableTextBlockConfig, 'fields'> & {
  fields?: BlockKitFieldDef[];
};

export const BLOCKS: PortableTextBlockDef[] = [
  {
    /**
     * A link or button, optionally with an icon at either end.
     *
     * Flattened on purpose: Block Kit has no object-group element, so a shape
     * like `{ label, url }` becomes sibling fields. Same constraint the
     * marketing-blocks plugin documents.
     *
     * The icons are `combobox` — a searchable typeahead over a STATIC option
     * list, which is exactly what the semantic name list is. It is the closest
     * fit Block Kit offers: its element union is closed (no custom element, no
     * raw HTML), so `<wc-icon-picker>` cannot be mounted inside a block modal
     * however much nicer it would be. Revisit if EmDash opens that union.
     */
    type: 'vitops.actionLink',
    label: 'Link or button',
    icon: 'link',
    placeholder: 'A link or button, with optional icons',
    fields: [
      { type: 'text_input', action_id: 'label', label: 'Label' },
      { type: 'text_input', action_id: 'href', label: 'URL' },
      {
        type: 'select',
        action_id: 'variant',
        label: 'Style',
        initial_value: 'link',
        options: [
          { label: 'Link', value: 'link' },
          { label: 'Button', value: 'btn' },
          { label: 'Call to action', value: 'cta' },
        ],
      },
      {
        type: 'combobox',
        action_id: 'startIcon',
        label: 'Icon before the label',
        placeholder: 'None',
        options: SEMANTIC_ICON_OPTIONS,
      },
      {
        type: 'combobox',
        action_id: 'endIcon',
        label: 'Icon after the label',
        placeholder: 'None',
        options: SEMANTIC_ICON_OPTIONS,
      },
      {
        type: 'select',
        action_id: 'role',
        label: 'Colour role',
        initial_value: '',
        options: [
          { label: 'Default', value: '' },
          { label: 'Success', value: 'success' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
        ],
      },
      { type: 'toggle', action_id: 'newTab', label: 'Open in a new tab', initial_value: false },
    ],
  },
  {
    type: 'vitops.imageCompare',
    label: 'Image compare',
    placeholder: 'Before/after image slider',
    fields: [
      { type: 'text_input', action_id: 'before', label: 'Before image URL' },
      { type: 'text_input', action_id: 'beforeAlt', label: 'Before alt text' },
      {
        type: 'text_input',
        action_id: 'beforeLabel',
        label: 'Before label',
        initial_value: 'Before',
      },
      { type: 'text_input', action_id: 'after', label: 'After image URL' },
      { type: 'text_input', action_id: 'afterAlt', label: 'After alt text' },
      { type: 'text_input', action_id: 'afterLabel', label: 'After label', initial_value: 'After' },
    ],
  },
  {
    type: 'vitops.copyButton',
    label: 'Copy snippet',
    icon: 'code',
    placeholder: 'Text with a copy-to-clipboard button',
    fields: [
      { type: 'text_input', action_id: 'text', label: 'Text to copy', multiline: true },
      { type: 'text_input', action_id: 'label', label: 'Button label', initial_value: 'Copy' },
      {
        type: 'select',
        action_id: 'display',
        label: 'Display',
        initial_value: 'code-block',
        options: [
          { label: 'Code block', value: 'code-block' },
          { label: 'Inline', value: 'inline' },
        ],
      },
    ],
  },
  {
    type: 'vitops.banner',
    label: 'Banner',
    placeholder: 'Announcement or notice',
    fields: [
      { type: 'text_input', action_id: 'message', label: 'Message', multiline: true },
      {
        type: 'select',
        action_id: 'tone',
        label: 'Tone',
        initial_value: 'info',
        options: [
          { label: 'Info', value: 'info' },
          { label: 'Success', value: 'success' },
          { label: 'Warning', value: 'warning' },
          { label: 'Danger', value: 'danger' },
        ],
      },
      { type: 'toggle', action_id: 'dismissible', label: 'Dismissible', initial_value: true },
    ],
  },
  {
    type: 'vitops.details',
    label: 'Disclosure',
    placeholder: 'Collapsible details/summary',
    fields: [
      { type: 'text_input', action_id: 'summary', label: 'Summary (always visible)' },
      { type: 'text_input', action_id: 'body', label: 'Body (revealed)', multiline: true },
      { type: 'toggle', action_id: 'open', label: 'Open by default', initial_value: false },
    ],
  },
  {
    type: 'vitops.carousel',
    label: 'Carousel',
    placeholder: 'Image carousel',
    category: 'Media',
    fields: [
      {
        type: 'repeater',
        action_id: 'slides',
        label: 'Slides',
        item_label: 'slide',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'src', label: 'Image URL' },
          { type: 'text_input', action_id: 'alt', label: 'Alt text' },
        ],
      },
      {
        type: 'text_input',
        action_id: 'images',
        label: 'Image URLs, one per line (legacy — use Slides)',
        multiline: true,
      },
      {
        type: 'text_input',
        action_id: 'alts',
        label: 'Alt texts, one per line (legacy — use Slides)',
        multiline: true,
      },
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Accessible name',
        initial_value: 'Carousel',
      },
      {
        type: 'number_input',
        action_id: 'autoplay',
        label: 'Autoplay interval (ms, 0 = off)',
        initial_value: 0,
      },
      {
        type: 'toggle',
        action_id: 'loop',
        label: 'Loop (clones the slides — autoplay implies it)',
        initial_value: false,
      },
      {
        type: 'text_input',
        action_id: 'aspect',
        label: 'Slide aspect ratio',
        initial_value: '16 / 9',
      },
    ],
  },
  {
    type: 'vitops.gallery',
    label: 'Gallery',
    placeholder: 'Thumbnail grid that opens a lightbox carousel',
    category: 'Media',
    fields: [
      {
        type: 'text_input',
        action_id: 'label',
        label: 'Accessible name',
        initial_value: 'Gallery',
      },
      {
        type: 'repeater',
        action_id: 'images',
        label: 'Images',
        item_label: 'image',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'src', label: 'Image URL' },
          { type: 'text_input', action_id: 'alt', label: 'Alt text' },
          { type: 'text_input', action_id: 'caption', label: 'Caption' },
        ],
      },
      {
        type: 'text_input',
        action_id: 'aspect',
        label: 'Thumbnail aspect ratio',
        initial_value: '1',
      },
      { type: 'toggle', action_id: 'loop', label: 'Wrap around at the ends', initial_value: false },
    ],
  },
  {
    type: 'vitops.cards',
    label: 'Cards',
    placeholder: 'A grid of cards',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'cards',
        label: 'Cards',
        item_label: 'card',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'title', label: 'Title' },
          { type: 'text_input', action_id: 'body', label: 'Text', multiline: true },
          { type: 'text_input', action_id: 'image', label: 'Image URL' },
          { type: 'text_input', action_id: 'imageAlt', label: 'Image alt text' },
          {
            type: 'text_input',
            action_id: 'href',
            label: 'Link URL (makes the whole card clickable)',
          },
          {
            type: 'text_input',
            action_id: 'linkLabel',
            label: 'Link text',
            initial_value: 'Read more',
          },
        ],
      },
      {
        type: 'select',
        action_id: 'columns',
        label: 'Columns',
        initial_value: '3',
        options: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
    ],
  },
  {
    type: 'vitops.accordion',
    label: 'Accordion',
    placeholder: 'A group of collapsible sections',
    category: 'Sections',
    fields: [
      {
        type: 'repeater',
        action_id: 'items',
        label: 'Items',
        item_label: 'item',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'summary', label: 'Summary (always visible)' },
          { type: 'text_input', action_id: 'body', label: 'Body (revealed)', multiline: true },
          { type: 'toggle', action_id: 'open', label: 'Open by default', initial_value: false },
        ],
      },
      {
        type: 'toggle',
        action_id: 'exclusive',
        label: 'Only one open at a time',
        initial_value: false,
      },
    ],
  },
  {
    type: 'vitops.hero',
    label: 'Hero',
    placeholder: 'Page opener: heading, text, buttons and an optional image',
    category: 'Sections',
    fields: [
      { type: 'text_input', action_id: 'eyebrow', label: 'Eyebrow (small line above)' },
      { type: 'text_input', action_id: 'heading', label: 'Heading' },
      { type: 'text_input', action_id: 'body', label: 'Text', multiline: true },
      { type: 'text_input', action_id: 'primaryLabel', label: 'Main button text' },
      { type: 'text_input', action_id: 'primaryHref', label: 'Main button URL' },
      { type: 'text_input', action_id: 'secondaryLabel', label: 'Second link text' },
      { type: 'text_input', action_id: 'secondaryHref', label: 'Second link URL' },
      { type: 'text_input', action_id: 'image', label: 'Image URL (split layout)' },
      { type: 'text_input', action_id: 'imageAlt', label: 'Image alt text' },
      {
        type: 'select',
        action_id: 'layout',
        label: 'Layout',
        initial_value: 'centered',
        options: [
          { label: 'Centered', value: 'centered' },
          { label: 'Text and image side by side', value: 'split' },
        ],
      },
    ],
  },
  {
    type: 'vitops.marquee',
    label: 'Marquee',
    placeholder: 'A continuously scrolling row (logos, quotes, badges)',
    category: 'Media',
    fields: [
      {
        type: 'repeater',
        action_id: 'items',
        label: 'Items',
        item_label: 'item',
        min_items: 1,
        fields: [
          { type: 'text_input', action_id: 'text', label: 'Text' },
          { type: 'text_input', action_id: 'image', label: 'Image URL (shown instead of text)' },
          { type: 'text_input', action_id: 'alt', label: 'Image alt text' },
        ],
      },
      { type: 'toggle', action_id: 'pauseOnHover', label: 'Pause on hover', initial_value: true },
      { type: 'toggle', action_id: 'reverse', label: 'Scroll the other way', initial_value: false },
    ],
  },
];

/** Which Vitops blocks a site's editor offers, and any it adds of its own. */
export interface BlockSelection {
  /** Offer only these `vitops.*` types. Unknown names throw — a typo must not silently offer nothing. */
  include?: string[];
  /** Drop these `vitops.*` types. Applied after `include`. */
  exclude?: string[];
  /**
   * The site's own blocks. These are EDITOR definitions only: the plugin cannot render a
   * block it has never heard of, so the site maps each `type` to a component with
   * `<PortableText components={{ type: { … } }} />`. A type that collides with an existing
   * one throws, since the later definition would silently replace the earlier one's fields.
   */
  extra?: PortableTextBlockDef[];
}

/**
 * Resolve {@link BlockSelection} against {@link BLOCKS}.
 *
 * Pure so a misconfiguration fails at plugin construction, with the offending name in the
 * message, rather than as an editor menu that is quietly missing something.
 */
export function selectBlocks(selection: BlockSelection = {}): PortableTextBlockDef[] {
  const known = new Set(BLOCKS.map((b) => b.type));
  const check = (names: string[] | undefined, option: string): void => {
    for (const name of names ?? [])
      if (!known.has(name))
        throw new Error(
          `[vitops] blocks.${option}: unknown block '${name}'. Known: ${[...known].join(', ')}.`,
        );
  };
  check(selection.include, 'include');
  check(selection.exclude, 'exclude');

  const include = selection.include ? new Set(selection.include) : null;
  const exclude = new Set(selection.exclude);
  const base = BLOCKS.filter((b) => (!include || include.has(b.type)) && !exclude.has(b.type));

  const extra = selection.extra ?? [];
  const taken = new Set(BLOCKS.map((b) => b.type));
  for (const block of extra) {
    if (taken.has(block.type))
      throw new Error(`[vitops] blocks.extra: type '${block.type}' is already defined.`);
    taken.add(block.type);
  }
  return [...base, ...extra];
}
